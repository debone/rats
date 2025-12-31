import { signal } from './signals';
import type { Signal } from './types';

export class SignalCollection<T> {
  private items: Signal<T>[] = [];

  onAdd = signal<{ item: Signal<T>; index: number } | null>(null);
  onRemove = signal<{ item: Signal<T>; index: number } | null>(null);
  onChange = signal<Signal<T>[]>([]); // When the whole array structure changes

  constructor(initialItems: T[] = []) {
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

  getAll(): T[] {
    return this.items.map((item) => item.get());
  }

  push(item: T): Signal<T> {
    const itemSignal = signal(item);
    this.items.push(itemSignal);
    this.onAdd.set({ item: itemSignal, index: this.items.length - 1 });
    this.onChange.set([...this.items]);
    return itemSignal;
  }

  remove(index: number): Signal<T> | undefined {
    const removed = this.items.splice(index, 1)[0];
    if (removed) {
      this.onRemove.set({ item: removed, index });
      this.onChange.set([...this.items]);
    }
    return removed;
  }

  set(newItems: T[]) {
    // Clear existing items
    while (this.items.length > 0) {
      this.remove(this.items.length - 1);
    }

    // Add new items
    newItems.forEach((item) => {
      this.push(item);
    });
  }

  updateAt(index: number, newValue: T) {
    const item = this.items[index];
    if (item) {
      item.set(newValue);
    }
  }
}
