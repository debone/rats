import type { TimelineDoc } from '../types';

/**
 * Undo/redo for the timeline doc. Every mutation funnels through
 * `EditorSession.edit`, so history is just a snapshot stack: `record` the doc
 * before a mutation, then `undo`/`redo` swap whole-doc snapshots. Docs are small
 * plain data, so structured clones are cheap and there's no per-op bookkeeping.
 */

const LIMIT = 50;

const clone = (doc: TimelineDoc): TimelineDoc => structuredClone(doc);

export class DocHistory {
  private undoStack: TimelineDoc[] = [];
  private redoStack: TimelineDoc[] = [];

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Snapshot `current` as an undo point (call *before* mutating it). Clears redo. */
  record(current: TimelineDoc): void {
    this.undoStack.push(clone(current));
    if (this.undoStack.length > LIMIT) this.undoStack.shift();
    this.redoStack = [];
  }

  /** Doc to revert to, moving `current` onto the redo stack. Null if nothing to undo. */
  undo(current: TimelineDoc): TimelineDoc | null {
    const prev = this.undoStack.pop();
    if (!prev) return null;
    this.redoStack.push(clone(current));
    return prev;
  }

  /** Doc to re-apply, moving `current` onto the undo stack. Null if nothing to redo. */
  redo(current: TimelineDoc): TimelineDoc | null {
    const next = this.redoStack.pop();
    if (!next) return null;
    this.undoStack.push(clone(current));
    return next;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
