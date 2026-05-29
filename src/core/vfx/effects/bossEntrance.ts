import { MIN_HEIGHT, MIN_WIDTH } from '@/consts';
import { shake } from '@/core/camera/effects/shake';
import { zoom } from '@/core/camera/effects/zoom';
import { defineSequence } from '../types';
import { vfx } from '../vfx';
import { brickBreak } from './brickBreak';

/**
 * Reference sequence: a dramatic "boss entrance" flourish.
 *
 * Demonstrates the Phase 4 composition pattern — a sequence introduces no new
 * sequencer. It:
 *   - pre-warms the burst emitter it will use (`prewarm`) so no allocation hitch
 *     happens at the dramatic beat,
 *   - drives camera fx (`zoom`/`shake`) directly,
 *   - schedules timed beats on an anime.js timeline (the same runtime the cutscene
 *     player uses), each beat firing an existing VFX by reference,
 *   - returns a promise, so callers can `await vfx.play(bossEntrance, …)` or
 *     `yield` it from a gameplay command.
 *
 * A sequence can also weave in authored Godot cutscenes via `ctx.cutscene(name)`.
 */
export interface BossEntranceParams {
  /** Screen-space focal point. Defaults to the viewport center. */
  x?: number;
  y?: number;
}

export const bossEntrance = defineSequence<BossEntranceParams>({
  kind: 'sequence',
  id: 'bossEntrance',
  priority: 'critical',
  prewarm: [brickBreak],
  async build({ x = MIN_WIDTH / 2, y = MIN_HEIGHT / 2 }, { camera, timeline }) {
    // Punch in toward the focal point.
    zoom(camera, { scale: 1.3, duration: 400, origin: { x, y } });

    // Timed beats. `intensity: 0` on the bursts suppresses their built-in shake so
    // the sequence owns the camera, layering its own escalating shakes.
    const tl = timeline();
    tl.call(() => shake(camera, { intensity: 6, duration: 250 }), 0);
    tl.call(() => vfx.play(brickBreak, { x, y, count: 16, intensity: 0 }), 150);
    tl.call(() => vfx.play(brickBreak, { x: x - 40, y, count: 12, intensity: 0 }), 300);
    tl.call(() => vfx.play(brickBreak, { x: x + 40, y, count: 12, intensity: 0 }), 300);
    tl.call(() => shake(camera, { intensity: 10, duration: 400 }), 450);
    await tl;

    // Settle back to neutral.
    await zoom(camera, { scale: 1, duration: 500 });
  },
});
