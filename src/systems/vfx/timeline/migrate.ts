import type { CueKey, CueTrack, TimelineDoc } from './types';

/**
 * Bring a loaded doc up to the current schema. The only migration so far: cues used
 * to be a flat list of `{ time, hook }` beats (all packed into one editor lane); they
 * are now grouped into per-hook {@link CueTrack}s with valued keys, so each cue gets
 * its own lane and can pass an argument to its hook. Old committed JSON and stale
 * localStorage drafts still carry the flat shape, so we normalize on load.
 *
 * Idempotent and in-place (returns the same doc): a doc already in the grouped shape
 * passes through untouched.
 */
export function migrateDoc(doc: TimelineDoc): TimelineDoc {
  const raw: unknown = doc.cues;
  if (!Array.isArray(raw)) {
    doc.cues = [];
    return doc;
  }
  // Flat beats are objects with a `hook` but no `keys`; grouped tracks have `keys`.
  const isFlat = raw.some((c) => c != null && typeof c === 'object' && 'hook' in c && !('keys' in c));
  if (!isFlat) return doc;

  const byHook = new Map<string, CueTrack>();
  const order: string[] = [];
  const track = (hook: string): CueTrack => {
    let t = byHook.get(hook);
    if (!t) {
      t = { hook, keys: [] };
      byHook.set(hook, t);
      order.push(hook);
    }
    return t;
  };

  for (const entry of raw as Array<Record<string, unknown>>) {
    if (entry == null || typeof entry !== 'object') continue;
    const hook = String(entry.hook ?? '');
    if (Array.isArray(entry.keys)) {
      // Already grouped (a mixed doc): fold its keys in.
      for (const k of entry.keys as CueKey[]) track(hook).keys.push(k);
    } else {
      const key: CueKey = { time: Number(entry.time) || 0 };
      if (entry.value !== undefined) key.value = entry.value as number | string;
      track(hook).keys.push(key);
    }
  }

  for (const t of byHook.values()) t.keys.sort((a, b) => a.time - b.time);
  doc.cues = order.map((h) => byHook.get(h) as CueTrack);
  return doc;
}
