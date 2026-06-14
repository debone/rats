import type { CueKey, CueTrack, Key, TimelineDoc, Track } from '../types';

/**
 * Pure mutation ops on a `TimelineDoc`. The editor calls these on every edit and
 * then rebuilds the timeline, so they're kept side-effect-free and unit-tested:
 * the DOM layer can stay untested while the actual document semantics (clamping,
 * key ordering, dedup) are verified here.
 *
 * All ops mutate the doc in place (the editor holds one doc reference that the
 * rebuild closure reads) and return it for convenience. Times are clamped to
 * `[0, duration]` and keys are kept sorted by time.
 */

const clampTime = (doc: TimelineDoc, t: number): number => Math.max(0, Math.min(doc.duration, Math.round(t)));

const sortKeys = (track: Track): void => {
  track.keys.sort((a, b) => a.time - b.time);
};

const sortCueKeys = (track: CueTrack): void => {
  track.keys.sort((a, b) => a.time - b.time);
};

/** Find the cue track for `hook`, creating an empty one if none exists yet. */
function ensureCueTrack(doc: TimelineDoc, hook: string): CueTrack {
  let track = doc.cues.find((c) => c.hook === hook);
  if (!track) {
    track = { hook, keys: [] };
    doc.cues.push(track);
  }
  return track;
}

export function setDuration(doc: TimelineDoc, duration: number): TimelineDoc {
  doc.duration = Math.max(1, Math.round(duration));
  // Pull any keys/cues that now sit past the end back onto it.
  for (const track of doc.tracks) {
    for (const key of track.keys) key.time = Math.min(key.time, doc.duration);
    sortKeys(track);
  }
  for (const cueTrack of doc.cues) {
    for (const key of cueTrack.keys) key.time = Math.min(key.time, doc.duration);
    sortCueKeys(cueTrack);
  }
  return doc;
}

export function retimeKey(doc: TimelineDoc, trackIndex: number, keyIndex: number, time: number): TimelineDoc {
  const track = doc.tracks[trackIndex];
  if (!track) return doc;
  const key = track.keys[keyIndex];
  if (!key) return doc;
  key.time = clampTime(doc, time);
  sortKeys(track);
  return doc;
}

export function setKeyValue(
  doc: TimelineDoc,
  trackIndex: number,
  keyIndex: number,
  value: number | string,
): TimelineDoc {
  const key = doc.tracks[trackIndex]?.keys[keyIndex];
  if (key) key.value = value;
  return doc;
}

export function setKeyEase(
  doc: TimelineDoc,
  trackIndex: number,
  keyIndex: number,
  ease: string | undefined,
): TimelineDoc {
  const key = doc.tracks[trackIndex]?.keys[keyIndex];
  if (!key) return doc;
  if (ease) key.ease = ease;
  else delete key.ease;
  return doc;
}

/**
 * Insert a key at `time`. Seeds its value from the track's value at that time —
 * the nearest existing key's value — so a freshly-added key doesn't snap the
 * property. Returns the inserted key's index after sorting.
 */
export function addKey(doc: TimelineDoc, trackIndex: number, time: number, value?: number | string): number {
  const track = doc.tracks[trackIndex];
  if (!track) return -1;
  const t = clampTime(doc, time);
  const seed = value ?? nearestValue(track, t) ?? 0;
  const key: Key = { time: t, value: seed };
  track.keys.push(key);
  sortKeys(track);
  return track.keys.indexOf(key);
}

export function deleteKey(doc: TimelineDoc, trackIndex: number, keyIndex: number): TimelineDoc {
  const track = doc.tracks[trackIndex];
  if (track) track.keys.splice(keyIndex, 1);
  return doc;
}

/** Add a new, empty track for `actor.property`. No-op if one already exists. */
export function addTrack(doc: TimelineDoc, actor: string, property: string): number {
  const existing = doc.tracks.findIndex((t) => t.actor === actor && t.property === property);
  if (existing >= 0) return existing;
  doc.tracks.push({ actor, property, keys: [{ time: 0, value: 0 }] });
  return doc.tracks.length - 1;
}

export function removeTrack(doc: TimelineDoc, trackIndex: number): TimelineDoc {
  doc.tracks.splice(trackIndex, 1);
  return doc;
}

/**
 * Insert a cue key for `hook` at `time` (creating the hook's track on first use).
 * Returns the inserted key's index after sorting. `value` is the argument handed to
 * the hook when it fires — left `undefined` for hooks that take no argument.
 */
export function addCueKey(doc: TimelineDoc, hook: string, time: number, value?: number | string): number {
  const track = ensureCueTrack(doc, hook);
  const key: CueKey = { time: clampTime(doc, time) };
  if (value !== undefined) key.value = value;
  track.keys.push(key);
  sortCueKeys(track);
  return track.keys.indexOf(key);
}

export function retimeCueKey(doc: TimelineDoc, hook: string, keyIndex: number, time: number): TimelineDoc {
  const track = doc.cues.find((c) => c.hook === hook);
  const key = track?.keys[keyIndex];
  if (!track || !key) return doc;
  key.time = clampTime(doc, time);
  sortCueKeys(track);
  return doc;
}

export function setCueKeyValue(
  doc: TimelineDoc,
  hook: string,
  keyIndex: number,
  value: number | string | undefined,
): TimelineDoc {
  const key = doc.cues.find((c) => c.hook === hook)?.keys[keyIndex];
  if (!key) return doc;
  if (value === undefined || value === '') delete key.value;
  else key.value = value;
  return doc;
}

/** Remove a cue key; drops the hook's track entirely once its last key is gone. */
export function deleteCueKey(doc: TimelineDoc, hook: string, keyIndex: number): TimelineDoc {
  const ti = doc.cues.findIndex((c) => c.hook === hook);
  if (ti < 0) return doc;
  doc.cues[ti].keys.splice(keyIndex, 1);
  if (doc.cues[ti].keys.length === 0) doc.cues.splice(ti, 1);
  return doc;
}

/** The value of the key at or before `time`, else the first key's value. */
function nearestValue(track: Track, time: number): number | string | undefined {
  if (track.keys.length === 0) return undefined;
  const sorted = [...track.keys].sort((a, b) => a.time - b.time);
  let v = sorted[0].value;
  for (const k of sorted) {
    if (k.time <= time) v = k.value;
    else break;
  }
  return v;
}
