import type { b2WorldId } from 'phaser-box2d';
import { Container, type Application } from 'pixi.js';

import type { Camera } from '@/core/camera/camera';
import type { EventContext } from '@/core/game/EventEmitter';
import type { SystemRunner } from '@/core/game/SystemRunner';
import type { Navigation } from '@/core/window/navigation';
import type { LayerName } from '@/core/window/types';
import { LayoutContainer } from '@pixi/layout/components';

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
  game: Container;
  /** Effects layer for particles, trails */
  effects: Container;
  /** UI overlay layer for HUD, dialogs */
  ui: LayoutContainer;
  /** Popup layer */
  popup: Container;
  /** Overlay layer for elements that need to be on top of everything */
  overlay: LayoutContainer;
  /** Debug layer (highest z-index) */
  debug: LayoutContainer;
}

/** Layer z-order (lowest to highest)
 * FIXME: not true since we have cameras, but not sure what to fix here
 */
export const LAYER_ORDER: LayerName[] = ['background', 'game', 'effects', 'ui', 'popup', 'overlay', 'debug'];

/** Shared context passed throughout the game */
export interface GameContext {
  /** The Pixi application */
  app: Application;

  /** The Box2D world ID (set by PhysicsSystem when active) */
  worldId: b2WorldId | null;

  /** Navigation singleton */
  navigation: Navigation;

  /** Camera for visual effects (set when layers are created) */
  camera: Camera;

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

export function createGameContext(
  app: Application,
  events: EventContext,
  systems: SystemRunner,
  camera: Camera,
  navigation: Navigation,
): GameContext {
  return {
    app,
    events,
    systems,
    camera,
    navigation,
    worldId: null,
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
