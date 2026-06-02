import { ASSETS } from '@/assets';
import { sfx } from '@/core/audio/audio';
import { addShake } from '@/core/vfx/camera';
import { playTimeline } from '@/core/vfx/timeline/load';
import { defineSequence } from '@/core/vfx/types';
import { vfx } from '@/core/vfx/vfx';
import { getGameContext } from '@/data/game-context';
import { PhysicsSystem } from '@/systems/physics/system';
import { BodyToScreen } from '@/systems/physics/WorldSprites';
import { b2Body_GetPosition, b2Body_IsValid, b2Body_SetTransform, b2Rot, type b2BodyId } from 'phaser-box2d';
import { brickBreak } from './brickBreak';

/**
 * A door unlocking and grinding open — a scripted "set-piece" moment, and the
 * proof that the hybrid timeline model handles a *system-coupled* effect, not just
 * procedural graphics.
 *
 * The whole game eases to a halt for it, the door is dusted loose, it grinds open
 * while the world holds its breath, then everything eases back to life.
 *
 * ## Freezing the game and moving the door
 *
 * The hard part is sliding the door's bodies with the simulation stopped. The
 * trick is to control the physics *time-scale* (`PhysicsSystem.ramp`) rather than
 * unregistering the physics update: tween `ramp` 1 → 0 to ease the world to a stop,
 * hold it at 0 during the slide, then tween it 0 → 1 to ease back. With `ramp = 0`,
 * `b2World_Step` runs with `dt = 0`, so the ball sits still and keeps its velocity,
 * resuming exactly where it left off. `PhysicsSystem.update` still runs, so
 * `UpdateWorldSprites` keeps syncing sprites to bodies; we slide the door bodies by
 * tweening a position object and writing it from the tween's `onUpdate`.
 *
 * ## Code vs. data (the hybrid split)
 *
 * - **JSON** (`assets/timelines/doorOpen.json`): the `physics.ramp` 0↔1 envelope (a
 *   numeric track on the `physics` actor) and the three named beats — `clunk`,
 *   `creak`, `settle` — as cues. This is the editable timing.
 * - **Code** (`decorate`): the parametric camera shakes, the per-body slide (an
 *   array tween with `onUpdate`), and the periodic dust puffs — all dynamic or
 *   actor-driven, so they stay in code and coexist on the same playhead.
 *
 * The JSON is authored in **frames** for the default 2500ms slide. The `physics`
 * actor is only in the stage map when a live world exists, so a debug "seek" with
 * no level loaded just previews the shakes (the ramp track compiles to nothing).
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
const SLIDE_AT = 1500; //   grind begins: mechanical sound, shake, body slide
const SLIDE_MS = 2500; //   slide duration (also the sustained rumble length)
const SLIDE_END = SLIDE_AT + SLIDE_MS; // = 4000
const PUFF_INTERVAL = 140; // cadence of dust puffs during the slide

/** Emit a debris puff at every (still-valid) door segment's current screen position. */
function dustSegments(bodyIds: b2BodyId[], count: number): void {
  for (const bodyId of bodyIds) {
    if (!b2Body_IsValid(bodyId)) continue;
    const { x, y } = BodyToScreen(bodyId);
    // intensity 0: the sequence owns the camera shake, so suppress the burst's own.
    vfx.play(brickBreak, { x, y, count, intensity: 0 });
  }
}

export const doorOpen = defineSequence<DoorOpenParams>({
  kind: 'sequence',
  id: 'doorOpen',
  priority: 'critical',
  prewarm: [brickBreak],
  // Defaults let the debug launcher (which passes no params) preview the shake + ramp
  // choreography with no bodies, instead of throwing on an undefined list.
  async build({ bodyIds = [], distance = 0, sound }: DoorOpenParams = {} as DoorOpenParams, ctx) {
    const { camera } = ctx;

    // Freeze by time-scale, not by unregistering the update — see the doc comment.
    // Present only when there's a live physics world; absent → the ramp track is a
    // harmless no-op (a debug seek with no level loaded is a shake-only preview).
    const gctx = getGameContext();
    const physics = gctx.systems.has(PhysicsSystem) ? gctx.systems.get(PhysicsSystem) : null;

    // Named actor the JSON's `physics.ramp` track resolves against.
    const stage = physics ? { physics } : {};

    // Named fire-once beats the JSON's cues resolve against.
    const hooks = {
      clunk: () => {
        sfx.playPitched(ASSETS.sounds_Rock_Impact_07, { speed: 0.7, volume: 0.7 });
        dustSegments(bodyIds, 10);
      },
      creak: () => {
        sfx.playPitched(sound ?? ASSETS.sounds_Chest_Open_Creak_3_1, { speed: 0.8, volume: 0.5 });
      },
      settle: () => {
        dustSegments(bodyIds, 8);
        sfx.playPitched(ASSETS.sounds_Rock_Impact_Small_10, { speed: 1.3, volume: 0.5 });
        sfx.play(ASSETS.sounds_Sell_Building_A, { volume: 0.5 });
      },
    };

    await playTimeline('doorOpen', {
      stage,
      hooks,
      ctx,
      decorate: (tl) => {
        // Parametric camera shakes — not keyframe data, so they stay in code.
        addShake(tl, camera, { intensity: 5, duration: 320 }, UNLOCK_AT); // sharp jolt as the lock gives
        addShake(tl, camera, { intensity: 1.5, frequency: 30, duration: SLIDE_MS, decay: false }, SLIDE_AT); // grind
        addShake(tl, camera, { intensity: 6, duration: 360 }, SLIDE_END); // settle thump

        // Slide each segment: tween a cloned position, write it to the (still-frozen)
        // body each frame. Array tween with per-body state — stays in code.
        const rot = new b2Rot(1, 0);
        for (const bodyId of bodyIds) {
          const rootPos = b2Body_GetPosition(bodyId).clone();
          tl.add(
            rootPos,
            {
              x: rootPos.x - distance,
              duration: SLIDE_MS,
              onUpdate: () => {
                if (b2Body_IsValid(bodyId)) b2Body_SetTransform(bodyId, rootPos, rot);
              },
            },
            SLIDE_AT,
          );
        }

        // Occasional dust puffs along the grinding door — dynamic per-segment cues.
        const puffs = Math.max(0, Math.floor(SLIDE_MS / PUFF_INTERVAL) - 1);
        for (let i = 0; i < puffs; i++) {
          const at = SLIDE_AT + (i + 1) * PUFF_INTERVAL;
          const segment = bodyIds[i % Math.max(1, bodyIds.length)];
          tl.call(() => {
            if (segment && b2Body_IsValid(segment)) {
              const { x, y } = BodyToScreen(segment);
              vfx.play(brickBreak, { x, y, count: 3, intensity: 0 });
            }
          }, at);
        }
      },
    });
  },
});
