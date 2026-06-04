import { describe, expect, it } from 'vitest';

import {
  GUTTER_MAX,
  GUTTER_MIN,
  loadPrefs,
  PANEL_MIN,
  PREFS_DEFAULTS,
  ROW_MAX,
  savePrefs,
  type PrefStore,
} from './editorPrefs';

function fakeStore(initial?: string): PrefStore {
  let value = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_k, v) => void (value = v),
  };
}

describe('editorPrefs', () => {
  it('returns defaults when storage is empty', () => {
    expect(loadPrefs(fakeStore())).toEqual(PREFS_DEFAULTS);
  });

  it('survives malformed JSON', () => {
    expect(loadPrefs(fakeStore('not json'))).toEqual(PREFS_DEFAULTS);
  });

  it('clamps out-of-range stored values', () => {
    const store = fakeStore(JSON.stringify({ gutterW: 9999, panelH: 10 }));
    const prefs = loadPrefs(store);
    expect(prefs.gutterW).toBe(GUTTER_MAX);
    expect(prefs.panelH).toBe(PANEL_MIN);
  });

  it('round-trips a saved patch, merging with existing', () => {
    const store = fakeStore();
    savePrefs({ gutterW: 200 }, store);
    expect(loadPrefs(store).gutterW).toBe(200);
    savePrefs({ panelH: 500 }, store);
    const prefs = loadPrefs(store);
    expect(prefs.gutterW).toBe(200); // preserved across the second save
    expect(prefs.panelH).toBe(500);
  });

  it('round-trips and clamps the row-height (vertical zoom)', () => {
    const store = fakeStore();
    savePrefs({ rowH: 80 }, store);
    expect(loadPrefs(store).rowH).toBe(80);
    expect(savePrefs({ rowH: 9999 }, store).rowH).toBe(ROW_MAX);
  });

  it('clamps on save below the minimum', () => {
    const store = fakeStore();
    const saved = savePrefs({ gutterW: GUTTER_MIN - 50 }, store);
    expect(saved.gutterW).toBe(GUTTER_MIN);
  });
});
