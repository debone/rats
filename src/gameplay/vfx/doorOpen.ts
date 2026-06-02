import { ASSETS } from '@/assets';
import { MIN_HEIGHT, MIN_WIDTH } from '@/consts';
import { sfx } from '@/core/audio/audio';
import { addShake } from '@/core/vfx/camera';
import { playTimeline } from '@/core/vfx/timeline/load';
import { framesToMs } from '@/core/vfx/timeline/time';
import { defineSequence } from '@/core/vfx/types';
import { vfx } from '@/core/vfx/vfx';
import { getGameContext } from '@/data/game-context';
import { PhysicsSystem } from '@/systems/physics/system';
import { BodyToScreen } from '@/systems/physics/WorldSprites';
import { b2Body_GetPosition, b2Body_IsValid, b2Body_SetTransform, b2Rot, type b2BodyId } from 'phaser-box2d';
import { Container, Graphics } from 'pixi.js';
import { brickBreak } from './brickBreak';

/**
 * A door unlocking and grinding open — a scripted "set-piece" moment, and the
 * proof that the hybrid timeline model handles a *system-coupled* effect.
 *
 * The whole game eases to a halt for it, the door is dusted loose, it grinds open
 * while the world holds its breath, then everything eases back to life.
 *
 * ## Code vs. data (the hybrid split)
 *
 * Nearly the whole choreography is now **data** you can see and retime in the
 * editor (`assets/timelines/doorOpen.json`):
 * - `physics.ramp` track — the 0↔1 time-scale envelope that freezes/resumes the
 *   world (`b2World_Step` runs with `dt = ramp·delta`).
 * - `door.progress` track — the 0→1 *open amount*, with its own easing. The door
 *   pieces follow it each frame, so retiming/easing this curve retimes the slide.
 * - cues — `clunk` (unlock), `creak` (grind start), `puff` ×7 (dust along the
 *   slide), `settle` (final spark) — fire-once beats, muted on scrub.
 *
 * What stays in **code** (`decorate`) is only the *mechanism*: the parametric
 * camera shakes (seekable, not keyframe data), and a single per-frame applier that
 * reads `door.progress` and writes it to the real bodies — or, when there are none
 * (a debug/editor preview), to a **stand-in door** so the choreography is visible
 * without a level's real door, the way continuous effects preview on a dummy mover.
 *
 * ## Why the slide is a value, not a body tween
 *
 * `ramp = 0` stops the simulation but `PhysicsSystem.update` keeps running, so
 * `UpdateWorldSprites` syncs sprites to bodies every frame. We move the bodies by
 * writing their transform from the applier (reading `door.progress`); the sprites
 * follow. Because the open amount is a timeline value, dragging the playhead grinds
 * the door open/closed — the whole thing is scrubbable.
 */
export interface DoorOpenParams {
  /** The door's segment bodies to slide. */
  bodyIds: b2BodyId[];
  /** Signed world-space distance to slide along x (caller bakes in direction). */
  distance: number;
  /** Optional custom "grinding open" sound; falls back to a creak. */
  sound?: string;
}

// Code-side beat times in ms (the JSON mirrors these in frames at 60fps).
const UNLOCK_AT = 300; //   dust burst + heavy unlock clunk (with the ramp-down)
const SLIDE_AT = 1500; //   grind begins: mechanical sound + shake
const SLIDE_MS = 2500; //   slide duration (also the sustained rumble length)
const SLIDE_END = SLIDE_AT + SLIDE_MS; // = 4000
const TOTAL_MS = framesToMs(420); // applier spans the whole timeline

/** One movable door piece — a physics body or a preview panel — abstracted alike. */
interface Piece {
  /** Apply the open amount [0..1]. */
  open(progress: number): void;
  /** Current screen position for dust, or null if gone. */
  pos(): { x: number; y: number } | null;
}

export const doorOpen = defineSequence<DoorOpenParams>({
  kind: 'sequence',
  id: 'doorOpen',
  priority: 'critical',
  prewarm: [brickBreak],
  // Defaults let the debug launcher (no params) preview the whole choreography on a
  // stand-in door, instead of throwing on an undefined body list.
  async build({ bodyIds = [], distance = 0, sound }: DoorOpenParams = {} as DoorOpenParams, ctx) {
    const { camera, stage: appStage, size } = ctx;

    // Freeze by time-scale — present only with a live world; absent → the ramp
    // track is a harmless no-op.
    const gctx = getGameContext();
    const physics = gctx.systems.has(PhysicsSystem) ? gctx.systems.get(PhysicsSystem) : null;

    // The value the `door.progress` track drives; the applier reads it each frame.
    const door = { progress: 0 };

    // The pieces to open: the real bodies, or a stand-in door when there are none.
    const { pieces, previewRoot } = buildPieces(bodyIds, distance, appStage, size);

    const dustAll = (count: number) => {
      for (const p of pieces) {
        const at = p.pos();
        if (at) vfx.play(brickBreak, { x: at.x, y: at.y, count, intensity: 0 });
      }
    };
    let puffIndex = 0;

    const stage = physics ? { physics, door } : { door };
    const hooks = {
      clunk: () => {
        sfx.playPitched(ASSETS.sounds_Rock_Impact_07, { speed: 0.7, volume: 0.7 });
        dustAll(10);
      },
      creak: () => sfx.playPitched(sound ?? ASSETS.sounds_Chest_Open_Creak_3_1, { speed: 0.8, volume: 0.5 }),
      puff: () => {
        const p = pieces[puffIndex++ % Math.max(1, pieces.length)];
        const at = p?.pos();
        if (at) vfx.play(brickBreak, { x: at.x, y: at.y, count: 3, intensity: 0 });
      },
      settle: () => {
        dustAll(8);
        sfx.playPitched(ASSETS.sounds_Rock_Impact_Small_10, { speed: 1.3, volume: 0.5 });
        sfx.play(ASSETS.sounds_Sell_Building_A, { volume: 0.5 });
      },
    };

    await playTimeline('doorOpen', {
      stage,
      hooks,
      ctx,
      decorate: (tl) => {
        // Parametric camera shakes — seekable, not keyframe data, so they stay in code.
        addShake(tl, camera, { intensity: 5, duration: 320 }, UNLOCK_AT); // jolt as the lock gives
        addShake(tl, camera, { intensity: 1.5, frequency: 30, duration: SLIDE_MS, decay: false }, SLIDE_AT); // grind
        addShake(tl, camera, { intensity: 6, duration: 360 }, SLIDE_END); // settle thump

        // Per-frame applier: write the data-driven `door.progress` onto the pieces.
        // A throwaway tween spanning the timeline just to get an onUpdate that runs
        // on play *and* on scrub.
        const sync = { t: 0 };
        tl.add(sync, { t: 1, duration: TOTAL_MS, onUpdate: () => pieces.forEach((p) => p.open(door.progress)) }, 0);
      },
    });

    previewRoot?.destroy({ children: true });
  },
});

/**
 * Build the openable pieces: real door bodies when present, else a stand-in door
 * (two panels grinding apart) so a debug/editor preview shows the motion. The
 * preview root, if any, is returned for teardown.
 */
function buildPieces(
  bodyIds: b2BodyId[],
  distance: number,
  appStage: Container,
  size: { width: number; height: number },
): { pieces: Piece[]; previewRoot: Container | null } {
  if (bodyIds.length > 0) {
    const rot = new b2Rot(1, 0);
    const pieces = bodyIds.map((id): Piece => {
      const start = b2Body_GetPosition(id).clone();
      const cur = start.clone();
      return {
        open: (progress) => {
          if (!b2Body_IsValid(id)) return;
          cur.x = start.x - distance * progress;
          b2Body_SetTransform(id, cur, rot);
        },
        pos: () => (b2Body_IsValid(id) ? BodyToScreen(id) : null),
      };
    });
    return { pieces, previewRoot: null };
  }

  // Stand-in door: two panels meeting at center, grinding apart with progress.
  const w = size.width || MIN_WIDTH;
  const h = size.height || MIN_HEIGHT;
  const panelW = w * 0.16;
  const panelH = h * 0.5;
  const slide = w * 0.22;
  const root = new Container({ label: 'vfx-doorOpen-preview', zIndex: 9998 });
  root.eventMode = 'none';
  appStage.sortableChildren = true;
  appStage.addChild(root);

  const pieces = [-1, 1].map((dir): Piece => {
    const g = new Graphics()
      .roundRect(-panelW / 2, -panelH / 2, panelW, panelH, 8)
      .fill({ color: 0x3a3a55 })
      .stroke({ color: 0xffd23f, width: 2 });
    const baseX = w / 2 + (dir * panelW) / 2;
    g.position.set(baseX, h / 2);
    root.addChild(g);
    return {
      open: (progress) => g.position.set(baseX + dir * slide * progress, h / 2),
      pos: () => ({ x: g.x, y: g.y }),
    };
  });
  return { pieces, previewRoot: root };
}
