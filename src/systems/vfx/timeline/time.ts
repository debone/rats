/**
 * Timeline times are authored in **frames**, not milliseconds, so a sequence is
 * defined by *how many frames* each beat lasts and plays at the same wall-clock
 * speed on any display (the anime.js engine advances by real elapsed time, so a
 * fixed frame→ms reference keeps 60Hz and 120Hz identical). Keyframe values land
 * on whole frames, which also makes the editor's numbers small and snappable.
 *
 * `FPS` is the authoring reference (60). The compiler converts frames→ms with
 * {@link framesToMs}; the editor reads/writes frames directly.
 */
export const FPS = 60;

/** Milliseconds per authored frame at the reference {@link FPS}. */
export const FRAME_MS = 1000 / FPS;

/** Authored frames → playback milliseconds (for the compiler / anime.js). */
export function framesToMs(frames: number): number {
  return frames * FRAME_MS;
}

/** Playback milliseconds → authored frames (rounded; for migrating ms data). */
export function msToFrames(ms: number): number {
  return Math.round(ms / FRAME_MS);
}
