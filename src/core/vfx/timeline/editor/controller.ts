import type { Timeline } from 'animejs';

import type { SequenceContext } from '../../types';
import type { Hooks, Stage, TimelineDoc } from '../types';
import { EditorSession } from './EditorSession';
import { saveTimeline } from './save';
import { ensureEditorStyles } from './styles';
import { TimelineEditor } from './TimelineEditor';

/** The single live editor, so re-opening replaces rather than stacks overlays. */
let active: { editor: TimelineEditor; resolve: () => void } | null = null;

export interface OpenArgs {
  doc: TimelineDoc;
  stage: Stage;
  hooks: Hooks;
  ctx: Pick<SequenceContext, 'timeline'>;
  decorate?: (tl: Timeline) => void;
}

/**
 * Mount the DOM timeline editor for a sequence and resolve when it's closed.
 *
 * Wires the three pieces together: an {@link EditorSession} (live doc + transport
 * + recompile), the {@link TimelineEditor} DOM view over it, and the save client.
 * The returned promise is what the sequence body awaits (in place of `await tl`),
 * so the effect's actors stay alive until the editor closes — then teardown runs.
 */
export function openTimelineEditor(_id: string, { doc, stage, hooks, ctx, decorate }: OpenArgs): Promise<void> {
  ensureEditorStyles();
  // Replace any existing editor (and let its sequence finish/teardown).
  active?.editor.destroy();
  active?.resolve();
  active = null;

  return new Promise<void>((resolve) => {
    const session = new EditorSession(doc, stage, hooks, ctx, decorate);
    session.rebuild();

    const editor = new TimelineEditor(
      session,
      () => void saveTimeline(session.doc),
      () => {
        session.finish(); // resolve the withheld sequence await → teardown
        editor.destroy();
        if (active?.editor === editor) active = null;
        resolve();
      },
    );

    active = { editor, resolve };
  });
}
