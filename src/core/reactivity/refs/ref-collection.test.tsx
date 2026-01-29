import { beforeEach, describe, expect, it } from 'vitest';
import { createKeyedCollection } from '../signals/signal-collection';
import { signal } from '../signals/signals';
import { createRefCollection, createRefs, type Strategy, type TransitionBatch } from './ref-collection';

// Mock container for testing
class MockContainer {
  children: MockContainer[] = [];
  name: string = '';
  x: number = 0;
  y: number = 0;
  destroyed: boolean = false;
  parent: MockContainer | null = null;

  addChild(child: MockContainer): void {
    if (child.parent) {
      child.parent.removeChild(child);
    }
    this.children.push(child);
    child.parent = this;
  }

  removeChild(child: MockContainer): void {
    const index = this.children.indexOf(child);
    if (index > -1) {
      this.children.splice(index, 1);
      child.parent = null;
    }
  }

  destroy(): void {
    if (this.parent) {
      this.parent.removeChild(this);
    }
    this.destroyed = true;
  }
}

describe('RefCollection', () => {
  let parent: any;

  beforeEach(() => {
    parent = new MockContainer();
  });

  describe('createRefs', () => {
    it('should create elements when size increases', () => {
      const size = signal(0);
      const createdElements: MockContainer[] = [];

      createRefs({
        path: 'test',
        template: (index) => {
          const el = new MockContainer();
          el.name = `element-${index}`;
          createdElements.push(el);
          return el as any;
        },
        size,
        parent: parent as any,
      });

      expect(parent.children.length).toBe(0);

      size.set(3);
      expect(parent.children.length).toBe(3);
      expect(createdElements.length).toBe(3);
      expect(createdElements[0].name).toBe('element-0');
      expect(createdElements[1].name).toBe('element-1');
      expect(createdElements[2].name).toBe('element-2');
    });

    it('should remove elements when size decreases', () => {
      const size = signal(3);
      createRefs({
        path: 'test',
        template: (index) => {
          const el = new MockContainer();
          el.name = `element-${index}`;
          return el as any;
        },
        size,
        parent: parent as any,
      });

      expect(parent.children.length).toBe(3);

      size.set(1);
      expect(parent.children.length).toBe(1);
      // Elements should be destroyed by default strategy
      expect(parent.children[0].name).toBe('element-0');
    });

    it('should call custom strategy with batched changes', () => {
      const size = signal(0);
      const strategyCalls: TransitionBatch[] = [];

      const customStrategy: Strategy = (_parent, batch) => {
        strategyCalls.push(batch);
        // Don't actually add/remove, just track calls
      };

      createRefs({
        path: 'test',
        template: (index) => {
          const el = new MockContainer();
          el.name = `element-${index}`;
          return el as any;
        },
        size,
        parent,
        strategy: customStrategy,
      });

      // Initial subscription fires with 0, so we get one call with 0 adds
      // Clear it and test the actual change
      strategyCalls.length = 0;

      size.set(2);
      expect(strategyCalls.length).toBe(1);
      expect(strategyCalls[0].adds.length).toBe(2);
      expect(strategyCalls[0].removes.length).toBe(0);
      expect(strategyCalls[0].moves.length).toBe(0);
      expect(strategyCalls[0].adds[0].index).toBe(0);
      expect(strategyCalls[0].adds[1].index).toBe(1);

      size.set(1);
      expect(strategyCalls.length).toBe(2);
      expect(strategyCalls[1].adds.length).toBe(0);
      expect(strategyCalls[1].removes.length).toBe(1);
      expect(strategyCalls[1].removes[0].prevIndex).toBe(1);
    });

    it('should track elements by key correctly', () => {
      const size = signal(0);
      const collection = createRefs({
        path: 'test',
        template: (index) => {
          const el = new MockContainer();
          el.name = `element-${index}`;
          return el as any;
        },
        size,
        parent: parent as any,
      });

      size.set(2);
      const elements = Array.from(collection);
      expect(elements.length).toBe(2);
      expect(elements[0].name).toBe('element-0');
      expect(elements[1].name).toBe('element-1');

      size.set(3);
      const elements2 = Array.from(collection);
      expect(elements2.length).toBe(3);
      expect(elements2[0].name).toBe('element-0');
      expect(elements2[1].name).toBe('element-1');
      expect(elements2[2].name).toBe('element-2');
    });

    it('should handle size changes with custom strategy that delays destruction', () => {
      const size = signal(2);
      const destroyedElements: MockContainer[] = [];

      const customStrategy: Strategy = (parent, batch) => {
        // Add new elements immediately
        batch.adds.forEach(({ element }) => {
          parent.addChild(element);
        });

        // Remove elements from parent but delay destruction
        batch.removes.forEach(({ element }) => {
          parent.removeChild(element);
          destroyedElements.push(element);
          // Don't destroy immediately - strategy controls when
        });
      };

      createRefs({
        path: 'test',
        template: (index) => {
          const el = new MockContainer();
          el.name = `element-${index}`;
          return el as any;
        },
        size,
        parent,
        strategy: customStrategy,
      });

      expect(parent.children.length).toBe(2);
      expect(destroyedElements.length).toBe(0);

      size.set(1);
      expect(parent.children.length).toBe(1);
      expect(destroyedElements.length).toBe(1);
      expect(destroyedElements[0].name).toBe('element-1');
      // Element should still exist (not destroyed yet)
      expect(destroyedElements[0].destroyed).toBe(false);
    });
  });

  describe('createRefCollection', () => {
    it('should create elements for data items', () => {
      const dataItems = [
        { key: '1', name: 'item1' },
        { key: '2', name: 'item2' },
      ];

      createRefCollection({
        path: 'test',
        template: (ref) => {
          const el = new MockContainer();
          el.name = ref.name.get();
          return el as any;
        },
        data: dataItems,
        parent,
      });

      expect(parent.children.length).toBe(2);
      expect(parent.children[0].name).toBe('item1');
      expect(parent.children[1].name).toBe('item2');
    });

    it('should update elements when data changes', () => {
      const dataItems: { key: string; name: string }[] = [{ key: '1', name: 'item1' }];

      const collection = createRefCollection({
        path: 'test',
        template: (ref) => {
          const el = new MockContainer();
          // Access ref.name to set up the signal and subscription
          // The ref system should automatically update el.name when ref.name changes
          const nameSignal = ref.name;
          nameSignal.subscribe((name) => {
            el.name = name;
          });
          el.name = nameSignal.get();
          return el as any;
        },
        data: dataItems,
        parent,
      });

      expect(parent.children.length).toBe(1);
      expect(parent.children[0].name).toBe('item1');

      // Update the data item directly (same item, different property value)
      const itemSignal = collection.data.get(0);
      if (itemSignal) {
        itemSignal.set({ key: '1', name: 'item1-updated' });
        // Element should be updated via ref subscription
        expect(parent.children[0].name).toBe('item1-updated');
      }

      // Now add a new item
      collection.data.set([
        { key: '1', name: 'item1-updated' },
        { key: '2', name: 'item2' },
      ]);

      // Should have 2 elements now
      expect(parent.children.length).toBe(2);
      expect(parent.children[0].name).toBe('item1-updated');
      expect(parent.children[1].name).toBe('item2');
    });

    it('should call custom strategy with batched changes', () => {
      const dataItems: { key: string; name: string }[] = [
        { key: '1', name: 'item1' },
        { key: '2', name: 'item2' },
      ];

      const strategyCalls: TransitionBatch[] = [];

      const customStrategy: Strategy = (_parent, batch) => {
        strategyCalls.push(batch);
      };

      const collection = createRefCollection({
        path: 'test',
        template: (ref) => {
          const el = new MockContainer();
          el.name = ref.name.get();
          return el as any;
        },
        data: dataItems,
        parent,
        strategy: customStrategy,
      });

      // Initial set triggers batch - clear it
      strategyCalls.length = 0;

      // Update: change item at index 1 from item2 to item3
      // With index-based keys, the key for index 1 is 'test.1' for both items
      // The diff algorithm sees this as the same item (same key), so it updates the signal value
      // This doesn't trigger a batch because there are no structural changes (no adds/removes/moves)
      // The item signal is updated in place, which updates the ref, which updates the element
      collection.data.set([
        { key: '1', name: 'item1' },
        { key: '3', name: 'item3' },
      ]);

      // With index-based keys, updating an item at the same index doesn't trigger a batch
      // because it's treated as an update to the existing item, not a structural change
      // The element should still be updated via the ref subscription
      // So we expect 0 batch calls (items updated in place)
      expect(strategyCalls.length).toBe(1);

      const batch = strategyCalls[0];
      // With id-based keys, removing item2 and adding item3 should be detected
      expect(batch.removes.length).toBe(1);
      expect(batch.adds.length).toBe(1);
      expect(batch.moves.length).toBe(0);

      // Verify the final state
      expect(collection.data.get(0)?.get().key).toBe('1');
      expect(collection.data.get(1)?.get().key).toBe('3');
    });

    it('should handle ref subscriptions correctly', () => {
      const dataItems: { key: string; x: number; y: number }[] = [{ key: '1', x: 10, y: 20 }];

      const collection = createRefCollection({
        path: 'test',
        template: (ref) => {
          const el = new MockContainer();
          // Subscribe to ref properties to keep element properties in sync
          ref.x.subscribe((x) => {
            el.x = x;
          });
          ref.y.subscribe((y) => {
            el.y = y;
          });
          el.x = ref.x.get();
          el.y = ref.y.get();
          return el as any;
        },
        data: dataItems,
        parent,
      });

      expect(parent.children.length).toBe(1);
      expect(parent.children[0].x).toBe(10);
      expect(parent.children[0].y).toBe(20);

      // Update the data item
      const itemSignal = collection.data.get(0);
      if (itemSignal) {
        itemSignal.set({ key: '1', x: 100, y: 200 });
        // Element should be updated via ref subscription
        expect(parent.children[0].x).toBe(100);
        expect(parent.children[0].y).toBe(200);
      }
    });

    it('should clean up refs when items are removed', () => {
      const dataItems: { key: string; name: string }[] = [
        { key: '1', name: 'item1' },
        { key: '2', name: 'item2' },
      ];

      const collection = createRefCollection({
        path: 'test',
        template: (ref) => {
          const el = new MockContainer();
          el.name = ref.name.get();
          return el as any;
        },
        data: dataItems,
        parent,
      });

      expect(parent.children.length).toBe(2);

      // Remove an item
      collection.data.set([{ key: '1', name: 'item1' }]);

      expect(parent.children.length).toBe(1);
      expect(parent.children[0].name).toBe('item1');
    });
  });

  describe('batched transitions', () => {
    it('should detect moves when items are reordered', () => {
      const dataItems: { key: string; name: string }[] = [
        { key: '1', name: 'item1' },
        { key: '2', name: 'item2' },
        { key: '3', name: 'item3' },
      ];

      const strategyCalls: TransitionBatch[] = [];

      const customStrategy: Strategy = (_parent, batch) => {
        strategyCalls.push(batch);
      };

      const collection = createRefCollection({
        path: 'test',
        template: (ref) => {
          const el = new MockContainer();
          el.name = ref.name.get();
          return el as any;
        },
        data: dataItems,
        parent,
        strategy: customStrategy,
      });

      strategyCalls.length = 0;

      // Reorder items - with index-based keys, items at each index are updated
      // The items at each position change, but the keys stay the same (based on index)
      collection.data.set([
        { key: '3', name: 'item3' },
        { key: '1', name: 'item1' },
        { key: '2', name: 'item2' },
      ]);

      // With index-based keys, when items are reordered:
      // - Item at index 0 changes from {id:1} to {id:3} - same key 'test.0', different item
      // - Item at index 1 changes from {id:2} to {id:1} - same key 'test.1', different item
      // - Item at index 2 changes from {id:3} to {id:2} - same key 'test.2', different item
      // The diff algorithm behavior depends on implementation:
      // - It might update items in place (no batch)
      // - Or it might detect the items as different and create removes/adds
      // Both behaviors are valid
      // If a batch is triggered, verify it has changes
      expect(strategyCalls.length).toBe(1);

      const batch = strategyCalls[0];
      expect(batch.adds.length).toBe(0);
      expect(batch.removes.length).toBe(0);
      expect(batch.moves.length).toBe(3);

      // Verify the items were updated
      expect(collection.data.get(0)?.get().key).toBe('3');
      expect(collection.data.get(1)?.get().key).toBe('1');
      expect(collection.data.get(2)?.get().key).toBe('2');
    });

    it('should handle complex batch with adds, removes, and moves', () => {
      const size = signal(2);
      const strategyCalls: TransitionBatch[] = [];

      const customStrategy: Strategy = (_parent, batch) => {
        strategyCalls.push(batch);
      };

      createRefs({
        path: 'test',
        template: (index) => {
          const el = new MockContainer();
          el.name = `element-${index}`;
          return el as any;
        },
        size,
        parent,
        strategy: customStrategy,
      });

      strategyCalls.length = 0;

      // Change size
      size.set(4);

      expect(strategyCalls.length).toBe(1);
      const batch = strategyCalls[0];
      expect(batch.adds.length).toBe(2);
      expect(batch.removes.length).toBe(0);
      expect(batch.adds[0].index).toBe(2);
      expect(batch.adds[1].index).toBe(3);
    });
  });

  describe('createRefCollection with pre-created SignalCollection', () => {
    it('should create elements for data items from SignalCollection', () => {
      const dataCollection = createKeyedCollection([
        { key: '1', name: 'item1' },
        { key: '2', name: 'item2' },
      ]);

      createRefCollection({
        path: 'test',
        template: (ref) => {
          const el = new MockContainer();
          el.name = ref.name.get();
          return el as any;
        },
        data: dataCollection,
        parent,
      });

      expect(parent.children.length).toBe(2);
      expect(parent.children[0].name).toBe('item1');
      expect(parent.children[1].name).toBe('item2');
    });

    it('should update elements when SignalCollection data changes', () => {
      const dataCollection = createKeyedCollection([{ key: '1', name: 'item1' }]);

      const collection = createRefCollection({
        path: 'test',
        template: (ref) => {
          const el = new MockContainer();
          const nameSignal = ref.name;
          nameSignal.subscribe((name) => {
            el.name = name;
          });
          el.name = nameSignal.get();
          return el as any;
        },
        data: dataCollection,
        parent,
      });

      expect(parent.children.length).toBe(1);
      expect(parent.children[0].name).toBe('item1');

      // Update the data item directly
      const itemSignal = collection.data.get(0);
      if (itemSignal) {
        itemSignal.set({ key: '1', name: 'item1-updated' });
        expect(parent.children[0].name).toBe('item1-updated');
      }

      // Add a new item via the SignalCollection
      collection.data.set([
        { key: '1', name: 'item1-updated' },
        { key: '2', name: 'item2' },
      ]);

      expect(parent.children.length).toBe(2);
      expect(parent.children[0].name).toBe('item1-updated');
      expect(parent.children[1].name).toBe('item2');
    });

    it('should call custom strategy with batched changes from SignalCollection', () => {
      const dataCollection = createKeyedCollection([
        { key: '1', name: 'item1' },
        { key: '2', name: 'item2' },
        { key: '3', name: 'item3' },
        { key: '4', name: 'item4' },
      ]);

      const strategyCalls: TransitionBatch[] = [];

      const customStrategy: Strategy = (_parent, batch) => {
        strategyCalls.push(batch);
      };

      const collection = createRefCollection({
        path: 'test',
        template: (ref) => {
          const el = new MockContainer();
          el.name = ref.name.get();
          return el as any;
        },
        data: dataCollection,
        parent,
        strategy: customStrategy,
      });

      // Initial set triggers batch - clear it
      strategyCalls.length = 0;

      // Update: remove item2, add item3
      collection.data.set([
        { key: '1', name: 'item1' },
        { key: '3', name: 'item3' },
      ]);

      expect(strategyCalls.length).toBe(1);

      const batch = strategyCalls[0];
      expect(batch.removes.length).toBe(2);
      expect(batch.adds.length).toBe(0);
      expect(batch.moves.length).toBe(1);

      expect(collection.data.get(0)?.get().key).toBe('1');
      expect(collection.data.get(1)?.get().key).toBe('3');
    });

    it('should handle ref subscriptions correctly with SignalCollection', () => {
      const dataCollection = createKeyedCollection([{ key: '1', x: 10, y: 20 }]);

      const collection = createRefCollection({
        path: 'test',
        template: (ref) => {
          const el = new MockContainer();
          ref.x.subscribe((x) => {
            el.x = x;
          });
          ref.y.subscribe((y) => {
            el.y = y;
          });
          el.x = ref.x.get();
          el.y = ref.y.get();
          return el as any;
        },
        data: dataCollection,
        parent,
      });

      expect(parent.children.length).toBe(1);
      expect(parent.children[0].x).toBe(10);
      expect(parent.children[0].y).toBe(20);

      // Update the data item
      const itemSignal = collection.data.get(0);
      if (itemSignal) {
        itemSignal.set({ key: '1', x: 100, y: 200 });
        expect(parent.children[0].x).toBe(100);
        expect(parent.children[0].y).toBe(200);
      }
    });

    it('should clean up refs when items are removed from SignalCollection', () => {
      const dataCollection = createKeyedCollection([
        { key: '1', name: 'item1' },
        { key: '2', name: 'item2' },
      ]);

      const collection = createRefCollection({
        path: 'test',
        template: (ref) => {
          const el = new MockContainer();
          el.name = ref.name.get();
          return el as any;
        },
        data: dataCollection,
        parent,
      });

      expect(parent.children.length).toBe(2);

      // Remove an item
      collection.data.set([{ key: '1', name: 'item1' }]);

      expect(parent.children.length).toBe(1);
      expect(parent.children[0].name).toBe('item1');
    });

    it('should detect moves when items are reordered in SignalCollection', () => {
      const dataCollection = createKeyedCollection([
        { key: '1', name: 'item1' },
        { key: '2', name: 'item2' },
        { key: '3', name: 'item3' },
      ]);

      const strategyCalls: TransitionBatch[] = [];

      const customStrategy: Strategy = (_parent, batch) => {
        strategyCalls.push(batch);
      };

      const collection = createRefCollection({
        path: 'test',
        template: (ref) => {
          const el = new MockContainer();
          el.name = ref.name.get();
          return el as any;
        },
        data: dataCollection,
        parent,
        strategy: customStrategy,
      });

      strategyCalls.length = 0;

      // Reorder items - with key-based keys, moves should be detected
      collection.data.set([
        { key: '3', name: 'item3' },
        { key: '1', name: 'item1' },
        { key: '2', name: 'item2' },
      ]);

      expect(strategyCalls.length).toBe(1);
      const batch = strategyCalls[0];

      // Should detect moves
      expect(batch.adds.length).toBe(0);
      expect(batch.removes.length).toBe(0);
      expect(batch.moves.length).toBe(3);

      // Verify moves
      expect(batch.moves[0].from).toBe(2);
      expect(batch.moves[0].to).toBe(0);
    });

    it('should handle complex batch with adds, removes, and moves from SignalCollection', () => {
      const dataCollection = createKeyedCollection([
        { key: '1', name: 'item1' },
        { key: '2', name: 'item2' },
        { key: '3', name: 'item3' },
      ]);

      const strategyCalls: TransitionBatch[] = [];

      const customStrategy: Strategy = (_parent, batch) => {
        strategyCalls.push(batch);
      };

      const collection = createRefCollection({
        path: 'test',
        template: (ref) => {
          const el = new MockContainer();
          el.name = ref.name.get();
          return el as any;
        },
        data: dataCollection,
        parent,
        strategy: customStrategy,
      });

      strategyCalls.length = 0;

      // Complex change: remove 2, add 4, move 3 to front
      collection.data.set([
        { key: '3', name: 'item3' },
        { key: '1', name: 'item1' },
        { key: '4', name: 'item4' },
      ]);

      expect(strategyCalls.length).toBe(1);
      const batch = strategyCalls[0];

      expect(batch.removes.length).toBe(1);
      expect(batch.removes[0].prevIndex).toBe(1);

      expect(batch.adds.length).toBe(1);
      expect(batch.adds[0].index).toBe(2);

      expect(batch.moves.length).toBe(2);
    });
  });
});
