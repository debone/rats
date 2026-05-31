import type { TimelineDoc } from '../types';

/**
 * Persist a timeline doc to disk via the dev server's save endpoint
 * (`POST /api/save-timeline`, registered in `devtools/config.dev.mjs`). The
 * server writes both the committed source (`assets/timelines/<id>.json`) and the
 * served runtime copy (`public/assets/timelines/<id>.json`) so a hard-reload
 * round-trips the edited timing.
 *
 * DEV-only — there is no endpoint in a production build.
 */
export async function saveTimeline(doc: TimelineDoc): Promise<boolean> {
  try {
    const res = await fetch('/api/save-timeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doc, null, 2),
    });
    if (!res.ok) {
      console.error(`[timeline] save failed: ${res.status} ${res.statusText}`);
      return false;
    }
    console.log(`[timeline] saved "${doc.id}"`);
    return true;
  } catch (err) {
    console.error('[timeline] save error', err);
    return false;
  }
}
