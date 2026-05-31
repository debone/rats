import type { Timeline } from 'animejs';

import type { SequenceContext } from '../types';
import { compile } from './compile';
import type { Hooks, Stage, TimelineDoc } from './types';

/**
 * Fetch a choreography doc. Mirrors the cutscene fetch — the JSON lives in
 * `assets/timelines/<id>.json` (committed source) and is copied to
 * `public/assets/timelines/` for runtime by the asset pipeline.
 */
export async function load(id: string): Promise<TimelineDoc> {
  const res = await fetch(`assets/timelines/${id}.json`);
  if (!res.ok) throw new Error(`[timeline] failed to load "${id}": ${res.status} ${res.statusText}`);
  return (await res.json()) as TimelineDoc;
}

export interface PlayTimelineArgs {
  /** Named actors the doc's tracks resolve against. */
  stage: Stage;
  /** Named fire-once closures the doc's cues resolve against. */
  hooks: Hooks;
  /** Only `timeline()` is needed; pass the full `SequenceContext` from `build`. */
  ctx: Pick<SequenceContext, 'timeline'>;
  /**
   * Add code-driven tweens to the *same* timeline before the JSON tracks compile
   * onto it — procedural/array/onUpdate tweens and parametric camera helpers that
   * stay in code. They scrub alongside the data-driven tracks.
   */
  decorate?: (tl: Timeline) => void;
}

/**
 * The data-driven counterpart to hand-authoring a sequence: load the doc, make a
 * tracked `ctx.timeline()` (so `SequenceDebug`/the editor drive the same
 * playhead), let the caller decorate it with code tweens, compile the doc onto
 * it, and await completion.
 */
export async function playTimeline(id: string, { stage, hooks, ctx, decorate }: PlayTimelineArgs): Promise<void> {
  const doc = await load(id);
  const tl = ctx.timeline();
  decorate?.(tl);
  compile(doc, stage, hooks, tl);
  await tl;
}
