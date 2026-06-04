import type { TimelineDoc } from '../types';

/**
 * Crash-safety net for in-progress edits: the editor keeps a *draft* of the doc in
 * `localStorage` so a game-window reload (HMR on a code edit, or a manual refresh)
 * doesn't lose unsaved tweaks. Drafts are **offered for restore**, never applied
 * silently — they don't override the on-disk JSON until the author says so — and
 * they're cleared on Save and expire after a week so stale drafts don't accrue.
 */

const PREFIX = 'vfx-tl-draft:';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface Draft {
  savedAt: number;
  doc: TimelineDoc;
}

/** Minimal storage surface so tests can inject a fake without a DOM. */
export interface DraftStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const memoryStore = (): DraftStore => {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
};

function defaultStore(): DraftStore {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // Sandboxed/headless contexts can throw on access.
  }
  return memoryStore();
}

export function saveDraft(doc: TimelineDoc, store: DraftStore = defaultStore()): void {
  try {
    store.setItem(PREFIX + doc.id, JSON.stringify({ savedAt: Date.now(), doc } satisfies Draft));
  } catch {
    // Best-effort; a quota error shouldn't break editing.
  }
}

/** Load a draft for `id`, dropping (and returning null for) malformed or expired ones. */
export function loadDraft(id: string, store: DraftStore = defaultStore(), now = Date.now()): Draft | null {
  let raw: string | null = null;
  try {
    raw = store.getItem(PREFIX + id);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw) as Draft;
    if (!draft || typeof draft.savedAt !== 'number' || !draft.doc || draft.doc.id !== id) return null;
    if (now - draft.savedAt > TTL_MS) {
      clearDraft(id, store);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function clearDraft(id: string, store: DraftStore = defaultStore()): void {
  try {
    store.removeItem(PREFIX + id);
  } catch {
    // ignore
  }
}

/** True when the draft's doc differs from the (on-disk) reference doc. */
export function draftDiffers(draft: Draft, current: TimelineDoc): boolean {
  return JSON.stringify(draft.doc) !== JSON.stringify(current);
}
