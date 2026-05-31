import type { Timeline } from 'animejs';

import type { SequenceContext } from '../../types';
import { compile } from '../compile';
import { Transport } from '../Transport';
import type { Hooks, Stage, TimelineDoc } from '../types';

/**
 * The editor's stateful core, independent of the DOM: it owns the live
 * `TimelineDoc`, a {@link Transport}, and the live actors/hooks, and rebuilds the
 * compiled anime.js timeline whenever the doc changes.
 *
 * This is the piece that makes editing feel live: an edit mutates the in-memory
 * doc (via the pure ops in `ops.ts`) and calls {@link rebuild}, which retires the
 * old timeline and compiles a fresh one onto a new `ctx.timeline()` at the same
 * normalized playhead — so a retimed key or changed easing shows on the next
 * scrub against the running game, with no save/reload.
 *
 * It does NOT know how to render rows or diamonds; the DOM view reads `doc` and
 * drives `transport`, and re-renders when `onChange` fires.
 */
export class EditorSession {
  readonly transport = new Transport();
  /** Bumped on every rebuild so the view can re-render against the new doc. */
  onChange?: () => void;

  private rebuilding = false;

  constructor(
    public doc: TimelineDoc,
    private readonly stage: Stage,
    private readonly hooks: Hooks,
    private readonly ctx: Pick<SequenceContext, 'timeline'>,
    /**
     * Re-applies the code-driven tweens a sequence keeps in `build()` (camera
     * helpers, randomized/array loops) onto each freshly-built timeline, so they
     * keep scrubbing alongside the data tracks across recompiles.
     */
    private readonly decorate?: (tl: Timeline) => void,
  ) {}

  /** Actor names available to add tracks against (live stage map, minus functions). */
  actorNames(): string[] {
    return Object.keys(this.stage).filter((k) => {
      const v = this.stage[k];
      return v != null && typeof v === 'object';
    });
  }

  /** Hook names available to add cues against. */
  hookNames(): string[] {
    return Object.keys(this.hooks);
  }

  /**
   * Discard the current compiled timeline and build a new one from the doc,
   * preserving the normalized playhead so an edit doesn't jump the view. Called
   * once at start and after every doc mutation.
   */
  rebuild(): void {
    const progress = this.transport.duration > 0 ? this.transport.progress : 0;
    this.transport.retire();

    const tl = this.ctx.timeline(); // tracked by nothing else; we own it via transport
    this.decorate?.(tl);
    compile(this.doc, this.stage, this.hooks, tl);
    this.transport.track(tl);
    this.transport.seek(progress);

    if (!this.rebuilding) this.onChange?.();
  }

  /**
   * Run a doc edit then rebuild. Wraps the rebuild's `onChange` so a batch of
   * mutations triggers a single re-render.
   */
  edit(mutate: (doc: TimelineDoc) => void): void {
    this.rebuilding = true;
    mutate(this.doc);
    this.rebuild();
    this.rebuilding = false;
    this.onChange?.();
  }

  /** Tear down the transport (resolving the withheld sequence await → teardown). */
  finish(): void {
    this.transport.finish();
  }
}
