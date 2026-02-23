import { SignalImpl } from '@/core/reactivity/signals/signals';
import type { Signal } from '@/core/reactivity/signals/types';
import { cleanupSymbol, type SignalCleanup } from '@/core/reactivity/signals/types';
import type { Container, ContainerChild } from 'pixi.js';

// Signal binding

export function createSignalBinding(
  target: Container & Partial<SignalCleanup>,
  property: string,
  signal: Signal<any>,
  setter: (obj: Container, key: string, value: any) => void,
): () => void {
  const cleanup = signal.subscribe((value) => setter(target, property, value));

  if (!target[cleanupSymbol]) {
    target[cleanupSymbol] = [];
  }
  target[cleanupSymbol].push(cleanup);

  return cleanup;
}

// Property application
const IGNORED_PROPS = new Set(['children', 'ref', 'bind', 'draw']);

export function applyProps(
  target: Container,
  props: Record<string, any>,
  setter: (obj: Container, key: string, value: any) => void,
  extraIgnore?: Set<string>,
): void {
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue;
    if (IGNORED_PROPS.has(key)) continue;
    if (extraIgnore?.has(key)) continue;

    if (value instanceof SignalImpl) {
      createSignalBinding(target, key, value, setter);
    } else {
      setter(target, key, value);
    }
  }

  if (props.bind) {
    for (const [key, signal] of Object.entries(props.bind)) {
      createSignalBinding(target, key, signal as Signal<any>, setter);
    }
  }

  if (props.ref) {
    props.ref(target);
  }
}

export function normalizeChildren(children: any): ContainerChild[] {
  if (children == null) return [];
  if (Array.isArray(children)) return children.flat(Infinity).filter(Boolean) as ContainerChild[];
  return [children] as ContainerChild[];
}

export function addChildren(parent: Container, children: any): void {
  for (const child of normalizeChildren(children)) {
    parent.addChild(child);
  }
}
