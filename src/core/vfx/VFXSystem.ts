import type { System } from '@/core/game/System';
import { MIN_HEIGHT, MIN_WIDTH } from '@/consts';
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { attach as scopeAttach, onCleanup, type AttachHandle, type EntityBase } from '@/core/entity/scope';
import { CutscenePlayer } from '@/core/cutscene/CutscenePlayer';
import type { CutsceneData } from '@/core/cutscene/types';
import { DebugPanel, type FolderApi } from '@/core/devtools/debug-panel';
import type { LayerName } from '@/core/window/types';
import { GameEvent } from '@/data/events';
import type { GameContext } from '@/data/game-context';
import { createTimeline } from 'animejs';
import { Assets, Container, type Filter } from 'pixi.js';
import { VfxResourcePool } from './ResourceManager';
import { SequenceDebugSession } from './SequenceDebug';
import { Figure8Mover } from './debug/figure8Mover';
import { followBody } from './follow';
import { registeredEffects } from './registry';
import { requestTimelineEdit } from './timeline/editor/editMode';
import { TIMELINE_IDS } from 'virtual:timeline-manifest';
import type {
  BurstDef,
  ContinuousDef,
  EmitterBackedDef,
  PositionSource,
  ScreenDef,
  SequenceContext,
  SequenceDef,
  VfxPriority,
} from './types';

/** zIndex for emitter containers within the `effects` layer (mirrors ParticleEmitterEntity). */
const EMITTER_Z_INDEX = 1000;

/** Default attach anchor when no position source is supplied. */
const ORIGIN: PositionSource = () => ({ x: 0, y: 0 });

/** Hard cap on persistent emitters kept live at once before LRU/priority eviction. */
const MAX_LIVE_EMITTERS = 24;
/** Persistent emitter is reclaimed after this long without use (the boss-bloat guard). */
const IDLE_TTL_MS = 10_000;
/**
 * Max non-critical `play` calls serviced per frame. A pathological flood (a huge
 * combo, every brick at once) is smoothed by dropping `ambient`/`normal` plays
 * past this; `critical` always runs. Particle *count* is separately bounded by
 * each emitter's `maxParticles` free-list, so this only guards per-frame work.
 */
const MAX_PLAYS_PER_FRAME = 64;

/**
 * Owns all VFX behind one accessor: the budgeted emitter pool, the per-frame
 * play budget, screen filters, and (later phases) sequences.
 *
 * Registered like the other gameplay systems, but **added last** so its
 * `update` runs after physics/collision in each tick — that lets it reset the
 * per-frame play counter at the tail of the frame, after the plays it bounds.
 */
export class VFXSystem implements System {
  static SYSTEM_ID = 'vfx';

  private context!: GameContext;
  private pool!: VfxResourcePool<ParticleEmitter>;
  private cooldowns = new Map<string, number>();
  private playsThisFrame = 0;
  private unsubscribe: Array<() => void> = [];

  /** DEV-only debug-panel tab page for all VFX controls. */
  private debugPage: FolderApi | null = null;
  /** Folder under the VFX page where live sequence seek-sessions are parented. */
  private debugSeqFolder: FolderApi | null = null;
  /** Active figure-8 preview hosts for continuous effects, keyed by effect id. */
  private debugMovers = new Map<string, EntityBase>();

  /** Active screen filters, keyed by ScreenDef.id. */
  private screenFilters = new Map<string, { def: ScreenDef; filter: Filter }>();

  private readonly update = (dtMs: number): void => {
    // Reset at the tail of the frame (VFXSystem is registered last) so the cap
    // counts the plays that happened earlier this tick.
    this.playsThisFrame = 0;
    this.pool.sweep();
    this.screenFilters.forEach(({ def, filter }) => def.update?.(filter, dtMs));
  };

  private readonly onResize = (w: number, h: number): void => {
    this.screenFilters.forEach(({ def, filter }) => def.resize?.(filter, w, h));
  };

  private readonly onScreenUnloaded = (): void => {
    // The `effects` layer container is destroyed per screen; drop all unpinned
    // resources so we never reuse an emitter whose container is gone.
    this.pool.disposeAll({ keepPinned: true });
    this.cooldowns.clear();
    // Disable non-pinned screen filters (pinned ones persist across screens).
    const toDisable: ScreenDef[] = [];
    this.screenFilters.forEach(({ def }) => {
      if (!def.pin) toDisable.push(def);
    });
    toDisable.forEach((def) => this.disableScreen(def));
  };

  init(context: GameContext): void {
    this.context = context;

    this.pool = new VfxResourcePool<ParticleEmitter>({
      maxLive: MAX_LIVE_EMITTERS,
      idleTtlMs: IDLE_TTL_MS,
      create: (def) => this.createEmitter(def),
      dispose: (emitter) => emitter.destroy(),
    });

    // Decentralized triggers: wire every effect that declares its own `on:`.
    // The binding lives in the effect's own file, not a central table; the
    // event payload is forwarded as the effect's params. Both one-shot bursts
    // and composed sequences can self-trigger this way.
    for (const def of registeredEffects()) {
      if ((def.kind === 'burst' || def.kind === 'sequence') && def.on) {
        const triggered = def as BurstDef<unknown> | SequenceDef<unknown>;
        this.unsubscribe.push(
          context.events.on(triggered.on!, (payload) => {
            this.play(triggered as SequenceDef<unknown>, payload);
          }),
        );
      }
      // Auto-enable pinned screen filters so they're always resident.
      if (def.kind === 'screen' && def.pin) {
        this.enableScreen(def);
      }
    }

    context.systems.register('update', this.update);
    context.systems.register('resize', this.onResize);
    this.unsubscribe.push(context.events.on(GameEvent.SCREEN_UNLOADED, this.onScreenUnloaded));

    if (import.meta.env.DEV) this.initDebugPanel();
  }

  /**
   * Build the "VFX" debug tab: every registered effect, grouped by kind, with the
   * control that fits it — sequences get a scrubbable seek launcher, bursts a
   * one-shot fire, screen filters a live on/off toggle. Scales by adding to the
   * right folder rather than growing a flat button list.
   */
  private initDebugPanel(): void {
    const page = DebugPanel.page('VFX');
    if (!page) return;
    this.debugPage = page;

    const sequences = page.addFolder({ title: 'Sequences', expanded: true });
    this.debugSeqFolder = sequences;
    const bursts = page.addFolder({ title: 'Bursts', expanded: false });
    const continuous = page.addFolder({ title: 'Continuous', expanded: false });
    const screens = page.addFolder({ title: 'Screen filters', expanded: false });

    const center = { x: MIN_WIDTH / 2, y: MIN_HEIGHT / 2 };

    const seqDefs: SequenceDef<unknown>[] = [];

    for (const def of registeredEffects()) {
      switch (def.kind) {
        case 'sequence': {
          // Collected and surfaced via a single dropdown launcher below, rather
          // than a button pair per sequence (Phase F).
          seqDefs.push(def as SequenceDef<unknown>);
          break;
        }
        case 'burst': {
          const burst = def as BurstDef<unknown>;
          // Fire at world-center; bursts whose params expect a position get one.
          bursts.addButton({ title: burst.id, label: 'fire ▶' }).on('click', () => {
            this.play(burst, { ...center } as unknown);
          });
          break;
        }
        case 'continuous': {
          const cont = def as ContinuousDef<unknown>;
          // Toggle: attach to a figure-8 dummy mover, detach to remove it.
          const state = { on: false };
          continuous
            .addBinding(state, 'on', { label: cont.id })
            .on('change', () => (state.on ? this.attachDebugMover(cont) : this.detachDebugMover(cont)));
          break;
        }
        case 'screen': {
          const screen = def;
          const state = { on: this.screenFilters.has(screen.id) };
          screens
            .addBinding(state, 'on', { label: screen.id })
            .on('change', () => (state.on ? this.enableScreen(screen) : this.disableScreen(screen)));
          break;
        }
      }
    }

    this.initSequenceLauncher(sequences, seqDefs);
  }

  /**
   * One dropdown to pick a sequence + a `seek`/`edit` action pair, replacing the
   * per-sequence button wall (Phase F). `edit` is enabled only for *data-driven*
   * sequences — those with a committed `assets/timelines/<id>.json`, surfaced via
   * the build-time `virtual:timeline-manifest` — so opening the editor on a purely
   * imperative sequence (which has no doc to edit) isn't offered.
   */
  private initSequenceLauncher(folder: FolderApi, seqDefs: SequenceDef<unknown>[]): void {
    if (seqDefs.length === 0) return;

    const dataDriven = new Set(TIMELINE_IDS);
    const byId = new Map(seqDefs.map((s) => [s.id, s]));
    const options: Record<string, string> = {};
    for (const s of seqDefs) options[dataDriven.has(s.id) ? `${s.id}  ✎` : s.id] = s.id;

    const state = { seq: seqDefs[0].id };
    const select = folder.addBinding(state, 'seq', { label: 'sequence', options });

    folder.addButton({ title: 'seek ▶', label: 'play' }).on('click', () => {
      const def = byId.get(state.seq);
      if (def) this.playSequence(def, {}, true);
    });

    const editBtn = folder.addButton({ title: 'edit ✎', label: 'editor' });
    editBtn.on('click', () => {
      const def = byId.get(state.seq);
      if (!def || !dataDriven.has(def.id)) return;
      requestTimelineEdit(def.id);
      this.playSequence(def, {}, false);
    });

    // Disable `edit` whenever the selection has no JSON doc to edit.
    const syncEdit = (): void => void (editBtn.disabled = !dataDriven.has(state.seq));
    select.on('change', syncEdit);
    syncEdit();

    // Re-launch a sequence's editor by id — used by the popup's "Re-open" button
    // after the game window reloads (the detached popup calls this on the opener).
    (window as unknown as { __vfxEditTimeline?: (id: string) => boolean }).__vfxEditTimeline = (id) => {
      const def = byId.get(id);
      if (!def || !dataDriven.has(id)) return false;
      requestTimelineEdit(id);
      void this.playSequence(def, {}, false);
      return true;
    };
  }

  /** Spawn a figure-8 mover and attach a continuous effect to it for preview. */
  private attachDebugMover(def: ContinuousDef<unknown>): void {
    if (this.debugMovers.has(def.id)) return;
    if (!this.context.worldId) {
      console.warn(`[VFXSystem] continuous preview needs an active physics world (load a level first)`);
      return;
    }
    const mover = Figure8Mover();
    this.attach(def, mover, undefined, followBody(mover.bodyId));
    this.debugMovers.set(def.id, mover);
  }

  /** Destroy the preview mover; its scope cleanup detaches the effect and releases the emitter. */
  private detachDebugMover(def: ContinuousDef<unknown>): void {
    const mover = this.debugMovers.get(def.id);
    if (!mover) return;
    mover.destroy();
    this.debugMovers.delete(def.id);
  }

  destroy(): void {
    this.context?.systems.unregister('update', this.update);
    this.context?.systems.unregister('resize', this.onResize);
    this.unsubscribe.forEach((off) => off());
    this.unsubscribe = [];
    this.pool?.disposeAll();
    this.cooldowns.clear();
    this.screenFilters.forEach(({ def, filter }) => {
      this.detachFilter(def, filter);
      filter.destroy();
    });
    this.screenFilters.clear();
    this.debugMovers.forEach((mover) => mover.destroy());
    this.debugMovers.clear();
    this.debugPage?.dispose();
    this.debugPage = null;
    this.debugSeqFolder = null;
  }

  /** Fire a one-shot burst effect by reference (type-safe params, no string ids). */
  play<P>(def: BurstDef<P>, params: P): void;
  /** Run a composed, timed sequence by reference; resolves when the sequence completes. */
  play<P>(def: SequenceDef<P>, params: P): Promise<void>;
  play<P>(def: BurstDef<P> | SequenceDef<P>, params: P): void | Promise<void> {
    if (def.kind === 'sequence') {
      return this.playSequence(def, params, false);
    }

    if (def.cooldownMs) {
      const now = performance.now();
      const last = this.cooldowns.get(def.id) ?? -Infinity;
      if (now - last < def.cooldownMs) return;
      this.cooldowns.set(def.id, now);
    }

    if (!this.allowPlay(def.priority ?? 'normal')) return;

    const emitter = this.pool.acquire(def);
    def.play(params, { emitter, camera: this.context.camera, layer: this.layer() });
  }

  /**
   * Pre-warm declared emitters, then drive the sequence body. Returns when it
   * completes. In `debug` mode every timeline the sequence creates via
   * `ctx.timeline()` is paused and exposed as a scrubbable seek control.
   */
  private playSequence<P>(def: SequenceDef<P>, params: P, debug: boolean): Promise<void> {
    if (def.prewarm?.length) this.warm(...def.prewarm);

    const session = debug && import.meta.env.DEV ? new SequenceDebugSession(def.id, this.debugSeqFolder) : null;

    const ctx: SequenceContext = {
      camera: this.context.camera,
      layer: this.layer(),
      stage: this.context.app.stage,
      size: { width: this.context.navigation.width, height: this.context.navigation.height },
      cutscene: (name, options) => this.playCutscene(name, options),
      timeline: () => {
        const tl = createTimeline(session ? { autoplay: false } : {});
        session?.track(tl);
        return tl;
      },
    };

    const result = Promise.resolve(def.build(params, ctx));
    // In debug mode the session owns its own lifecycle: the panel persists after
    // the animation completes so you can replay/scrub, and is disposed only when
    // you click Close. (Outside debug there's no session and nothing to clean up.)
    return result;
  }

  /**
   * Run an authored Godot cutscene to completion on a layer, then tear it down.
   * Promise-based twin of `PlayCutsceneCommand` for use inside a sequence body.
   */
  private async playCutscene(name: string, options?: { animation?: string; layer?: LayerName }): Promise<void> {
    const data = (await Assets.load(`cutscenes/${name}.json`)) as CutsceneData;
    const animName = options?.animation ?? Object.keys(data.animations)[0];
    if (!animName) {
      console.warn(`[VFXSystem] cutscene "${name}" has no animations`);
      return;
    }
    const container = new Container({ label: `cutscene-${name}` });
    this.context.navigation.addToLayer(container, options?.layer ?? 'overlay');
    const player = new CutscenePlayer(data);
    await player.play(animName, {}, { parent: container });
    container.destroy();
  }

  /** Pre-create + lock emitters so a later burst (e.g. a boss) never allocates mid-fight. */
  pin(...defs: EmitterBackedDef[]): void {
    defs.forEach((def) => this.pool.pin(def));
  }

  /** Pre-create emitters without locking them, so first use has no allocation cost. */
  warm(...defs: EmitterBackedDef[]): void {
    defs.forEach((def) => this.pool.warm(def));
  }

  /**
   * Attach a continuous effect to a host entity. The emitter refcount is incremented
   * for the attachment's lifetime and released automatically when the host entity is
   * destroyed or the returned handle's `detach()` is called.
   *
   * `position` resolves the effect's screen-space anchor each frame; pass a
   * `followBody`/`followNode`/`followPoint` source for anything that moves. When
   * omitted it defaults to the origin.
   *
   * Must be called after the entity is fully constructed (after `defineEntity` returns),
   * not from inside the entity's factory scope.
   */
  attach<P, H extends EntityBase>(
    def: ContinuousDef<P, H>,
    host: H,
    params: P,
    position?: PositionSource,
  ): AttachHandle<void> {
    return scopeAttach(host, (entity) => {
      // Retain the emitter before handing ctx to the effect — this blocks eviction
      // while the host is alive (refCount > 0).
      const emitter = def.emitter ? this.pool.retain(def) : undefined;
      // Release the refcount when this child scope tears down (host destroyed or detach() called).
      onCleanup(() => {
        if (def.emitter) this.pool.release(def.id);
      });
      def.attach(entity, params, {
        emitter,
        camera: this.context.camera,
        layer: this.layer(),
        position: position ?? ORIGIN,
      });
    });
  }

  /** Attach a screen filter and start animating it. */
  enableScreen(def: ScreenDef): void {
    if (this.screenFilters.has(def.id)) return;
    const filter = def.create();
    this.screenFilters.set(def.id, { def, filter });
    this.attachFilter(def, filter);
  }

  /** Remove a screen filter and destroy its GPU resources. */
  disableScreen(def: ScreenDef): void {
    const entry = this.screenFilters.get(def.id);
    if (!entry) return;
    this.detachFilter(def, entry.filter);
    entry.filter.destroy();
    this.screenFilters.delete(def.id);
  }

  /** Returns a handle for toggling a screen filter at runtime. */
  screen(def: ScreenDef): { enable(): void; disable(): void } {
    return {
      enable: () => this.enableScreen(def),
      disable: () => this.disableScreen(def),
    };
  }

  private allowPlay(priority: VfxPriority): boolean {
    if (priority === 'critical') {
      this.playsThisFrame++;
      return true;
    }
    if (this.playsThisFrame >= MAX_PLAYS_PER_FRAME) return false;
    this.playsThisFrame++;
    return true;
  }

  /**
   * Render target for burst/continuous particles.
   *
   * Bursts position via `BodyToScreen`, which returns world×PXM + world-origin —
   * coordinates in the space of `ctx.container` (the GameScreen, which is offset
   * by `+MIN_WIDTH/2`), exactly where body sprites and the existing
   * Wall/WaterParticles render. The standalone `effects` layer has no such offset,
   * so drawing there put every effect half a screen off. Use `ctx.container` when
   * a gameplay screen is mounted; fall back to the `effects` layer otherwise.
   */
  private layer(): Container {
    return this.context.container ?? this.context.navigation.getLayer('effects');
  }

  private filterTarget(def: ScreenDef): Container {
    return def.target === 'stage' ? this.context.app.stage : this.context.camera.viewport;
  }

  private attachFilter(def: ScreenDef, filter: Filter): void {
    const target = this.filterTarget(def);
    const existing = (target.filters as Filter[] | null) ?? [];
    target.filters = [...existing, filter];
  }

  private detachFilter(def: ScreenDef, filter: Filter): void {
    const target = this.filterTarget(def);
    const filters = (target.filters as Filter[] | null) ?? [];
    target.filters = filters.filter((f) => f !== filter);
  }

  private createEmitter(def: EmitterBackedDef): ParticleEmitter {
    const config = def.emitter!();
    const emitter = new ParticleEmitter(config);
    emitter.container.zIndex = EMITTER_Z_INDEX;
    const layer = this.layer();
    // The fallback `effects` layer ships hidden (createGameLayers defaults
    // visible:false); reveal it on first use. (ctx.container is already visible.)
    layer.visible = true;
    layer.addChild(emitter.container);
    return emitter;
  }
}
