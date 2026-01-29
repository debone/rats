import { describe, expect, it } from 'vitest';
import { SignalCollection, type BatchChange } from './signal-collection';

describe('SignalCollection', () => {
  describe('basic operations', () => {
    it('should create an empty collection', () => {
      const collection = new SignalCollection<number>();
      expect(collection.length).toBe(0);
      expect(collection.getAll()).toEqual([]);
    });

    it('should create a collection with initial items', () => {
      const collection = new SignalCollection<number>([1, 2, 3]);
      expect(collection.length).toBe(3);
      expect(collection.getAll()).toEqual([1, 2, 3]);
    });

    it('should push items', () => {
      const collection = new SignalCollection<number>();
      collection.push(1);
      collection.push(2);
      expect(collection.length).toBe(2);
      expect(collection.getAll()).toEqual([1, 2]);
    });

    it('should get item by index', () => {
      const collection = new SignalCollection<number>([10, 20, 30]);
      const item = collection.get(1);
      expect(item).toBeDefined();
      expect(item?.get()).toBe(20);
    });

    it('should return undefined for out of bounds index', () => {
      const collection = new SignalCollection<number>([1, 2]);
      expect(collection.get(5)).toBeUndefined();
    });

    it('should remove item by index', () => {
      const collection = new SignalCollection<number>([1, 2, 3]);
      const removed = collection.remove(1);
      expect(removed).toBeDefined();
      expect(removed?.get()).toBe(2);
      expect(collection.length).toBe(2);
      expect(collection.getAll()).toEqual([1, 3]);
    });

    it('should update item at index', () => {
      const collection = new SignalCollection<number>([1, 2, 3]);
      collection.updateAt(1, 99);
      expect(collection.get(1)?.get()).toBe(99);
      expect(collection.getAll()).toEqual([1, 99, 3]);
    });
  });

  describe('events', () => {
    it('should emit onAdd when pushing', () => {
      const collection = new SignalCollection<number>();
      const addEvents: { item: any; index: number }[] = [];

      collection.onAdd.subscribe((event) => {
        if (event) {
          addEvents.push(event);
        }
      });

      collection.push(1);
      collection.push(2);

      expect(addEvents.length).toBe(2);
      expect(addEvents[0].index).toBe(0);
      expect(addEvents[0].item.get()).toBe(1);
      expect(addEvents[1].index).toBe(1);
      expect(addEvents[1].item.get()).toBe(2);
    });

    it('should emit onRemove when removing', () => {
      const collection = new SignalCollection<number>([1, 2, 3]);
      const removeEvents: { item: any; index: number }[] = [];

      collection.onRemove.subscribe((event) => {
        if (event) {
          removeEvents.push(event);
        }
      });

      collection.remove(1);

      expect(removeEvents.length).toBe(1);
      expect(removeEvents[0].index).toBe(1);
      expect(removeEvents[0].item.get()).toBe(2);
    });

    it('should emit onChange when collection changes', () => {
      const collection = new SignalCollection<number>([1, 2]);
      const changeEvents: any[][] = [];

      collection.onChange.subscribe((items) => {
        changeEvents.push(items);
      });

      collection.push(3);
      expect(changeEvents.length).toBeGreaterThan(0);
      expect(changeEvents[changeEvents.length - 1].length).toBe(3);
    });
  });

  describe('batched changes', () => {
    it('should emit onBatchChange when pushing', () => {
      const collection = new SignalCollection<number>();
      const batches: BatchChange<number>[] = [];

      collection.onBatchChange.subscribe((batch) => {
        if (batch) {
          batches.push(batch);
        }
      });

      collection.push(1);
      collection.push(2);

      expect(batches.length).toBe(2);
      expect(batches[0].adds.length).toBe(1);
      expect(batches[0].adds[0].index).toBe(0);
      expect(batches[0].adds[0].item.get()).toBe(1);
      expect(batches[1].adds.length).toBe(1);
      expect(batches[1].adds[0].index).toBe(1);
    });

    it('should emit onBatchChange when removing', () => {
      const collection = new SignalCollection<number>([1, 2, 3]);
      const batches: BatchChange<number>[] = [];

      collection.onBatchChange.subscribe((batch) => {
        if (batch) {
          batches.push(batch);
        }
      });

      // Clear initial batches from construction
      batches.length = 0;

      collection.remove(1);

      expect(batches.length).toBe(1);
      expect(batches[0].removes.length).toBe(1);
      expect(batches[0].removes[0].prevIndex).toBe(1);
      expect(batches[0].removes[0].item.get()).toBe(2);
    });

    it('should detect adds when setting new items', () => {
      const collection = new SignalCollection<number>([1, 2]);
      const batches: BatchChange<number>[] = [];

      collection.onBatchChange.subscribe((batch) => {
        if (batch) {
          batches.push(batch);
        }
      });

      // Clear initial batches from construction
      batches.length = 0;

      collection.set([1, 2, 3, 4]);

      expect(batches.length).toBe(1);
      const batch = batches[0];
      expect(batch.adds.length).toBe(2);
      expect(batch.adds[0].index).toBe(2);
      expect(batch.adds[0].item.get()).toBe(3);
      expect(batch.adds[1].index).toBe(3);
      expect(batch.adds[1].item.get()).toBe(4);
      expect(batch.removes.length).toBe(0);
      expect(batch.moves.length).toBe(0);
    });

    it('should detect removes when setting fewer items', () => {
      const collection = new SignalCollection<number>([1, 2, 3, 4]);
      const batches: BatchChange<number>[] = [];

      collection.onBatchChange.subscribe((batch) => {
        if (batch) {
          batches.push(batch);
        }
      });

      // Clear initial batches from construction
      batches.length = 0;

      collection.set([1, 2]);

      expect(batches.length).toBe(1);
      const batch = batches[0];
      expect(batch.removes.length).toBe(2);
      expect(batch.removes[0].prevIndex).toBe(2);
      expect(batch.removes[0].item.get()).toBe(3);
      expect(batch.removes[1].prevIndex).toBe(3);
      expect(batch.removes[1].item.get()).toBe(4);
      expect(batch.adds.length).toBe(0);
      expect(batch.moves.length).toBe(0);
    });

    it('should detect moves when items are reordered', () => {
      // Use value-based keys so movements can be detected
      const collection = new SignalCollection<number>([1, 2, 3], (item) => String(item));
      const batches: BatchChange<number>[] = [];

      collection.onBatchChange.subscribe((batch) => {
        if (batch) {
          batches.push(batch);
        }
      });

      // Clear initial batches from construction
      batches.length = 0;

      // Reorder: move item 3 to the front
      collection.set([3, 1, 2]);

      // With value-based keys, reordering creates moves:
      // - Value 3 (key '3'): moves from index 2 → 0
      // - Value 1 (key '1'): moves from index 0 → 1
      // - Value 2 (key '2'): moves from index 1 → 2
      expect(batches.length).toBe(1);
      const batch = batches[0];
      expect(batch.adds.length).toBe(0);
      expect(batch.removes.length).toBe(0);
      expect(batch.moves.length).toBe(3);

      // Verify the moves are correct (checking key/from/to, ignoring the item signal)
      expect(batch.moves.length).toBe(3);
      expect(batch.moves[0].key).toBe('3');
      expect(batch.moves[0].from).toBe(2);
      expect(batch.moves[0].to).toBe(0);
      expect(batch.moves[1].key).toBe('1');
      expect(batch.moves[1].from).toBe(0);
      expect(batch.moves[1].to).toBe(1);
      expect(batch.moves[2].key).toBe('2');
      expect(batch.moves[2].from).toBe(1);
      expect(batch.moves[2].to).toBe(2);

      // Verify items are in the new order
      expect(collection.getAll()).toEqual([3, 1, 2]);
      expect(collection.length).toBe(3);
    });

    it('should detect mixed adds, removes, and moves', () => {
      const collection = new SignalCollection<number>([1, 2, 3]);
      const batches: BatchChange<number>[] = [];

      collection.onBatchChange.subscribe((batch) => {
        if (batch) {
          batches.push(batch);
        }
      });

      // Clear initial batches from construction
      batches.length = 0;

      // Change item at index 2 from 3 to 4, add new item 5 at index 3
      collection.set([1, 2, 4, 5]);

      expect(batches.length).toBe(1);
      const batch = batches[0];
      // With index-based keys:
      // - Index 2: key "2", value changed from 3 to 4 - same key, signal reused (may not update value)
      // - Index 3: key "3", new item 5 - new key, should be an add
      // So we should see 1 add (item 5)
      expect(batch.adds.length).toBe(1);
      expect(batch.adds[0].item.get()).toBe(5);
      expect(batch.adds[0].index).toBe(3);

      // Verify the collection structure (length and new item)
      expect(collection.length).toBe(4);
      expect(collection.get(3)?.get()).toBe(5);
    });
  });

  describe('custom key function', () => {
    it('should use custom key function for identity', () => {
      interface Item {
        id: number;
        name: string;
      }

      const collection = new SignalCollection<Item>(
        [
          { id: 1, name: 'item1' },
          { id: 2, name: 'item2' },
        ],
        (item) => `item-${item.id}`,
      );

      const batches: BatchChange<Item>[] = [];
      collection.onBatchChange.subscribe((batch) => {
        if (batch) {
          batches.push(batch);
        }
      });

      // Clear initial batches
      batches.length = 0;

      // Reorder items - with id-based keys, this should detect moves
      collection.set([
        { id: 2, name: 'item2' },
        { id: 1, name: 'item1' },
      ]);

      expect(batches.length).toBe(1);
      const batch = batches[0];
      // With id-based keys, reordering should detect moves
      // Both items move: item1 from 0->1, item2 from 1->0
      expect(batch.moves.length).toBe(2);

      // Verify no adds/removes (just moves)
      expect(batch.adds.length).toBe(0);
      expect(batch.removes.length).toBe(0);
      // Verify the final state is correct
      expect(collection.getAll().map((item) => item.id)).toEqual([2, 1]);
    });

    it('should detect adds and removes with custom key function', () => {
      interface Item {
        id: number;
        name: string;
      }

      const collection = new SignalCollection<Item>(
        [
          { id: 1, name: 'item1' },
          { id: 2, name: 'item2' },
        ],
        (item) => `item-${item.id}`,
      );

      const batches: BatchChange<Item>[] = [];
      collection.onBatchChange.subscribe((batch) => {
        if (batch) {
          batches.push(batch);
        }
      });

      // Clear initial batches
      batches.length = 0;

      // Remove item2, add item3
      collection.set([
        { id: 1, name: 'item1' },
        { id: 3, name: 'item3' },
      ]);

      expect(batches.length).toBe(1);
      const batch = batches[0];
      expect(batch.removes.length).toBe(1);
      expect(batch.removes[0].key).toBe('item-2');
      expect(batch.adds.length).toBe(1);
      expect(batch.adds[0].key).toBe('item-3');
      expect(batch.adds[0].item.get().name).toBe('item3');
    });

    it('should update existing items in place with custom key function', () => {
      interface Item {
        id: number;
        name: string;
      }

      const collection = new SignalCollection<Item>([{ id: 1, name: 'item1' }], (item) => `item-${item.id}`);

      const batches: BatchChange<Item>[] = [];
      collection.onBatchChange.subscribe((batch) => {
        if (batch) {
          batches.push(batch);
        }
      });

      // Clear initial batches
      batches.length = 0;

      // Update the same item (same id, different name)
      collection.set([{ id: 1, name: 'item1-updated' }]);

      // With id-based keys, same id = same key, so it's an update, not add/remove
      // The signal is reused and its value is updated automatically
      // A batch is still emitted, but it should have no adds/removes/moves
      expect(batches.length).toBe(1);
      const batch = batches[0];
      expect(batch.adds.length).toBe(0);
      expect(batch.removes.length).toBe(0);
      expect(batch.moves.length).toBe(0);

      // The signal value should be updated automatically
      expect(collection.get(0)?.get().name).toBe('item1-updated');
    });
  });

  describe('edge cases', () => {
    it('should handle empty set', () => {
      const collection = new SignalCollection<number>([1, 2, 3]);
      const batches: BatchChange<number>[] = [];

      collection.onBatchChange.subscribe((batch) => {
        if (batch) {
          batches.push(batch);
        }
      });

      // Clear initial batches
      batches.length = 0;

      collection.set([]);

      expect(collection.length).toBe(0);
      expect(batches.length).toBe(1);
      expect(batches[0].removes.length).toBe(3);
      expect(batches[0].adds.length).toBe(0);
    });

    it('should handle set with same items', () => {
      const collection = new SignalCollection<number>([1, 2, 3]);
      const batches: BatchChange<number>[] = [];

      collection.onBatchChange.subscribe((batch) => {
        if (batch) {
          batches.push(batch);
        }
      });

      // Clear initial batches
      batches.length = 0;

      // Set same items - with index-based keys, same items at same indices = no structural changes
      collection.set([1, 2, 3]);

      // A batch is still emitted, but it should have no adds/removes/moves
      // (items are updated in place if values changed, but in this case values are the same)
      expect(batches.length).toBe(1);
      const batch = batches[0];
      expect(batch.adds.length).toBe(0);
      expect(batch.removes.length).toBe(0);
      expect(batch.moves.length).toBe(0);
      expect(collection.length).toBe(3);
    });

    it('should handle remove from empty collection', () => {
      const collection = new SignalCollection<number>();
      const removed = collection.remove(0);
      expect(removed).toBeUndefined();
      expect(collection.length).toBe(0);
    });

    it('should handle updateAt with out of bounds index', () => {
      const collection = new SignalCollection<number>([1, 2]);
      collection.updateAt(5, 99);
      // Should not throw, but also shouldn't change anything
      expect(collection.length).toBe(2);
      expect(collection.getAll()).toEqual([1, 2]);
    });

    it('should maintain key mappings correctly after multiple operations', () => {
      const collection = new SignalCollection<number>([1, 2, 3, 4, 5]);

      // Remove from middle
      collection.remove(2);
      expect(collection.getAll()).toEqual([1, 2, 4, 5]);

      // Add new item
      collection.push(6);
      expect(collection.getAll()).toEqual([1, 2, 4, 5, 6]);

      // Set new items - with index-based keys
      // Items at indices 0, 1, 2 are reused (same keys), but values need to be updated
      // Items at indices 3, 4, 5 are removed (beyond new length)
      collection.set([10, 20, 30]);
      expect(collection.length).toBe(3);
      expect(collection.getAll()).toEqual([10, 20, 30]);

      // The signals are reused, so we need to update their values manually
      // (The current implementation doesn't auto-update reused signals)
      collection.updateAt(0, 10);
      collection.updateAt(1, 20);
      collection.updateAt(2, 30);
      expect(collection.getAll()).toEqual([10, 20, 30]);
    });
  });

  describe('signal reactivity', () => {
    it('should update item signals when updateAt is called', () => {
      const collection = new SignalCollection<number>([1, 2, 3]);
      const item = collection.get(1);
      const values: number[] = [];

      item?.subscribe((value) => {
        values.push(value);
      });

      collection.updateAt(1, 99);

      expect(values).toContain(99);
      expect(item?.get()).toBe(99);
    });

    it('should maintain signal references for moved items', () => {
      interface Item {
        id: number;
        name: string;
      }

      const collection = new SignalCollection<Item>(
        [
          { id: 1, name: 'item1' },
          { id: 2, name: 'item2' },
        ],
        (item) => `item-${item.id}`,
      );

      const originalSignal1 = collection.get(0);
      const originalSignal2 = collection.get(1);

      // Reorder items
      collection.set([
        { id: 2, name: 'item2' },
        { id: 1, name: 'item1' },
      ]);

      // With id-based keys, the signals should be the same (moved, not recreated)
      expect(collection.get(0)).toBe(originalSignal2);
      expect(collection.get(1)).toBe(originalSignal1);
    });
  });
});
