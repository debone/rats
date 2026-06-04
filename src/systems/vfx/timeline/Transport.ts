import type { Timeline } from 'animejs';
import { FRAME_MS } from './time';

/**
 * The reusable playback core for a set of anime.js timelines: seek / step /
 * speed / play / pause, a normalized [0..1] playhead, muted-callback scrubbing,
 * and the thenable interception that withholds a timeline's natural completion.
 *
 * Extracted from `SequenceDebugSession` so the tweakpane debug panel and the DOM
 * timeline editor drive the *same* playhead the exact same way — neither owns the
 * transport logic, both wrap it. The transport is UI-agnostic: it reports the
 * playhead via `onProgress` and end-of-play via `onComplete`, and knows nothing
 * about sliders, diamonds, or folders.
 *
 * Scrubbing/stepping seek with callbacks muted (`tl.seek(t, true)`), so tween
 * state updates without re-firing the fire-once `tl.call` beats (camera shakes,
 * particle spawns, sfx). Those fire only during real `play()`.
 */
export class Transport {
  private timelines: Timeline[] = [];
  /** Resolvers captured from each timeline's `then`, fired on `finish()`. */
  private resolvers: Array<() => void> = [];
  private playing = false;
  private rafId = 0;
  private disposed = false;
  private speedValue = 1;
  /**
   * The normalized position where the current play started — the "repeat anchor".
   * Pausing or finishing playback returns the playhead here so pressing Play again
   * replays the same span without scrubbing back (the repeat-a-sequence workflow).
   */
  private playAnchor = 0;
  /** When true, playback restarts from the anchor on completion instead of stopping. */
  private looping = false;

  /** Notified with normalized progress [0..1] on every seek and each playing frame. */
  onProgress?: (progress: number) => void;
  /** Notified once when real playback reaches the end (the playhead holds at 1). */
  onComplete?: () => void;

  /** Normalized playhead [0..1] of the lead timeline. 0 when there's nothing to play. */
  get progress(): number {
    const tl = this.timelines[0];
    if (!tl || tl.duration <= 0) return 0;
    return Math.min(1, Math.max(0, tl.currentTime / tl.duration));
  }

  /** Duration in ms of the lead timeline. */
  get duration(): number {
    return this.timelines[0]?.duration ?? 0;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  get speed(): number {
    return this.speedValue;
  }

  get isLooping(): boolean {
    return this.looping;
  }

  setLoop(on: boolean): void {
    this.looping = on;
  }

  /**
   * Adopt a timeline: pause it, withhold its natural completion from `await tl`
   * (so the sequence's post-await teardown doesn't run behind a still-open
   * panel/editor), and apply the current speed.
   *
   * Intercept the thenable instead of resolving on completion — the captured
   * resolver is fired later from `finish()`. Resolve with `undefined`, NOT `tl`:
   * `await tl` makes `onFulfilled` the promise's own resolve, and resolving it
   * with a thenable (tl) would re-enter `then` and hang forever. (Cast through
   * unknown — anime's `then` type is narrower than this shape, but the thenable
   * contract `await` relies on is identical.)
   */
  track(tl: Timeline): void {
    tl.pause();
    tl.speed = this.speedValue;

    tl.then = ((onFulfilled?: (value: unknown) => unknown) =>
      new Promise<void>((resolve) => {
        this.resolvers.push(() => {
          onFulfilled?.(undefined);
          resolve();
        });
      })) as unknown as Timeline['then'];

    this.timelines.push(tl);
  }

  /**
   * Drop all tracked timelines without resolving their awaits (the awaits carry
   * over to whatever is tracked next). Used by the editor's live-recompile: the
   * doc changed, so the old compiled timeline is discarded and a fresh one built.
   * Resolvers are preserved so the sequence body still completes exactly once,
   * when the editor is finally closed.
   */
  retire(): void {
    this.stopSync();
    this.playing = false;
    for (const tl of this.timelines) {
      tl.pause();
      // anime v4 timelines stay registered with the engine; revert() unregisters
      // so repeated recompiles don't leak paused timelines. Guarded — older/typed
      // shapes may not expose it.
      (tl as unknown as { revert?: () => void }).revert?.();
    }
    this.timelines = [];
  }

  /** User scrub: pause and seek every timeline to a normalized position, muted. */
  seek(progress: number): void {
    this.halt();
    this.seekAll(progress);
    this.onProgress?.(this.progress);
  }

  /** Advance/retreat by N frames, muted (stepping is inspection, not playback). */
  step(frames: number): void {
    this.halt();
    if (this.duration <= 0) return;
    const next = Math.min(1, Math.max(0, this.progress + (frames * FRAME_MS) / this.duration));
    this.seekAll(next);
    this.onProgress?.(this.progress);
  }

  setSpeed(speed: number): void {
    this.speedValue = speed;
    this.timelines.forEach((tl) => (tl.speed = speed));
  }

  play(): void {
    if (this.playing || this.timelines.length === 0) return;
    // Anchor the repeat point at where playback begins; parked-at-end starts over.
    this.playAnchor = this.progress >= 1 ? 0 : this.progress;
    this.playing = true;
    if (this.progress >= 1) this.seekAll(0);
    this.setSpeed(this.speedValue);
    this.timelines.forEach((tl) => tl.play());
    this.startSync();
  }

  /**
   * User pause: stop, then return the playhead to the repeat anchor so the next
   * Play replays the same span. (Stepping/scrubbing use {@link halt}, which leaves
   * the playhead where the explicit seek puts it.)
   */
  pause(): void {
    this.halt();
    this.seekAll(this.playAnchor);
    this.onProgress?.(this.progress);
  }

  /** Stop playback without moving the playhead (internal; seek/step seek after). */
  private halt(): void {
    this.playing = false;
    this.stopSync();
    this.timelines.forEach((tl) => tl.pause());
  }

  restart(): void {
    this.seekAll(0);
    this.onProgress?.(0);
    this.play();
  }

  /**
   * Done inspecting: complete the timelines (so any held-back final state lands),
   * release every withheld `await tl` (running the sequence's own teardown), and
   * stop syncing. The owner disposes its UI separately.
   */
  finish(): void {
    this.timelines.forEach((tl) => tl.complete());
    const resolvers = this.resolvers;
    this.resolvers = [];
    resolvers.forEach((resolve) => resolve());
    this.dispose();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopSync();
  }

  /** Seek every tracked timeline to a normalized position, callbacks muted. */
  private seekAll(progress: number): void {
    for (const tl of this.timelines) {
      tl.seek(progress * tl.duration, true);
    }
  }

  /** Mirror the live playhead via `onProgress` each frame while playing. */
  private startSync(): void {
    this.stopSync();
    const tick = () => {
      if (this.disposed || !this.playing) return;
      const tl = this.timelines[0];
      if (tl && tl.duration > 0) {
        this.onProgress?.(this.progress);
        if (tl.completed) {
          if (this.looping) {
            // Restart the same span (anchor→end) and keep playing.
            this.seekAll(this.playAnchor);
            this.timelines.forEach((t) => t.play());
          } else {
            // Hold at the end so the final pose stays inspectable; the next Play
            // (parked at the end) restarts from 0. Pausing returns to the anchor.
            this.playing = false;
            this.onComplete?.();
            return;
          }
        }
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stopSync(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }
}
