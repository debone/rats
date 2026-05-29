import { DebugPanel, type FolderApi } from '@/core/devtools/debug-panel';
import type { Timeline } from 'animejs';

/** One display frame at 60fps, used by the step buttons. */
const FRAME_MS = 1000 / 60;

/**
 * A live, scrubbable debug session for a single sequence play.
 *
 * The motivation mirrors the Godot timeline: full understanding of an animation
 * by being able to *seek* it. Every timeline the sequence creates (via
 * `ctx.timeline()`) is paused and handed here; we expose a normalized progress
 * slider, frame step buttons, and transport controls.
 *
 * - Scrubbing / stepping seeks with callbacks muted, so tween state updates
 *   without re-firing the imperative `tl.call` beats (camera shakes, spawns).
 * - Play runs the timeline for real, so those beats DO fire — scrub to a moment
 *   and press Play to see the external effects in context.
 *
 * DEV-only: if there's no debug pane, this is inert.
 */
export class SequenceDebugSession {
  private folder: FolderApi | null = null;
  private timelines: Timeline[] = [];
  private readonly state = { progress: 0, playing: false };
  /**
   * Last progress value we wrote into the slider programmatically. The slider's
   * `change` event also fires on our own `refresh()`; comparing against this lets
   * us tell a real user drag from our echo, so playback never pauses itself.
   */
  private lastWritten = 0;
  private disposed = false;

  constructor(
    private readonly id: string,
    private readonly parent: FolderApi | null,
  ) {}

  /** Register a timeline created by the sequence. Pauses it and (re)builds the UI. */
  track(tl: Timeline): void {
    tl.pause();
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
        // Ignore the echo from our own refresh(); only a real drag scrubs.
        if (Math.abs(this.state.progress - this.lastWritten) < 1e-6) return;
        this.scrubTo(this.state.progress);
      });

    folder.addButton({ title: '⏮ -1f', label: 'step' }).on('click', () => this.step(-1));
    folder.addButton({ title: '+1f ⏭', label: 'step' }).on('click', () => this.step(+1));
    folder.addButton({ title: 'Play ▶' }).on('click', () => this.play());
    folder.addButton({ title: 'Pause ⏸' }).on('click', () => this.pause());
    folder.addButton({ title: 'Restart ↺' }).on('click', () => this.restart());
    // "Close" lets the sequence finish naturally so its own teardown runs.
    folder.addButton({ title: 'Close ✕' }).on('click', () => this.finish());
  }

  /** User dragged the slider: pause and seek to a normalized [0..1] position. */
  private scrubTo(progress: number): void {
    this.pause();
    this.seekAll(progress);
  }

  /** Advance/retreat by N frames, muted (stepping is inspection, not playback). */
  private step(frames: number): void {
    this.pause();
    const tl = this.timelines[0];
    const duration = tl?.duration ?? 0;
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
    if (this.state.playing) return;
    this.state.playing = true;
    this.timelines.forEach((tl) => tl.play());
    this.sync();
  }

  private pause(): void {
    this.state.playing = false;
    this.timelines.forEach((tl) => tl.pause());
  }

  private restart(): void {
    this.writeSlider(0);
    this.seekAll(0);
    this.play();
  }

  /** While playing, mirror the playhead back onto the slider so it tracks live. */
  private sync(): void {
    if (this.disposed || !this.state.playing) return;
    const tl = this.timelines[0];
    if (tl && tl.duration > 0) {
      this.writeSlider(Math.min(1, tl.currentTime / tl.duration));
    }
    requestAnimationFrame(() => this.sync());
  }

  /** Write a value to the slider, recording it so the change echo is ignored. */
  private writeSlider(progress: number): void {
    this.lastWritten = progress;
    this.state.progress = progress;
    this.folder?.refresh();
  }

  /** Complete the timelines so the sequence's own `await tl` resolves and it tears itself down. */
  finish(): void {
    this.timelines.forEach((tl) => tl.complete());
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.folder?.dispose();
    this.folder = null;
  }
}
