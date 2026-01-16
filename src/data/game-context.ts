import type { b2WorldId } from 'phaser-box2d';
import { Container, type Application } from 'pixi.js';

import type { EventContext } from '@/core/game/EventEmitter';
import type { SystemRunner } from '@/core/game/SystemRunner';
import type { LayerName } from '@/core/window/types';
import { LayoutContainer } from '@pixi/layout/components';
import { getRunState } from './game-state';

/**
 * Core Game Types
 *
 * This file contains types specific to the game implementation/runtime.
 * For game state data structures, see @/data/game-state.ts
 */

/** Current phase of the game */
export type GamePhase = 'idle' | 'map' | 'level' | 'cutscene' | 'transition' | 'paused' | 'shop';

/** Z-ordered rendering layers - all layers always exist, fully typed */
export interface GameLayers {
  /** Background layer (lowest z-index) */
  background: LayoutContainer;
  /** Main game layer for gameplay objects */
  game: LayoutContainer;
  /** Effects layer for particles, trails */
  effects: LayoutContainer;
  /** UI overlay layer for HUD, dialogs */
  ui: LayoutContainer;
  /** Debug layer (highest z-index) */
  debug: LayoutContainer;
}

/** Layer z-order (lowest to highest) */
export const LAYER_ORDER: LayerName[] = ['background', 'game', 'effects', 'ui', 'debug'];

/** Shared context passed throughout the game */
export interface GameContext {
  /** The Pixi application */
  app: Application;

  /** The Box2D world ID (set by PhysicsSystem when active) */
  worldId: b2WorldId | null;

  /** Z-ordered rendering layers (set by NavigationSystem) */
  layers: GameLayers | null;

  /** Current screen's game container (set by GameScreen when active) */
  container: Container | null;

  // Systems
  systems: SystemRunner;

  // Phase tracking
  phase: GamePhase;

  // Event system
  events: EventContext;
}

let gameContext: GameContext | null = null;

export function createGameContext(app: Application, events: EventContext, systems: SystemRunner): GameContext {
  return {
    app,
    events,
    systems,
    worldId: null,
    layers: null,
    container: null,
    phase: 'idle',
  };
}

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
