import type { GameEventName, GameEventPayload } from '@/data/events';

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
  on<K extends GameEventName>(event: K, listener: (payload: GameEventPayload<K>) => void): void {
    this.#emitter.on(event, listener);
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
    this.#emitter.emit(event, ...args);
  }

  /**
   * Wait for an event
   */
  wait<K extends GameEventName>(event: K): Promise<GameEventPayload<K>> {
    return this.#emitter.wait(event);
  }
}
