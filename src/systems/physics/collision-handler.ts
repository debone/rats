import type { GameContext } from '@/data/game-context';
import { type b2BodyId } from 'phaser-box2d';

/**
 * Represents a collision between two bodies with their user data
 */
export interface CollisionPair {
  /** First body (alphabetically first by type) */
  bodyA: b2BodyId;
  /** Second body (alphabetically second by type) */
  bodyB: b2BodyId;
  /** User data from first body */
  userDataA: { type: string; [key: string]: unknown };
  /** User data from second body */
  userDataB: { type: string; [key: string]: unknown };
}

/**
 * Handler function for a collision between two specific types
 */
export type CollisionHandler = (pair: CollisionPair, context: GameContext) => void;

/**
 * Registry for collision handlers using double dispatch pattern.
 *
 * Handlers are registered for specific type pairs (e.g., 'ball' + 'brick').
 * When a collision occurs, the registry looks up the handler in O(1) time.
 *
 * The pair is always normalized so that bodyA.type < bodyB.type alphabetically.
 * This means when you register a handler for ('ball', 'brick'), the handler
 * will always receive bodyA as the ball and bodyB as the brick.
 *
 * @example
 * ```ts
 * const registry = new CollisionHandlerRegistry();
 *
 * // Register handler - 'ball' < 'brick', so pair.bodyA = ball, pair.bodyB = brick
 * registry.register('ball', 'brick', (pair, ctx) => {
 *   console.log('Ball hit brick!');
 *   registry.queueDestruction(pair.bodyB); // Destroy the brick
 * });
 *
 * // In your update loop:
 * for (const event of contactEvents) {
 *   registry.handle({ bodyA, bodyB, userDataA, userDataB }, context);
 * }
 * registry.flushDestructions();
 * ```
 */
export class CollisionHandlerRegistry {
  private handlers = new Map<string, CollisionHandler>();

  /**
   * Creates a normalized key for a type pair.
   * Types are sorted alphabetically so order doesn't matter when registering.
   */
  private makeKey(typeA: string, typeB: string): string {
    return typeA < typeB ? `${typeA}:${typeB}` : `${typeB}:${typeA}`;
  }

  /**
   * Register a handler for collisions between two types.
   *
   * @param typeA - First body type
   * @param typeB - Second body type
   * @param handler - Handler function to call on collision
   */
  register(typeA: string, typeB: string, handler: CollisionHandler): this {
    this.handlers.set(this.makeKey(typeA, typeB), handler);
    return this;
  }

  /**
   * Unregister a handler for a type pair.
   */
  unregister(typeA: string, typeB: string): this {
    this.handlers.delete(this.makeKey(typeA, typeB));
    return this;
  }

  /**
   * Normalizes the pair so bodyA.type is always alphabetically first.
   * This ensures consistent handler signatures.
   */
  private normalizePair(pair: CollisionPair): CollisionPair {
    if (pair.userDataA.type <= pair.userDataB.type) {
      return pair;
    }
    return {
      bodyA: pair.bodyB,
      bodyB: pair.bodyA,
      userDataA: pair.userDataB,
      userDataB: pair.userDataA,
    };
  }

  /**
   * Handle a collision between two bodies.
   * Looks up the appropriate handler and calls it with the normalized pair.
   *
   * @param pair - The collision pair (will be normalized internally)
   * @param context - Game context
   * @returns true if a handler was found and called
   */
  handle(pair: CollisionPair, context: GameContext): boolean {
    const key = this.makeKey(pair.userDataA.type, pair.userDataB.type);
    const handler = this.handlers.get(key);

    if (handler) {
      handler(this.normalizePair(pair), context);
      return true;
    }

    return false;
  }

  /**
   * Check if a handler is registered for a type pair.
   */
  hasHandler(typeA: string, typeB: string): boolean {
    return this.handlers.has(this.makeKey(typeA, typeB));
  }

  /**
   * Clear all registered handlers.
   */
  clear(): void {
    this.handlers.clear();
  }
}
