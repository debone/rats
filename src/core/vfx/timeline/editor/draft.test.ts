import { describe, expect, it } from 'vitest';

import type { TimelineDoc } from '../types';
import { clearDraft, draftDiffers, type DraftStore, loadDraft, saveDraft } from './draft';

function fakeStore(): DraftStore {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

const doc = (over: Partial<TimelineDoc> = {}): TimelineDoc => ({
  id: 'seq',
  duration: 60,
  tracks: [],
  cues: [],
  ...over,
});

describe('draft', () => {
  it('round-trips a saved draft', () => {
    const store = fakeStore();
    const d = doc({ duration: 99 });
    saveDraft(d, store);
    const loaded = loadDraft('seq', store);
    expect(loaded?.doc.duration).toBe(99);
    expect(typeof loaded?.savedAt).toBe('number');
  });

  it('returns null when there is no draft', () => {
    expect(loadDraft('seq', fakeStore())).toBeNull();
  });

  it('drops expired drafts', () => {
    const store = fakeStore();
    saveDraft(doc(), store);
    // 8 days later → expired.
    expect(loadDraft('seq', store, Date.now() + 8 * 24 * 60 * 60 * 1000)).toBeNull();
  });

  it('ignores a draft whose id does not match', () => {
    const store = fakeStore();
    store.setItem('vfx-tl-draft:seq', JSON.stringify({ savedAt: Date.now(), doc: doc({ id: 'other' }) }));
    expect(loadDraft('seq', store)).toBeNull();
  });

  it('survives malformed JSON', () => {
    const store = fakeStore();
    store.setItem('vfx-tl-draft:seq', '{not json');
    expect(loadDraft('seq', store)).toBeNull();
  });

  it('clears a draft', () => {
    const store = fakeStore();
    saveDraft(doc(), store);
    clearDraft('seq', store);
    expect(loadDraft('seq', store)).toBeNull();
  });

  it('detects whether a draft differs from the current doc', () => {
    const d = doc({ duration: 60 });
    expect(draftDiffers({ savedAt: 0, doc: doc({ duration: 60 }) }, d)).toBe(false);
    expect(draftDiffers({ savedAt: 0, doc: doc({ duration: 42 }) }, d)).toBe(true);
  });
});
