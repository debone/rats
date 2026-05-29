import { DebugPanel, type FolderApi } from '@/core/devtools/debug-panel';
import type { Timeline } from 'animejs';

/**
 * A live, scrubbable debug session for a single sequence play.
 *
 * The motivation mirrors the Godot timeline: full understanding of an animation
 * by being able to *seek* it. Every timeline the sequence creates (via
 * `ctx.timeline()`) is paused and handed here; we expose a normalized progress
 * slider plus transport controls in the debug panel. Dragging the slider seeks
 * the playhead with callbacks muted, so every tween updates without re-firing
 * the imperative `tl.call` beats (camera shakes, burst spawns) on the way.
 *
 * DEV-only: if there's no debug pane, this is inert.
 */
export class SequenceDebugSession {
  private folder: FolderApi | null = null;
  private timelines: Timeline[] = [];
  private readonly state = { progress: 0, playing: false };
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
      .on('change', () => this.seek(this.state.progress));

    folder.addButton({ title: 'Play' }).on('click', () => this.play());
    folder.addButton({ title: 'Pause' }).on('click', () => this.pause());
    folder.addButton({ title: 'Restart' }).on('click', () => this.restart());
    // "Close" lets the sequence finish naturally so its own teardown runs.
    folder.addButton({ title: 'Close' }).on('click', () => this.finish());
  }

  /** Scrub every tracked timeline to a normalized [0..1] position, callbacks muted. */
  private seek(progress: number): void {
    this.pause();
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
    this.state.progress = 0;
    this.seek(0);
    this.play();
  }

  /** While playing, mirror the playhead back onto the slider so it tracks live. */
  private sync(): void {
    if (this.disposed || !this.state.playing) return;
    const tl = this.timelines[0];
    if (tl && tl.duration > 0) {
      this.state.progress = Math.min(1, tl.currentTime / tl.duration);
      this.folder?.refresh();
    }
    requestAnimationFrame(() => this.sync());
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
