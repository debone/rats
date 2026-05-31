/**
 * Persisted layout preferences for the timeline editor (Phase E).
 *
 * The panel's gutter width and overall height are user ergonomics, not document
 * data, so they live in `localStorage` rather than the `TimelineDoc`. Kept in a
 * tiny module with all the parsing/clamping in one place so the DOM view can read
 * and write them without touching storage directly (and so it's unit-testable
 * against an injected store).
 */

export interface EditorPrefs {
  /** Left label-gutter width in px (E1). */
  gutterW: number;
  /** Overall panel height in px (E4). */
  panelH: number;
}

export const PREFS_DEFAULTS: EditorPrefs = { gutterW: 170, panelH: 320 };

/** Clamp ranges, shared with the drag handlers so persisted values stay sane. */
export const GUTTER_MIN = 110;
export const GUTTER_MAX = 420;
export const PANEL_MIN = 200;
/** Upper bound is `min(PANEL_MAX_PX, 90vh)`; the px cap guards headless/odd viewports. */
export const PANEL_MAX_PX = 2000;

const STORAGE_KEY = 'vfx-tl-prefs';

/** Minimal storage surface so tests can inject a fake without a DOM. */
export interface PrefStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const memoryStore = (): PrefStore => {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
};

function defaultStore(): PrefStore {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // Access can throw in sandboxed/headless contexts; fall back to memory.
  }
  return memoryStore();
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Read prefs, merging defaults and clamping; never throws on malformed storage. */
export function loadPrefs(store: PrefStore = defaultStore()): EditorPrefs {
  let raw: Partial<EditorPrefs> = {};
  try {
    const json = store.getItem(STORAGE_KEY);
    if (json) raw = JSON.parse(json) as Partial<EditorPrefs>;
  } catch {
    raw = {};
  }
  const gutterW = Number.isFinite(raw.gutterW) ? clamp(raw.gutterW!, GUTTER_MIN, GUTTER_MAX) : PREFS_DEFAULTS.gutterW;
  const panelH = Number.isFinite(raw.panelH) ? clamp(raw.panelH!, PANEL_MIN, PANEL_MAX_PX) : PREFS_DEFAULTS.panelH;
  return { gutterW, panelH };
}

/** Merge a partial update into the stored prefs (clamped) and persist. Returns the merged value. */
export function savePrefs(patch: Partial<EditorPrefs>, store: PrefStore = defaultStore()): EditorPrefs {
  const merged = { ...loadPrefs(store), ...patch };
  const clamped: EditorPrefs = {
    gutterW: clamp(merged.gutterW, GUTTER_MIN, GUTTER_MAX),
    panelH: clamp(merged.panelH, PANEL_MIN, PANEL_MAX_PX),
  };
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(clamped));
  } catch {
    // Best-effort; persistence is a convenience, not a correctness requirement.
  }
  return clamped;
}
