import { addShake } from '@/core/vfx/camera';
import { b2Body_GetPosition, b2Body_SetTransform, b2Rot, type b2BodyId } from 'phaser-box2d';
import { defineSequence } from '../types';

/**
 * A door opening: a sustained camera shake while N door segments slide open.
 *
 * A good example of why this is a *sequence*, not a burst: it's not one
 * instantaneous pop, it's a timed choreography — a 1.5s shake running alongside
 * the segments' slide, all on one clock. Authored on a timeline, so in the debug
 * panel the whole open can be scrubbed and slowed, shake and slide together.
 *
 * The slide drives physics bodies (`b2Body_SetTransform`) from an `onUpdate`
 * tween rather than its own ticker loop — same timeline-as-clock idea as the
 * camera fx, so a slowed/scrubbed timeline moves the bodies in lockstep with the
 * shake. Door geometry (segment count, width, direction) is resolved by the
 * caller into a single screen-space `distance`, keeping this effect generic.
 */
export interface DoorOpenParams {
  /** The door's segment bodies to slide. */
  bodyIds: b2BodyId[];
  /** Signed world-space distance to slide along x (caller bakes in direction). */
  distance: number;
  /** Open duration in ms (default 1500). */
  duration?: number;
}

export const doorOpen = defineSequence<DoorOpenParams>({
  kind: 'sequence',
  id: 'doorOpen',
  priority: 'normal',
  // Defaults let the debug panel's "seek ▶" (which passes no params) preview the
  // shake choreography with no bodies, instead of throwing on an undefined list.
  build({ bodyIds = [], distance = 0, duration = 1500 } = {} as DoorOpenParams, { camera, timeline }) {
    const tl = timeline();

    // Sustained shake for the whole open — timeline-native, so it honors the
    // debug speed slider and scrubs with the slide.
    addShake(tl, camera, { intensity: 1, frequency: 25, duration }, 0);

    // Slide each segment. Tween a cloned position object and write it back to the
    // body on update; the clone is mutated in place (no per-frame allocation).
    const rot = new b2Rot(1, 0);
    for (const bodyId of bodyIds) {
      const rootPos = b2Body_GetPosition(bodyId).clone();
      tl.add(
        rootPos,
        {
          x: rootPos.x - distance,
          duration,
          onUpdate: () => b2Body_SetTransform(bodyId, rootPos, rot),
        },
        0,
      );
    }
  },
});
