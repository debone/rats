import { ASSETS } from '@/assets';
import { sfx } from '@/core/audio/audio';
import { addShake } from '@/core/vfx/camera';
import { getGameContext } from '@/data/game-context';
import { PhysicsSystem } from '@/systems/physics/system';
import { BodyToScreen } from '@/systems/physics/WorldSprites';
import { b2Body_GetPosition, b2Body_IsValid, b2Body_SetTransform, b2Rot, type b2BodyId } from 'phaser-box2d';
import { defineSequence } from '../types';
import { vfx } from '../vfx';
import { brickBreak } from './brickBreak';

/**
 * A door unlocking and grinding open — a scripted "set-piece" moment.
 *
 * The whole game freezes for it, the door is dusted loose, it grinds open while
 * the rest of the world holds its breath, then everything snaps back to life.
 * That's the textbook case for a *sequence*: many beats (freeze, dust, slide,
 * spark, unfreeze) choreographed over a shared clock.
 *
 * ## Moving bodies while physics is frozen
 *
 * The hard part is sliding the door's bodies with the simulation stopped. The
 * trick is to freeze by zeroing the physics time-scale (`PhysicsSystem.ramp = 0`),
 * NOT by unregistering the physics update (`stop()`):
 *
 * - With `ramp = 0`, `b2World_Step` is called with `dt = 0` each frame, so the
 *   world doesn't advance — dynamic bodies (the ball) sit still and keep their
 *   velocities, resuming exactly where they left off on unfreeze.
 * - Crucially, `PhysicsSystem.update` still runs, so `UpdateWorldSprites` still
 *   syncs every sprite to its body transform each frame. We set the door bodies'
 *   transforms manually from this timeline's `onUpdate` (the anime.js engine ticks
 *   in the main loop, independent of physics), and the sprites follow.
 *
 * If we had used `stop()` the update handler would be gone and the sprites would
 * freeze with the bodies — the door would teleport, not glide.
 */
export interface DoorOpenParams {
  /** The door's segment bodies to slide. */
  bodyIds: b2BodyId[];
  /** Signed world-space distance to slide along x (caller bakes in direction). */
  distance: number;
  /** Slide duration in ms (default 1500). */
  duration?: number;
  /** Optional custom "grinding open" sound; falls back to a creak. */
  sound?: string;
}

// Timeline layout (ms)
const UNLOCK_AT = 0; //          freeze + dust burst + heavy unlock clunk
const SLIDE_AT = 450; //         grind begins: mechanical sound, shake, body slide
const PUFF_INTERVAL = 280; //    cadence of "occasional" dust puffs during the slide

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
  // Defaults let the debug panel's "seek ▶" (which passes no params) preview the
  // shake choreography with no bodies, instead of throwing on an undefined list.
  build({ bodyIds = [], distance = 0, duration = 1500, sound }: DoorOpenParams = {} as DoorOpenParams, { camera, timeline }) {
    const slideEnd = SLIDE_AT + duration;

    // Freeze by time-scale, not by unregistering the update — see the doc comment.
    // Guarded so a debug seek with no level loaded is a harmless shake preview.
    const ctx = getGameContext();
    const physics = ctx.systems.has(PhysicsSystem) ? ctx.systems.get(PhysicsSystem) : null;

    const tl = timeline();

    // --- Beat 1: freeze + unlock (t=0) ---
    // Fire-once kicks (frozen world, loud clunk, debris) — muted while scrubbing.
    tl.call(() => {
      if (physics) physics.ramp = 0;
      sfx.playPitched(ASSETS.sounds_Rock_Impact_07, { speed: 0.7, volume: 0.7 });
      dustSegments(bodyIds, 10);
    }, UNLOCK_AT);
    // A sharp jolt as the lock gives — timeline-native, seekable.
    addShake(tl, camera, { intensity: 5, duration: 320 }, UNLOCK_AT);

    // --- Beat 2: grind open (t=450 .. slideEnd) ---
    tl.call(() => {
      sfx.playPitched(sound ?? ASSETS.sounds_Chest_Open_Creak_3_1, { speed: 0.8, volume: 0.5 });
    }, SLIDE_AT);
    // Low sustained rumble for the length of the slide.
    addShake(tl, camera, { intensity: 1.5, frequency: 30, duration, decay: false }, SLIDE_AT);

    // Slide each segment: tween a cloned position, write it to the (still-frozen)
    // body each frame. The clone is mutated in place — no per-frame allocation.
    const rot = new b2Rot(1, 0);
    for (const bodyId of bodyIds) {
      const rootPos = b2Body_GetPosition(bodyId).clone();
      tl.add(
        rootPos,
        {
          x: rootPos.x - distance,
          duration,
          onUpdate: () => {
            if (b2Body_IsValid(bodyId)) b2Body_SetTransform(bodyId, rootPos, rot);
          },
        },
        SLIDE_AT,
      );
    }

    // Occasional dust puffs along the grinding door, spread across its segments.
    const puffs = Math.max(0, Math.floor(duration / PUFF_INTERVAL) - 1);
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

    // --- Beat 3: settle (t=slideEnd) ---
    // Final spark across the door, a confirming chime, then unfreeze the world.
    tl.call(() => {
      dustSegments(bodyIds, 8);
      sfx.playPitched(ASSETS.sounds_Rock_Impact_Small_10, { speed: 1.3, volume: 0.5 });
      sfx.play(ASSETS.sounds_Sell_Building_A, { volume: 0.5 });
      if (physics) physics.ramp = 1;
    }, slideEnd);
    addShake(tl, camera, { intensity: 6, duration: 360 }, slideEnd);
  },
});
