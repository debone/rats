import { assert } from '@/core/common/assert';
import { Container } from 'pixi.js';
import {
  createKeyedCollection,
  SignalCollection,
  type BatchChange,
  type ContainsKey,
} from '../signals/signal-collection';
import { signal } from '../signals/signals';
import type { Signal, Subscriber } from '../signals/types';
import { pickRef, type Ref } from './ref';

type Elements = Container;

/**
 * Represents a batch of changes (adds, removes, moves) for animated transitions.
 * The strategy function receives this batch to choreograph visual animations.
 */
export interface TransitionBatch {
  adds: { index: number; element: Elements }[];
  removes: { element: Elements; prevIndex: number }[];
  moves: { element: Elements; from: number; to: number }[];
}

/**
 * Strategy function for handling batched transitions.
 * Receives the parent container and a batch of changes, and is responsible for:
 * - Parenting elements (adding to parent)
 * - Animating transitions (entrance, exit, moves)
 * - Destroying elements when appropriate (after exit animations)
 *
 * The collection's internal state is already updated before this runs (data is truth),
 * so the strategy is purely responsible for visual orchestration.
 */
export type Strategy = (parent: Elements, batch: TransitionBatch) => void | Promise<void>;

/**
 * Default strategy that immediately adds/removes elements without animation.
 * Removes are destroyed immediately, adds are parented immediately.
 */
const defaultStrategy: Strategy = (parent, { adds, removes }) => {
  removes.forEach(({ element }) => element.destroy());
  adds.forEach(({ element }) => parent.addChild(element));
};

interface RefCollection<T> {
  data: SignalCollection<ContainsKey<T>>;
  path: string;
  parent?: Elements;
  template: (ref: Ref<T>) => Elements;
  children: Signal<Elements[]>;
  destroy: () => void;

  [Symbol.iterator](): Iterator<Elements>;
}

/**
 * Creates a ref collection that manages display objects bound to reactive data.
 * Uses stable keys for identity and supports batched animated transitions via a strategy function.
 *
 * The key function attempts to use stable identifiers from the data (like 'id' or '_id' properties)
 * to enable proper move detection when items are reordered. Falls back to index-based keys if
 * no stable identifier is found.
 *
 * @param path - Unique path identifier for this collection
 * @param template - Function to create a new element given a ref
 * @param dataItems - Initial data items
 * @param parent - Optional parent container to add elements to
 * @param strategy - Optional strategy function for batched transitions (defaults to immediate add/remove)
 * @param getKey - Optional custom key function. If not provided, uses 'id' or '_id' property, or falls back to index
 * @returns A RefCollection
 */
/**
 * Options for creating a RefCollection.
 */
export interface CreateRefCollectionOptions<T> {
  /** Unique path identifier for this collection */
  path: string;
  /** Function to create a new element given a ref */
  template: (ref: Ref<T>) => Elements;
  /** Initial data items */
  data?: ContainsKey<T>[] | SignalCollection<ContainsKey<T>>;
  /** Optional parent container to add elements to */
  parent?: Elements;
  /** Optional strategy function for batched transitions (defaults to immediate add/remove) */
  strategy?: Strategy;
}

export function createRefCollection<T>(options: CreateRefCollectionOptions<T>): RefCollection<T> {
  const { path, template, data: dataItems = [], parent, strategy = defaultStrategy } = options;

  const childrenSignal = signal<Elements[]>([]);
  const currentElements: Elements[] = [];
  const elementsByKey = new Map<string, Elements>();
  const refsByKey = new Map<string, Ref<T>>();

  const data = Array.isArray(dataItems) ? createKeyedCollection<T>() : dataItems;

  const handleBatchChange: Subscriber<BatchChange<ContainsKey<T>> | null> = (change) => {
    if (!change || !parent) return;

    // Build TransitionBatch with element references
    const batch: TransitionBatch = {
      adds: change.adds.map(({ key, index, item }) => {
        // Create ref and set up subscriptions
        const ref = pickRef<T>(key);
        refsByKey.set(key, ref);

        // Set initial value from item signal
        const initialValue = item.get();
        Object.entries(initialValue as any).forEach(([prop, val]) => {
          if ((ref as any)[prop]?.set) {
            (ref as any)[prop].set(val);
          }
        });

        // Subscribe to item changes and update ref
        item.subscribe((value: T) => {
          Object.entries(value as any).forEach(([prop, val]) => {
            if ((ref as any)[prop]?.set) {
              (ref as any)[prop].set(val);
            }
          });
        });

        // Create the element
        const element = template(ref);
        ref._current = element as T;
        elementsByKey.set(key, element);

        return { index, element };
      }),
      removes: change.removes.map(({ key, prevIndex }) => {
        const element = elementsByKey.get(key)!;
        const ref = refsByKey.get(key);

        // Clean up ref (but don't destroy element yet - strategy handles that)
        if (ref) {
          ref.cleanup();
          refsByKey.delete(key);
        }

        return { element, prevIndex };
      }),
      moves: change.moves.map(({ key, from, to }) => {
        const element = elementsByKey.get(key)!;
        return { element, from, to };
      }),
    };

    // Clean up tracking for removes (but don't destroy yet - strategy handles that)
    change.removes.forEach(({ key }) => {
      elementsByKey.delete(key);
    });

    // Update currentElements array for iteration
    currentElements.length = 0;
    data.getAll().forEach((item, index) => {
      const el = elementsByKey.get(item.key);
      if (el) {
        currentElements[index] = el;
      }
    });
    childrenSignal.set([...currentElements]);

    // Call strategy to handle visual orchestration
    strategy(parent, batch);
  };

  // Handle batched changes
  const unsubscribe = data.onBatchChange.subscribe(handleBatchChange, false);

  // Initialize with data items
  if (Array.isArray(dataItems) && dataItems.length > 0) {
    data.set(dataItems);
  } else {
    handleBatchChange({
      // The initial batch is the diff between the empty array and the current items
      adds: data.computeDiff([]).removes.map(({ key, item, prevIndex }) => ({ key, item, index: prevIndex })),
      removes: [],
      moves: [],
    });
  }

  return {
    path,
    parent,
    data,
    template,
    children: childrenSignal,
    destroy: () => {
      childrenSignal.dispose();
      currentElements.length = 0;
      elementsByKey.clear();
      refsByKey.clear();
      unsubscribe();
    },
    [Symbol.iterator](): Iterator<Elements> {
      return currentElements[Symbol.iterator]();
    },
  };
}

export interface RefCountable {
  size: Signal<number>;
  path: string;
  parent?: Elements;
  template: (index: number) => Elements;
  children: SignalCollection<Elements>;
  [Symbol.iterator](): Iterator<Elements>;
}

/**
 * Options for creating a RefCountable collection.
 */
export interface CreateRefsOptions {
  /** Unique path identifier for this collection */
  path: string;
  /** Function to create a new element given an index */
  template: (index: number) => Elements;
  /** Signal that provides the target count */
  size: Signal<number>;
  /** Optional parent container to add elements to */
  parent?: Elements;
  /** Optional strategy function for batched transitions (defaults to immediate add/remove) */
  strategy?: Strategy;
}

/**
 * Creates a ref collection that manages display objects based on a count signal.
 * Uses numeric string keys ('0', '1', '2', etc.) for identity and supports
 * batched animated transitions via a strategy function.
 *
 * @param options - Configuration options for the RefCountable collection
 * @returns A RefCountable collection
 */
export function createRefs(options: CreateRefsOptions): RefCountable {
  const { path, template, size, parent, strategy = defaultStrategy } = options;
  const elementsByKey = new Map<string, Elements>();
  const currentElements: Elements[] = [];

  // Create SignalCollection with numeric string keys based on array index
  // We use a placeholder object for each item, but key by array index
  const children = new SignalCollection<{ index: number }>([], (_item, index) => String(index));

  const collection: RefCountable = {
    path,
    parent,
    size,
    template,
    children: children as unknown as SignalCollection<Elements>,

    // Make it iterable so it works as JSX children
    [Symbol.iterator](): Iterator<Elements> {
      return currentElements[Symbol.iterator]();
    },
  };

  // Handle batched changes
  children.onBatchChange.subscribe((change) => {
    if (!change || !parent) return;

    // Build TransitionBatch with element references
    const batch: TransitionBatch = {
      adds: change.adds.map(({ key, index }) => {
        // Create element for new items immediately and store in map
        const element = template(index);
        elementsByKey.set(key, element);
        return { index, element };
      }),
      removes: change.removes.map(({ key, prevIndex }) => {
        const element = elementsByKey.get(key)!;
        return { element, prevIndex };
      }),
      moves: change.moves.map(({ key, from, to }) => {
        const element = elementsByKey.get(key)!;
        return { element, from, to };
      }),
    };

    // Clean up tracking for removes (but don't destroy yet - strategy handles that)
    change.removes.forEach(({ key }) => {
      elementsByKey.delete(key);
    });

    // Update currentElements array for iteration
    currentElements.length = 0;
    for (let i = 0; i < children.length; i++) {
      const key = String(i);
      const el = elementsByKey.get(key);
      if (el) {
        currentElements[i] = el;
      }
    }

    // Call strategy to handle visual orchestration
    strategy(parent, batch);
  });

  // Subscribe to size changes and update collection
  size.subscribe((value) => {
    assert(value >= 0, 'Size must be greater than 0');

    // Build array of placeholder objects matching the target size
    // The key is based on the index, which allows proper diffing
    const targetItems: { index: number }[] = [];
    for (let i = 0; i < value; i++) {
      targetItems.push({ index: i });
    }

    children.set(targetItems);
  });

  return collection;
}
