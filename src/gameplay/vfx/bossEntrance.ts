import { MIN_HEIGHT, MIN_WIDTH } from '@/consts';
import { addShake, addZoom } from '@/core/vfx/camera';
import { defineSequence } from '@/core/vfx/types';
import { vfx } from '@/core/vfx/vfx';
import { brickBreak } from './brickBreak';

/**
 * Reference sequence: a dramatic "boss entrance" flourish.
 *
 * Demonstrates the Phase 4 composition pattern — a sequence introduces no new
 * sequencer. It:
 *   - pre-warms the burst emitter it will use (`prewarm`) so no allocation hitch
 *     happens at the dramatic beat,
 *   - drives camera fx via `addZoom`/`addShake` — timeline-native so the debug
 *     panel scrubs and the speed slider slows them together with the tweens,
 *   - schedules burst triggers via `tl.call` (fire-once — scrub ignores them,
 *     Play executes them for real),
 *   - returns a promise, so callers can `await vfx.play(bossEntrance, …)` or
 *     `yield` it from a gameplay command.
 */
export interface BossEntranceParams {
  /** Screen-space focal point. Defaults to the viewport center. */
  x?: number;
  y?: number;
}

// Timeline layout (ms)
//   0   – zoom-in (400ms) + first shake (250ms)
// 150   – first debris burst
// 300   – flanking debris bursts
// 450   – big shake (400ms, ends at 850)
// 850   – zoom-out (500ms, ends at 1350)
const ZOOM_IN_END = 400;
const BIG_SHAKE_AT = 450;
const ZOOM_OUT_AT = BIG_SHAKE_AT + 400; // = 850

export const bossEntrance = defineSequence<BossEntranceParams>({
  kind: 'sequence',
  id: 'bossEntrance',
  priority: 'critical',
  prewarm: [brickBreak],
  async build({ x = MIN_WIDTH / 2, y = MIN_HEIGHT / 2 }, { camera, timeline }) {
    const tl = timeline();

    // Punch in toward the focal point — seekable zoom.
    addZoom(tl, camera, { scale: 1.3, duration: ZOOM_IN_END, origin: { x, y } }, 0);

    // First tremor fires with the zoom.
    addShake(tl, camera, { intensity: 6, duration: 250 }, 0);

    // Timed debris bursts — fire-once on real playback; scrub mutes them.
    tl.call(() => vfx.play(brickBreak, { x, y, count: 16, intensity: 0 }), 150);
    tl.call(() => vfx.play(brickBreak, { x: x - 40, y, count: 12, intensity: 0 }), 300);
    tl.call(() => vfx.play(brickBreak, { x: x + 40, y, count: 12, intensity: 0 }), 300);

    // Escalating shake on the main impact.
    addShake(tl, camera, { intensity: 10, duration: 400 }, BIG_SHAKE_AT);

    // Settle back to neutral once the shakes subside.
    addZoom(tl, camera, { scale: 1, duration: 500 }, ZOOM_OUT_AT);

    await tl;
  },
});
