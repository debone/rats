import type { Application, Container } from 'pixi.js';
import type { b2WorldId } from 'phaser-box2d';

import type { SystemRunner } from '@/core/game/SystemRunner';
import type { EventContext } from '@/core/game/EventEmitter';
import type { MetaGameState, RunState, LevelState, LevelResult } from '@/data/game-state';

/**
 * Core Game Types
 *
 * This file contains types specific to the game implementation/runtime.
 * For game state data structures, see @/data/game-state.ts
 */

/** Current phase of the game */
export type GamePhase = 'idle' | 'map' | 'level' | 'cutscene' | 'transition' | 'paused' | 'shop';

/** Shared context passed throughout the game */
export interface GameContext {
  /** The Pixi application */
  app: Application;

  /** The Box2D world ID (set by PhysicsSystem when active) */
  worldId: b2WorldId | null;

  /** Main game container for rendering */
  container: Container | null;

  // State management
  meta: MetaGameState;
  run: RunState | null;
  level: LevelState | null;

  // Systems
  systems: SystemRunner;

  // Phase tracking
  phase: GamePhase;

  // Event system
  events: EventContext;
}

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
