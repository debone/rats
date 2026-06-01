import type { Timeline } from 'animejs';

import type { SequenceContext } from '../../types';
import type { Hooks, Stage, TimelineDoc } from '../types';
import { EditorSession } from './EditorSession';
import { saveTimeline } from './save';
import { TimelineEditor } from './TimelineEditor';

/** The single live editor, so re-opening replaces rather than stacks overlays. */
let active: { resolve: () => void } | null = null;

export interface OpenArgs {
  doc: TimelineDoc;
  stage: Stage;
  hooks: Hooks;
  ctx: Pick<SequenceContext, 'timeline'>;
  decorate?: (tl: Timeline) => void;
}

/**
 * Try to open the editor in a real popup window so it sits off the game screen and
 * its keystrokes never reach the game's window listeners. Returns null if the popup
 * is blocked (no user activation / blocker), in which case the caller docks it in
 * the host page instead.
 */
function openPopup(id: string): Window | null {
  try {
    const w = window.open('', '', 'popup=yes,width=960,height=420,left=60,top=60');
    if (!w) return null;
    w.document.title = `VFX Timeline — ${id}`;
    const body = w.document.body;
    body.style.margin = '0';
    body.style.background = '#12121c';
    return w;
  } catch {
    return null;
  }
}

/**
 * Mount the timeline editor for a sequence and resolve when it's closed.
 *
 * Wires the three pieces together: an {@link EditorSession} (live doc + transport
 * + recompile), the {@link TimelineEditor} view over it, and the save client. The
 * returned promise is what the sequence body awaits (in place of `await tl`), so the
 * effect's actors stay alive until the editor closes — then teardown runs.
 *
 * Preferred host is a popup window (off the game screen, keyboard-isolated); if the
 * browser blocks it we fall back to the docked in-page overlay. Closing the popup
 * (its window) tears the session down just like the editor's own ✕.
 */
export function openTimelineEditor(id: string, { doc, stage, hooks, ctx, decorate }: OpenArgs): Promise<void> {
  // Replace any existing editor (and let its sequence finish/teardown).
  active?.resolve();
  active = null;

  return new Promise<void>((resolve) => {
    const session = new EditorSession(doc, stage, hooks, ctx, decorate);
    session.rebuild();

    const popup = openPopup(id);

    let closed = false;
    const finishAll = (): void => {
      if (closed) return;
      closed = true;
      session.finish(); // resolve the withheld sequence await → teardown
      editor.destroy();
      popup?.removeEventListener('beforeunload', finishAll);
      popup?.close();
      if (active === entry) active = null;
      resolve();
    };

    const editor = new TimelineEditor(session, () => saveTimeline(session.doc), finishAll, popup ?? undefined);

    // Closing the popup window (its OS chrome) tears the session down too.
    popup?.addEventListener('beforeunload', finishAll);

    const entry = { resolve: finishAll };
    active = entry;
  });
}
