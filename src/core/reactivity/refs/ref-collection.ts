import { assert } from '@/core/common/assert';
import { Container } from 'pixi.js';
import { SignalCollection } from '../signals/signal-collection';
import { getSignalValue, signal } from '../signals/signals';
import type { Signal } from '../signals/types';
import { pickRef, type Ref } from './ref';

type Elements = Container;

// Container strategy interface
interface ContainerStrategy {
  add: (parent: Elements, element: Elements) => void;
  remove: (parent: Elements, element: Elements) => void;
}

const defaultContainerStrategy: ContainerStrategy = {
  add: (parent: Elements, element: Elements) => {
    parent.addChild(element);
  },
  remove: (_parent: Elements, element: Elements) => {
    //parent.removeChild(element);
    element.destroy();
  },
};

interface RefCollection<T> {
  data: SignalCollection<T>;
  path: string;
  parent?: Elements;
  template: (ref: Ref<T>) => Elements;
  children: Signal<Elements[]>;
  strategy: ContainerStrategy;

  onAdd: Signal<{ item: Signal<T>; index: number } | null>;
  onRemove: Signal<{ item: Signal<T>; index: number } | null>;

  // Make it work as JSX children directly
  [Symbol.iterator](): Iterator<Elements>;
}

export function createRefCollection<T>(
  path: string,
  template: (ref: Ref<T>) => Elements,
  dataItems: T[] = [],
  parent?: Elements,
): RefCollection<T> {
  const childrenSignal = signal<Elements[]>([]);
  const currentElements: Elements[] = [];

  const data = new SignalCollection<T>();

  const collection: RefCollection<T> = {
    path,
    parent,
    data,
    template,
    children: childrenSignal,

    // Expose the efficient event-driven updates
    onAdd: data.onAdd,
    onRemove: data.onRemove,

    // Make it iterable so it works as JSX children
    [Symbol.iterator](): Iterator<Elements> {
      return currentElements[Symbol.iterator]();
    },
  };

  // Handle additions
  data.onAdd.subscribe((event) => {
    if (!event) return;

    const { item, index } = event;
    const key = `${path}.${index}`;
    const ref = pickRef<T>(key);

    // This sets the value from the "data" entries back to the ref
    item.subscribe((value: T) => {
      Object.entries(value as any).forEach(([prop, val]) => {
        if ((ref as any)[prop]?.set) {
          (ref as any)[prop].set(val);
        }
      });
    });

    // Create the object
    const gameObject = template(ref);
    // TODO: is this wrong?
    ref._current = gameObject as T;

    // Add to our tracked elements
    currentElements[index] = gameObject;
    childrenSignal.set([...currentElements]);

    // Use current container strategy to add the object
    if (parent) {
      defaultContainerStrategy.add(parent, gameObject);
    }
  });

  // Handle removals
  data.onRemove.subscribe((event) => {
    // First subscribe call always runs
    if (!event) return;

    const { index } = event;
    const key = `${path}.${index}`;
    const ref = pickRef(key);

    if (ref && ref._current) {
      const gameObject = ref._current as Elements;

      // Use current container strategy to remove the object
      if (parent) {
        defaultContainerStrategy.remove(parent, gameObject);
      }

      ref.cleanup();
    }

    // Remove from tracked elements
    currentElements.splice(index, 1);
    childrenSignal.set([...currentElements]);
  });

  // TODO: revert to  data.set(dataItems);
  dataItems.forEach((item) => {
    data.push(item);
  });

  return collection;
}

export interface RefCountable {
  size: Signal<number>;
  path: string;
  parent?: Elements;
  template: (index: number) => Elements;
  children: SignalCollection<Elements>;

  // onAdd: Signal<{ item: Signal<T>; index: number } | null>;
  // onRemove: Signal<{ item: Signal<T>; index: number } | null>;

  // Make it work as JSX children directly
  [Symbol.iterator](): Iterator<Elements>;
}

export function createRefs(
  path: string,
  template: (index: number) => Elements,
  size: Signal<number>,
  parent?: Elements,
  strategy: ContainerStrategy = defaultContainerStrategy,
): RefCountable {
  const currentElements: Elements[] = [];

  const children = new SignalCollection<Elements>();

  const collection: RefCountable = {
    path,
    parent,
    size,
    template,
    children,

    // Expose the efficient event-driven updates
    // onAdd: data.onAdd,
    // onRemove: data.onRemove,

    // Make it iterable so it works as JSX children
    [Symbol.iterator](): Iterator<Elements> {
      return currentElements[Symbol.iterator]();
    },
  };

  size.subscribe((value) => {
    assert(value >= 0, 'Size must be greater than 0');
    const diff = value - children.length;
    if (diff > 0) {
      // onAdd
      for (let i = 0; i < diff; i++) {
        const gameObject = template(i);
        children.push(gameObject);
        if (parent) {
          defaultContainerStrategy.add(parent, gameObject);
        }
      }
    } else if (diff < 0) {
      // onRemove
      for (let i = 0; i < -diff; i++) {
        const removed = children.remove(children.length - 1);
        const gameObject = getSignalValue(removed);
        if (parent && gameObject) {
          defaultContainerStrategy.remove(parent, gameObject);
        }
      }
    }
  });

  /*
    const { item, index } = event;
    const key = `${path}.${index}`;
    const ref = pickRef<T>(key);

    // Subscribe to individual item changes
    item.subscribe((value: T) => {
      Object.entries(value as any).forEach(([prop, val]) => {
        if ((ref as any)[prop]?.set) {
          (ref as any)[prop].set(val);
        }
      });
    });

    // Set initial values
    const initialValue = item.get();
    Object.entries(initialValue as any).forEach(([prop, val]) => {
      if ((ref as any)[prop]?.set) {
        (ref as any)[prop].set(val);
      }
    }); */

  return collection;
}
