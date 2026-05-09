import { type GameEventName, type GameEventPayload, type GameEvents } from '@/data/events';

/**
 * Typed event emitter.
 *
 * Generic over a map of `{ eventName: payloadType }` so it can serve both the
 * global game bus (`EventEmitter<GameEvents>`, the default) and any per-entity
 * local event bag (`EventEmitter<BrickEvents>`, etc.).
 */
export class EventEmitter<TMap extends Record<string, any> = GameEvents> {
  private listeners: Map<keyof TMap, Set<Function>> = new Map();

  on<K extends keyof TMap>(event: K, listener: (payload: TMap[K]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  once<K extends keyof TMap>(event: K, listener: (payload: TMap[K]) => void): void {
    const wrapper = (payload: TMap[K]) => {
      this.off(event, wrapper as any);
      listener(payload);
    };
    this.on(event, wrapper);
  }

  off<K extends keyof TMap>(event: K, listener: (payload: TMap[K]) => void): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  emit<K extends keyof TMap>(event: K, ...args: TMap[K] extends void ? [] : [TMap[K]]): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const payload = args[0];
      // Use array for loop to avoid concurrent modification issues
      const listenersArray = Array.from(listeners);
      for (const listener of listenersArray) {
        listener(payload);
      }
    }
  }

  wait<K extends keyof TMap>(event: K): Promise<TMap[K]> {
    return new Promise((resolve) => {
      this.once(event, resolve);
    });
  }

  waitForPayload<K extends keyof TMap>(event: K, matchingPayload?: TMap[K]): Promise<TMap[K]> {
    return new Promise((resolve) => {
      this.once(event, (payload) => {
        // IMPROVE: EVENT:{ID} approach would give open typing while staying type-safe
        if (matchingPayload && JSON.stringify(payload) !== JSON.stringify(matchingPayload)) {
          return;
        }
        resolve(payload);
      });
    });
  }

  clear(): void {
    this.listeners.clear();
  }
}

/**
 * Wrapper around the global EventEmitter that exposes `on` returning an
 * unsubscribe function (handy for effect cleanup) and restricts callers to
 * the global GameEvents map.
 */
export class EventContext {
  #emitter: EventEmitter<GameEvents>;

  constructor(emitter: EventEmitter<GameEvents>) {
    this.#emitter = emitter;
  }

  on<K extends GameEventName>(event: K, listener: (payload: GameEventPayload<K>) => void): () => void {
    this.#emitter.on(event, listener);
    return () => this.off(event, listener);
  }

  once<K extends GameEventName>(event: K, listener: (payload: GameEventPayload<K>) => void): void {
    this.#emitter.once(event, listener);
  }

  off<K extends GameEventName>(event: K, listener: (payload: GameEventPayload<K>) => void): void {
    this.#emitter.off(event, listener);
  }

  emit<K extends GameEventName>(
    event: K,
    ...args: GameEventPayload<K> extends void ? [] : [GameEventPayload<K>]
  ): void {
    this.#emitter.emit(event, ...args);
  }

  wait<K extends GameEventName>(event: K, matchingPayload?: GameEventPayload<K>): Promise<GameEventPayload<K>> {
    if (matchingPayload) {
      return this.#emitter.waitForPayload(event, matchingPayload);
    }
    return this.#emitter.wait(event);
  }
}
