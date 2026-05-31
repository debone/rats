import { DebugPanel, type FolderApi } from '@/core/devtools/debug-panel';
import type { Timeline } from 'animejs';
import { Transport } from './timeline/Transport';

/**
 * A live, scrubbable debug session for a single sequence play.
 *
 * Mirrors the Godot timeline workflow: full understanding of an animation by
 * being able to *seek* it. Every timeline the sequence creates (via
 * `ctx.timeline()`) is paused and handed here; we expose a normalized progress
 * slider, a speed control, frame step buttons, and transport controls.
 *
 * The playback mechanics — seek/step/speed, muted-callback scrubbing, the
 * thenable interception that withholds completion — live in the shared
 * {@link Transport} core, which the DOM timeline editor reuses. This class is
 * just the tweakpane *view* over that core:
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
  private readonly transport = new Transport();
  private readonly state = { progress: 0, speed: 1 };
  /**
   * True while we are writing the slider ourselves (live playback mirror, step,
   * restart). tweakpane quantizes the value to the slider `step` and re-emits
   * `change` on refresh — a value-tolerance guard is unreliable against that, so
   * we gate on this explicit flag instead and only treat un-suppressed `change`
   * events as genuine user drags.
   */
  private suppressChange = false;

  constructor(
    private readonly id: string,
    private readonly parent: FolderApi | null,
  ) {
    // Mirror the live playhead onto the slider as the transport advances it.
    this.transport.onProgress = (progress) => this.writeSlider(progress);
  }

  /**
   * Register a timeline created by the sequence. The transport pauses it and
   * withholds its natural completion from `await tl` (so the effect isn't torn
   * down behind the still-open panel); we (re)build the UI.
   */
  track(tl: Timeline): void {
    this.transport.track(tl);
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
        this.transport.seek(this.state.progress);
      });

    folder
      .addBinding(this.state, 'speed', { min: 0.05, max: 2, step: 0.05 })
      .on('change', () => this.transport.setSpeed(this.state.speed));

    folder.addButton({ title: '⏮ -1f', label: 'step' }).on('click', () => this.transport.step(-1));
    folder.addButton({ title: '+1f ⏭', label: 'step' }).on('click', () => this.transport.step(+1));
    folder.addButton({ title: 'Play ▶' }).on('click', () => this.transport.play());
    folder.addButton({ title: 'Pause ⏸' }).on('click', () => this.transport.pause());
    folder.addButton({ title: 'Restart ↺' }).on('click', () => this.transport.restart());
    // "Close" resolves the sequence (running its teardown) and removes the panel.
    folder.addButton({ title: 'Close ✕' }).on('click', () => this.finish());
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
    this.transport.finish();
    this.dispose();
  }

  private dispose(): void {
    this.transport.dispose();
    this.folder?.dispose();
    this.folder = null;
  }
}
