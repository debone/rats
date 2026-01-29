import { signal } from './signals';
import type { Signal } from './types';

export type ContainsKey<T> = T & { key: string };

export type BatchChange<T> = {
  adds: { key: string; item: Signal<T>; index: number }[];
  removes: { key: string; item: Signal<T>; prevIndex: number }[];
  moves: { key: string; item: Signal<T>; from: number; to: number }[];
};

export class SignalCollection<T> {
  private items: Signal<T>[] = [];
  private keyToIndex = new Map<string, number>();
  private getKey: (item: T, index: number) => string;

  onAdd = signal<{ item: Signal<T>; index: number } | null>(null);
  onRemove = signal<{ item: Signal<T>; index: number } | null>(null);
  onChange = signal<Signal<T>[]>([]); // When the whole array structure changes
  onBatchChange = signal<BatchChange<T> | null>(null);

  constructor(initialItems: T[] = [], getKey: (item: T, index: number) => string = (_, index) => String(index)) {
    this.getKey = getKey;
    initialItems.forEach((item) => {
      this.push(item);
    });
  }

  get length() {
    return this.items.length;
  }

  get(index: number): Signal<T> | undefined {
    return this.items[index];
  }

  getRaw(): Signal<T>[] {
    return this.items;
  }

  getAll(): T[] {
    return this.items.map((item) => item.get());
  }

  /**
   * Computes the diff between current items and new items, detecting adds, removes, and moves.
   * Uses keys to identify items across changes.
   */
  public computeDiff(newItems: T[]): BatchChange<T> {
    const adds: { key: string; item: Signal<T>; index: number }[] = [];
    const removes: { key: string; item: Signal<T>; prevIndex: number }[] = [];
    const moves: { key: string; item: Signal<T>; from: number; to: number }[] = [];

    // Build map of new keys to their target indices
    const newKeyToIndex = new Map<string, number>();
    newItems.forEach((item, index) => {
      const key = this.getKey(item, index);
      newKeyToIndex.set(key, index);
    });

    // Track which existing keys are still present and where they should be
    const existingKeyToNewIndex = new Map<string, number>();

    // Find adds and identify which existing items moved
    newItems.forEach((newItem, newIndex) => {
      const key = this.getKey(newItem, newIndex);
      const oldIndex = this.keyToIndex.get(key);

      if (oldIndex === undefined) {
        // This is a new item
        const itemSignal = signal(newItem);
        adds.push({ key, item: itemSignal, index: newIndex });
      } else {
        // Item exists
        existingKeyToNewIndex.set(key, newIndex);
        if (oldIndex !== newIndex) {
          moves.push({
            key,
            item: this.items[oldIndex],
            from: oldIndex,
            to: newIndex,
          });
        }
      }
    });

    // Find removes (items that are no longer in newItems)
    this.items.forEach((item, oldIndex) => {
      const itemValue = item.get();
      const key = this.getKey(itemValue, oldIndex);
      if (!existingKeyToNewIndex.has(key)) {
        removes.push({ key, item, prevIndex: oldIndex });
      }
    });

    return { adds, removes, moves };
  }

  push(item: T): Signal<T> {
    const itemSignal = signal(item);
    const index = this.items.length;
    const key = this.getKey(item, index);

    this.items.push(itemSignal);
    this.keyToIndex.set(key, index);

    // Emit as a batch with single add
    this.onBatchChange.set({
      adds: [{ key, item: itemSignal, index }],
      removes: [],
      moves: [],
    });

    this.onAdd.set({ item: itemSignal, index });
    this.onChange.set([...this.items]);
    return itemSignal;
  }

  remove(index: number): Signal<T> | undefined {
    const removed = this.items.splice(index, 1)[0];
    if (removed) {
      const itemValue = removed.get();
      const key = this.getKey(itemValue, index);

      // Update key mappings for remaining items
      this.keyToIndex.delete(key);
      for (let i = index; i < this.items.length; i++) {
        const item = this.items[i];
        const itemValue = item.get();
        const oldKey = this.getKey(itemValue, i + 1);
        const newKey = this.getKey(itemValue, i);
        this.keyToIndex.delete(oldKey);
        this.keyToIndex.set(newKey, i);
      }

      // Emit as a batch with single remove
      this.onBatchChange.set({
        adds: [],
        removes: [{ key, item: removed, prevIndex: index }],
        moves: [],
      });

      this.onRemove.set({ item: removed, index });
      this.onChange.set([...this.items]);
    }
    return removed;
  }

  set(newItems: T[]) {
    const batch = this.computeDiff(newItems);

    // Build a map of key to existing signal for items that are kept
    const keyToSignal = new Map<string, Signal<T>>();
    this.items.forEach((item, index) => {
      const itemValue = item.get();
      const key = this.getKey(itemValue, index);
      keyToSignal.set(key, item);
    });

    // Build the new items array in the correct order
    const newItemsArray: Signal<T>[] = [];
    this.keyToIndex.clear();

    newItems.forEach((newItem, newIndex) => {
      const key = this.getKey(newItem, newIndex);
      let itemSignal: Signal<T>;

      // Check if this is an add (new item)
      const addEntry = batch.adds.find((a) => a.key === key && a.index === newIndex);
      if (addEntry) {
        itemSignal = addEntry.item;
      } else {
        // This is an existing item (either moved or stayed in place)
        itemSignal = keyToSignal.get(key)!;
        // Update the signal value with the new item data
        itemSignal.set(newItem);
      }

      newItemsArray.push(itemSignal);
      this.keyToIndex.set(key, newIndex);
    });

    // Update items array
    this.items = newItemsArray;

    // Emit batch change
    this.onBatchChange.set(batch);
    this.onChange.set([...this.items]);
  }

  updateAt(index: number, newValue: T) {
    const item = this.items[index];
    if (item) {
      item.set(newValue);
    }
  }
}

export function createValueCollection<T>(initialItems: T[] = []) {
  return new SignalCollection<T>(initialItems);
}

export function createKeyedCollection<T>(initialItems: ContainsKey<T>[] = []) {
  return new SignalCollection<ContainsKey<T>>(initialItems, (item, _index) => item.key);
}
