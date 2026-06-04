import type { Cue, Key, TimelineDoc, Track } from '../types';

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

export function setDuration(doc: TimelineDoc, duration: number): TimelineDoc {
  doc.duration = Math.max(1, Math.round(duration));
  // Pull any keys/cues that now sit past the end back onto it.
  for (const track of doc.tracks) {
    for (const key of track.keys) key.time = Math.min(key.time, doc.duration);
    sortKeys(track);
  }
  for (const cue of doc.cues) cue.time = Math.min(cue.time, doc.duration);
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

export function moveCue(doc: TimelineDoc, cueIndex: number, time: number): TimelineDoc {
  const cue = doc.cues[cueIndex];
  if (cue) cue.time = clampTime(doc, time);
  return doc;
}

export function addCue(doc: TimelineDoc, hook: string, time: number): number {
  const cue: Cue = { time: clampTime(doc, time), hook };
  doc.cues.push(cue);
  return doc.cues.length - 1;
}

export function deleteCue(doc: TimelineDoc, cueIndex: number): TimelineDoc {
  doc.cues.splice(cueIndex, 1);
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
