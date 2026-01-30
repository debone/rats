import { GameEvent, type GameEventName, type GameEventPayload } from '@/data/events';

/**
 * Typed event emitter for game events.
 * All events must be registered in @/data/events.ts
 */
export class EventEmitter {
  private listeners: Map<GameEventName, Set<Function>> = new Map();

  /**
   * Listen for an event
   */
  on<K extends GameEventName>(event: K, listener: (payload: GameEventPayload<K>) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  /**
   * Listen for an event once
   */
  once<K extends GameEventName>(event: K, listener: (payload: GameEventPayload<K>) => void): void {
    const wrapper = (payload: GameEventPayload<K>) => {
      this.off(event, wrapper);
      listener(payload);
    };
    this.on(event, wrapper);
  }

  /**
   * Remove an event listener
   */
  off<K extends GameEventName>(event: K, listener: (payload: GameEventPayload<K>) => void): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Emit an event with typed payload
   */
  emit<K extends GameEventName>(
    event: K,
    ...args: GameEventPayload<K> extends void ? [] : [GameEventPayload<K>]
  ): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const payload = args[0];
      listeners.forEach((listener) => listener(payload));
    }
  }

  /**
   * Wait for an event and return its payload as a promise
   */
  wait<K extends GameEventName>(event: K): Promise<GameEventPayload<K>> {
    return new Promise((resolve) => {
      this.once(event, resolve);
    });
  }

  waitForPayload<K extends GameEventName>(
    event: K,
    matchingPayload?: GameEventPayload<K>,
  ): Promise<GameEventPayload<K>> {
    return new Promise((resolve) => {
      this.once(event, (payload) => {
        // Use JSON.stringify for deep comparison (native JS, safest coverage)
        // IMPROVE: if you find yourself face palming here on your first bug, convert to a EVENT:{ID} approach where you can make the second part open (and I think it's still typeable to TS)
        // also... sorry from 2025-11
        if (matchingPayload && JSON.stringify(payload) !== JSON.stringify(matchingPayload)) {
          return;
        }
        resolve(payload);
      });
    });
  }

  /**
   * Remove all listeners
   */
  clear(): void {
    this.listeners.clear();
  }
}

/**
 * Type-safe event context for game components.
 * Provides a clean interface for emitting and listening to events.
 */
export class EventContext {
  #emitter: EventEmitter;

  constructor(emitter: EventEmitter) {
    this.#emitter = emitter;
  }

  /**
   * Listen for an event
   */
  on<K extends GameEventName>(event: K, listener: (payload: GameEventPayload<K>) => void): () => void {
    this.#emitter.on(event, listener);
    return () => this.off(event, listener);
  }

  /**
   * Listen for an event once
   */
  once<K extends GameEventName>(event: K, listener: (payload: GameEventPayload<K>) => void): void {
    this.#emitter.once(event, listener);
  }

  /**
   * Remove an event listener
   */
  off<K extends GameEventName>(event: K, listener: (payload: GameEventPayload<K>) => void): void {
    this.#emitter.off(event, listener);
  }

  /**
   * Emit an event
   */
  emit<K extends GameEventName>(
    event: K,
    ...args: GameEventPayload<K> extends void ? [] : [GameEventPayload<K>]
  ): void {
    if (event === GameEvent.SHOW_SCREEN) {
      debugger;
    }
    console.log('[EventContext] Emitting event:', event, args);
    this.#emitter.emit(event, ...args);
  }

  /**
   * Wait for an event
   */
  wait<K extends GameEventName>(event: K, matchingPayload?: GameEventPayload<K>): Promise<GameEventPayload<K>> {
    if (matchingPayload) {
      return this.#emitter.waitForPayload(event, matchingPayload);
    }
    return this.#emitter.wait(event);
  }
}
