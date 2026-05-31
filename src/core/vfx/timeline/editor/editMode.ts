/**
 * The dev-only "open the editor for this sequence" signal.
 *
 * Kept in its own tiny, DOM-free module so it can be statically imported by both
 * the VFX debug panel (which sets it) and `load.ts` (which consumes it) without
 * pulling the DOM-heavy editor into the production bundle — the actual editor is
 * dynamic-imported behind an `import.meta.env.DEV` guard.
 */
let pendingEditId: string | null = null;

/** Mark that the next play of `id` should open the visual editor instead of running. */
export function requestTimelineEdit(id: string): void {
  pendingEditId = id;
}

/** True if the next play of `id` is requested to open in the editor. */
export function shouldEdit(id: string): boolean {
  return pendingEditId === id;
}

/** Consume the request for `id` (clears it), returning whether it was set. */
export function consumeEdit(id: string): boolean {
  if (pendingEditId !== id) return false;
  pendingEditId = null;
  return true;
}
