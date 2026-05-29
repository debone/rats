import { DebugPanel, type FolderApi } from '@/core/devtools/debug-panel';
import type { Timeline } from 'animejs';

/** One display frame at 60fps, used by the step buttons. */
const FRAME_MS = 1000 / 60;

/**
 * A live, scrubbable debug session for a single sequence play.
 *
 * Mirrors the Godot timeline workflow: full understanding of an animation by
 * being able to *seek* it. Every timeline the sequence creates (via
 * `ctx.timeline()`) is paused and handed here; we expose a normalized progress
 * slider, a speed control, frame step buttons, and transport controls.
 *
 * - Scrubbing / stepping seeks with callbacks muted, so tween state updates
 *   without re-firing the imperative `tl.call` beats (camera shakes, spawns).
 * - Play runs the timeline for real, so those beats DO fire — scrub to a moment
 *   and press Play to see the external effects in context. `speed` slows the
 *   tweened choreography so you can actually watch it.
 *
 * Lifecycle: the panel persists after the animation completes so you can replay
 * and scrub. Natural completion is *withheld* from the sequence's `await tl`
 * (which would otherwise tear down the effect's display objects); the sequence is
 * resolved — and its teardown allowed to run — only when you click **Close**.
 *
 * DEV-only: if there's no debug pane, this is inert.
 */
export class SequenceDebugSession {
  private folder: FolderApi | null = null;
  private timelines: Timeline[] = [];
  private readonly state = { progress: 0, speed: 1 };
  private playing = false;
  /**
   * True while we are writing the slider ourselves (live playback mirror, step,
   * restart). tweakpane quantizes the value to the slider `step` and re-emits
   * `change` on refresh — a value-tolerance guard is unreliable against that, so
   * we gate on this explicit flag instead and only treat un-suppressed `change`
   * events as genuine user drags.
   */
  private suppressChange = false;
  private rafId = 0;
  private disposed = false;
  /** Resolvers captured from each timeline's `then`, fired on Close so the sequence's teardown runs. */
  private resolvers: Array<() => void> = [];

  constructor(
    private readonly id: string,
    private readonly parent: FolderApi | null,
  ) {}

  /**
   * Register a timeline created by the sequence. Pauses it, withholds its natural
   * completion from `await tl` (so the effect isn't torn down behind the still-open
   * panel), and (re)builds the UI.
   */
  track(tl: Timeline): void {
    tl.pause();

    // Intercept the thenable: capture the resolver instead of resolving on
    // completion. Fired later from finish()/Close so the sequence body's
    // post-`await tl` teardown only runs when the user is done inspecting.
    //
    // Resolve with `undefined`, NOT `tl`: `await tl` makes `onFulfilled` the
    // promise's own resolve, and resolving it with a thenable (tl) would re-enter
    // `then` and hang forever. The sequence body ignores the awaited value anyway.
    // (Cast through unknown — anime's `then` type is narrower than this shape, but
    // the thenable contract `await` relies on is identical.)
    tl.then = ((onFulfilled?: (value: unknown) => unknown) =>
      new Promise<void>((resolve) => {
        this.resolvers.push(() => {
          onFulfilled?.(undefined);
          resolve();
        });
      })) as unknown as Timeline['then'];

    this.timelines.push(tl);
    this.ensureUI();
  }

  private ensureUI(): void {
    if (this.folder || !DebugPanel.pane) return;
    const parent = this.parent ?? DebugPanel.pane;
    const folder = parent.addFolder({ title: `▶ ${this.id} (seek)`, expanded: true });
    this.folder = folder;

    folder
      .addBinding(this.state, 'progress', { min: 0, max: 1, step: 0.001 })
      .on('change', () => {
        // Only a genuine user drag scrubs; ignore our own programmatic writes.
        if (this.suppressChange) return;
        this.scrubTo(this.state.progress);
      });

    folder
      .addBinding(this.state, 'speed', { min: 0.05, max: 2, step: 0.05 })
      .on('change', () => this.applySpeed());

    folder.addButton({ title: '⏮ -1f', label: 'step' }).on('click', () => this.step(-1));
    folder.addButton({ title: '+1f ⏭', label: 'step' }).on('click', () => this.step(+1));
    folder.addButton({ title: 'Play ▶' }).on('click', () => this.play());
    folder.addButton({ title: 'Pause ⏸' }).on('click', () => this.pause());
    folder.addButton({ title: 'Restart ↺' }).on('click', () => this.restart());
    // "Close" resolves the sequence (running its teardown) and removes the panel.
    folder.addButton({ title: 'Close ✕' }).on('click', () => this.finish());
  }

  /** User dragged the slider: pause and seek to a normalized [0..1] position. */
  private scrubTo(progress: number): void {
    this.pause();
    this.seekAll(progress);
  }

  private applySpeed(): void {
    this.timelines.forEach((tl) => (tl.speed = this.state.speed));
  }

  /** Advance/retreat by N frames, muted (stepping is inspection, not playback). */
  private step(frames: number): void {
    this.pause();
    const duration = this.timelines[0]?.duration ?? 0;
    if (duration <= 0) return;
    const next = Math.min(1, Math.max(0, this.state.progress + (frames * FRAME_MS) / duration));
    this.seekAll(next);
    this.writeSlider(next);
  }

  /** Seek every tracked timeline to a normalized position, callbacks muted. */
  private seekAll(progress: number): void {
    for (const tl of this.timelines) {
      tl.seek(progress * tl.duration, true);
    }
  }

  private play(): void {
    if (this.playing) return;
    this.playing = true;
    // If we're at the end, restart from 0 so Play always does something.
    if (this.state.progress >= 1) this.seekAll(0);
    this.applySpeed();
    this.timelines.forEach((tl) => tl.play());
    this.startSync();
  }

  private pause(): void {
    this.playing = false;
    this.stopSync();
    this.timelines.forEach((tl) => tl.pause());
  }

  private restart(): void {
    this.writeSlider(0);
    this.seekAll(0);
    this.play();
  }

  /** Mirror the live playhead onto the slider each frame while playing. */
  private startSync(): void {
    this.stopSync();
    const tick = () => {
      if (this.disposed || !this.playing) return;
      const tl = this.timelines[0];
      if (tl && tl.duration > 0) {
        this.writeSlider(Math.min(1, tl.currentTime / tl.duration));
        if (tl.completed) {
          // Hold at the end — panel stays open for replay/scrub.
          this.playing = false;
          return;
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

  /** Write a value to the slider with the change-echo suppressed. */
  private writeSlider(progress: number): void {
    this.suppressChange = true;
    this.state.progress = progress;
    this.folder?.refresh();
    this.suppressChange = false;
  }

  /**
   * Done inspecting: complete the timelines, release the withheld `await tl`
   * (running the sequence's own teardown), and remove the panel.
   */
  finish(): void {
    this.timelines.forEach((tl) => tl.complete());
    const resolvers = this.resolvers;
    this.resolvers = [];
    resolvers.forEach((resolve) => resolve());
    this.dispose();
  }

  private dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopSync();
    this.folder?.dispose();
    this.folder = null;
  }
}
