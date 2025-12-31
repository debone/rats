import type { Container } from 'pixi.js';
import { signal } from '../signals/signals';
import type { Signal } from '../signals/types';

export type Ref<T> = {
  [K in keyof T]: Signal<T[K]>;
} & {
  _current: T | null;
  _subscriptions: (() => void)[];
  _customMap: Record<keyof T, (value: T[keyof T]) => void> | null;
  cleanup(): void;
};

const refs = new Map<string, Ref<any>>();

function createSignal<T>(value?: T[keyof T]): Signal<T[keyof T]> {
  return signal<T[keyof T]>(value as T[keyof T]);
}

// Back in Phaser this made sense, because I had jsx doing some of the work
// in here I'm trying to go less nosense
/* 
function subscribeSignal<T>(
  target: Ref<T>,
  prop: keyof T,
  s: Signal<T[keyof T]>
) {
  let cleanup: (() => void) | undefined;
  if (target._customMap && target._customMap[prop]) {
    cleanup = s.subscribe((value) => target._customMap![prop](value));
  } else {
    cleanup = subscribeToGameObjectProperty(target._current, prop as string, s);
  }

  return cleanup;
}
*/

function subscribeToContainerProperty(container: Container, property: string, s: Signal<any>): () => void {
  let cleanup: (() => void) | undefined;

  if (property === 'some-custom-map-value') {
    // cleanup = s.subscribe((value) => container.setWordWrapWidth(value, true));
  } else if (property === 'nothing-to-put-in-here-yet') {
    throw new Error(`Not sure why we'd subscribe to this property... keeping it 'dead'`);
  } else {
    // @ts-expect-error - we're not sure what the property is
    cleanup = s.subscribe((value) => (container[property] = value));
  }

  return cleanup!;
}

function subscribeSignal<T>(target: Ref<T>, prop: keyof T, s: Signal<T[keyof T]>) {
  if (!target._current) {
    throw new Error('Ref is not initialized');
  }

  let cleanup: () => void;
  if (target._customMap && target._customMap[prop]) {
    return s.subscribe((value) => target._customMap![prop](value));
  } else {
    cleanup = subscribeToContainerProperty(target._current as unknown as Container, prop as string, s);
  }

  return cleanup;
}

export function pickRef<T>(name: string): Ref<T> {
  if (!refs.has(name)) {
    createRef(name);
  }

  return refs.get(name) as Ref<T>;
}

export function createRef<T>(name?: string): Ref<T> {
  if (name && refs.has(name)) {
    return refs.get(name) as Ref<T>;
  }

  const ref: Ref<T> = {
    _current: null,
    _subscriptions: [],
    _customMap: null,
    cleanup: () => {
      ref._subscriptions.forEach((cleanup) => cleanup());
      ref._subscriptions = [];
      ref._current = null;
      ref._customMap = null;
    },
  } as Ref<T>;

  const propsOnHold: Record<keyof T, Signal<T[keyof T]>> = {} as Record<keyof T, Signal<T[keyof T]>>;

  const p = new Proxy(ref, {
    get: (target, prop) => {
      if (Reflect.has(target, prop)) {
        return Reflect.get(target, prop);
      }

      if (!target._current) {
        propsOnHold[prop as keyof T] = createSignal<T>();
        Reflect.set(target, prop, propsOnHold[prop as keyof T]);
        return propsOnHold[prop as keyof T];
      }

      const s = createSignal<T>(target._current[prop as keyof T]);
      const cleanup = subscribeSignal(target, prop as keyof T, s);
      target._subscriptions.push(cleanup);
      Reflect.set(target, prop, s);

      return s;
    },
    set: (target, prop, value) => {
      if (prop === '_current') {
        target._current = value;
        Object.entries(propsOnHold).forEach(([key, signal]) => {
          if ((signal as Signal<T[keyof T]>).get() === undefined) {
            (signal as Signal<T[keyof T]>).set(value[key]);
          }
          const cleanup = subscribeSignal(target, key as keyof T, signal as Signal<T[keyof T]>);
          target._subscriptions.push(cleanup);
        });
        return true;
      }

      if (prop === '_customMap') {
        target._customMap = value;
        return true;
      }

      console.error("As far as I can tell as of now, you shouldn't be doing this");

      return false;
    },
  });

  if (name) {
    refs.set(name, p);
  }

  return p;
}
