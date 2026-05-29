import type { Camera } from '@/core/camera/camera';
import type { EntityBase } from '@/core/entity/scope';
import type { EmitterConfig, ParticleEmitter } from '@/core/particles/ParticleEmitter';
import type { GameEventName } from '@/data/events';
import type { LayerName } from '@/core/window/types';
import type { Timeline } from 'animejs';
import type { Container, Filter } from 'pixi.js';

/**
 * VFX system — shared types.
 *
 * Every visual effect is a self-contained module exporting an `EffectDef`
 * discriminated by `kind`. The `VFXSystem` reads `kind` to know how to manage
 * the effect's GPU resources (pooled emitter, full-screen filter, …) and the
 * runtime budget.
 *
 * The four kinds map onto the four ways VFX shows up in the game:
 * - `burst`      localized one-shot (brick debris, hit spark)
 * - `continuous` lifetime-bound, attached to a host entity (trail, aura)
 * - `screen`     full-screen post-processing filter (CRT, reflection, bloom)
 * - `sequence`   composed, timed, multi-step (boss entrance)
 *
 * NOTE: Phase 1 implements `burst` end-to-end. `continuous`, `screen` and
 * `sequence` are defined here so effect authors and the system share one shape,
 * but their runtime handling lands in later phases.
 */

/** Under resource/CPU pressure the budget sheds `ambient` first, then `normal`; `critical` is never dropped. */
export type VfxPriority = 'critical' | 'normal' | 'ambient';

interface BaseDef {
  /** Stable, unique id — also the key for the effect's pooled resource. */
  id: string;
  /** Defaults to `normal`. Drives eviction order and the per-frame play cap. */
  priority?: VfxPriority;
  /**
   * Optional self-declared global trigger. When set, the system subscribes this
   * effect to the given `GameEvent` at init — keeping the binding in the effect's
   * own file rather than a central table. Local entity emitters (e.g. a brick's
   * `broken`) are not global events; those fire the effect by reference via
   * `vfx.play(def, params)`.
   */
  on?: GameEventName;
}

/** Context handed to a burst effect's `play` — the pooled emitter plus the scene it draws into. */
export interface BurstContext {
  emitter: ParticleEmitter;
  camera: Camera;
  layer: Container;
}

/** Localized one-shot effect. Reuses a single persistent, budgeted emitter via `explode`. */
export interface BurstDef<P = void> extends BaseDef {
  kind: 'burst';
  /** Config for the persistent emitter the system lazily creates once and reuses. */
  emitter: () => EmitterConfig;
  play(params: P, ctx: BurstContext): void;
  /** Coalesce repeat triggers: skip if this effect fired less than `cooldownMs` ago. */
  cooldownMs?: number;
}

/**
 * Resolves the screen-space position of an attach target, sampled each frame.
 * Decouples a continuous effect from *what* it follows — a physics body, a
 * display object, a fixed point, anything — so the same trail/aura works on a
 * ball or a UI element. See `follow.ts` for ready-made sources.
 */
export type PositionSource = () => { x: number; y: number };

/** Context handed to a continuous effect's `attach`. */
export interface ContinuousContext {
  emitter?: ParticleEmitter;
  camera: Camera;
  layer: Container;
  /**
   * Screen-space position of the attach target this frame. Defaults to the
   * origin (0,0) when no source was supplied to `vfx.attach`; pass a source
   * (`followBody`/`followNode`/`followPoint`) for anything that moves.
   */
  position: PositionSource;
}

/** Lifetime-bound effect, attached to a host entity (Phase 3). */
export interface ContinuousDef<P = void, H extends EntityBase = EntityBase> extends BaseDef {
  kind: 'continuous';
  emitter?: () => EmitterConfig;
  attach(host: H, params: P, ctx: ContinuousContext): void;
}

/** Full-screen post-processing filter (Phase 2). */
export interface ScreenDef extends BaseDef {
  kind: 'screen';
  create(): Filter;
  /** Where the filter attaches. Defaults to the camera viewport. */
  target?: 'viewport' | 'stage';
  /** Per-frame uniform animation (replaces the inline `filter.time += dt/…` in main.ts). */
  update?(filter: Filter, dtMs: number): void;
  /** Called when the renderer resizes — use to update boundary/dimension-dependent uniforms. */
  resize?(filter: Filter, w: number, h: number): void;
  /** Long-lived ambient filters stay resident across screens. */
  pin?: boolean;
}

/** Identity helper that preserves the precise `ScreenDef` type. */
export function defineScreen(def: ScreenDef): ScreenDef {
  return def;
}

/** Context handed to a sequence effect's `build`. */
export interface SequenceContext {
  camera: Camera;
  /** The `effects` layer (camera-relative). Recreated per screen — don't cache across plays. */
  layer: Container;
  /**
   * The application stage (screen-fixed, top-most, persistent across screen
   * transitions). Use for full-screen cinematics that must outlive a level
   * teardown — e.g. a "level completed" flash that covers the transition.
   */
  stage: Container;
  /** Current renderer size in screen pixels, for sizing/centering full-screen elements. */
  size: { width: number; height: number };
  /**
   * Run an authored Godot cutscene by name; resolves when the animation completes.
   * Mirrors `PlayCutsceneCommand` but is callable from a plain async sequence body,
   * letting a sequence weave authored cutscenes between imperative VFX/camera beats.
   */
  cutscene(name: string, options?: { animation?: string; layer?: LayerName }): Promise<void>;
  /**
   * Create an anime.js timeline owned by the VFX system. Prefer this over
   * `createTimeline` directly: when the sequence is launched in debug/seek mode,
   * the system pauses the returned timeline and drives its playhead from a slider
   * in the debug panel — so the whole animation can be scrubbed and every tween
   * inspected. In normal playback it behaves exactly like `createTimeline()`.
   *
   * AUTHORING RULE (so debug shows "the full thing"):
   * - `tl.add(target, { ...props }, time)` — **seekable state**. Anything visual
   *   (position, scale, alpha, tint, rotation) belongs here, even instant sets
   *   (`duration: 1`). Scrubbing reproduces it exactly at any playhead position.
   * - `tl.call(fn, time)` — a **fire-once trigger** for external systems that have
   *   no seekable state on this timeline (camera shake/punch, particle spawns via
   *   `vfx.play`, audio cues). These are muted while scrubbing and only run on
   *   real playback; scrub near one and press Play to see it in context.
   * Rule of thumb: if you'd want to *see it* by dragging the slider, make it a
   * tween, not a call.
   */
  timeline(): Timeline;
}

/**
 * Composed, timed, multi-step effect (boss entrance, level clear flourish).
 *
 * A sequence does not introduce a new sequencer — it composes the pieces that
 * already exist: it fires burst VFX by reference (`vfx.play`), drives camera fx
 * (`shake`/`zoom`/…), schedules those beats on an anime.js timeline (the same
 * runtime the cutscene player uses), and can run authored Godot cutscenes via
 * `ctx.cutscene(...)`. `build` returns a promise so the whole sequence is
 * awaitable / `yield`-able from a gameplay command.
 */
export interface SequenceDef<P = void> extends BaseDef {
  kind: 'sequence';
  /**
   * Emitters to pre-create before `build` runs, so a burst fired mid-sequence
   * never pays an allocation cost at a dramatic moment.
   */
  prewarm?: EmitterBackedDef[];
  build(params: P, ctx: SequenceContext): Promise<void> | void;
}

export type EffectDef<P = any> = BurstDef<P> | ContinuousDef<P> | ScreenDef | SequenceDef<P>;

/** Effects that own a pooled `ParticleEmitter` resource keyed by `id`. */
export type EmitterBackedDef = BurstDef<any> | ContinuousDef<any>;

/** Identity helper that preserves the precise `BurstDef<P>` type for call-site inference. */
export function defineBurst<P = void>(def: BurstDef<P>): BurstDef<P> {
  return def;
}

/** Identity helper that preserves the precise `ContinuousDef<P, H>` type for call-site inference. */
export function defineContinuous<P = void, H extends EntityBase = EntityBase>(
  def: ContinuousDef<P, H>,
): ContinuousDef<P, H> {
  return def;
}

/** Identity helper that preserves the precise `SequenceDef<P>` type for call-site inference. */
export function defineSequence<P = void>(def: SequenceDef<P>): SequenceDef<P> {
  return def;
}

/** Identity helper for any effect kind. */
export function defineEffect<D extends EffectDef>(def: D): D {
  return def;
}
