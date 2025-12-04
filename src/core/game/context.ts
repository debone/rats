/**
 * Global Game Context
 *
 * The game context is created at app startup and shared across all systems and screens.
 */

import type { GameContext } from '../../data/game-context';

let gameContext: GameContext | null = null;

/**
 * Set the global game context (called once at bootstrap)
 */
export function setGameContext(context: GameContext): void {
  gameContext = context;
}

/**
 * Get the global game context
 */
export function getGameContext(): GameContext {
  if (!gameContext) {
    throw new Error('[GameContext] Context not initialized. Call setGameContext first.');
  }
  return gameContext;
}

/**
 * Check if game context is initialized
 */
export function hasGameContext(): boolean {
  return gameContext !== null;
}
