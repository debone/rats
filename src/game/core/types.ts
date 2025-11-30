import type { Container } from 'pixi.js';
import type { b2WorldId } from 'phaser-box2d';
import type { GameScreen } from '@/screens/GameScreen';
import type { SystemRunner } from './SystemRunner';
import type { EventContext } from './EventEmitter';
import type { MetaGameState, RunState, LevelState } from '@/data/game-state';

/**
 * Core Game Types
 *
 * This file contains types specific to the game implementation/runtime.
 * For game state data structures, see @/data/game-state.ts
 */

/** Current phase of the game */
export type GamePhase = 'idle' | 'map' | 'level' | 'cutscene' | 'transition' | 'paused';

/** Shared context passed throughout the game */
export interface GameContext {
  // References to important objects
  screen: GameScreen;
  worldId: b2WorldId;
  container: Container;

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

// Re-export data types for convenience
export type { MetaGameState, RunState, LevelState, Boon, LevelResult, MapSelection } from '@/data/game-state';
