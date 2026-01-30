/**
 * Game Event Registry
 *
 * All game events are defined here with their payload types.
 * This provides type safety for the event system.
 *
 * Event names are exported as constants so you can cmd+click to find all usages.
 */

import type { AppScreenConstructor } from '@/core/window/types';
import type { LevelResult, MapSelection } from './game-state';

/**
 * Event name constants - use these for cmd+click navigation
 *
 * @example
 * events.emit(GameEvent.LEVEL_STARTED, { levelId: 'level-1' });
 * events.on(GameEvent.LEVEL_WON, (result) => { ... });
 */
export const GameEvent = {
  // App lifecycle
  APP_START: 'app:start',
  ASSETS_LOADED: 'assets:loaded',

  // Screen navigation
  SHOW_SCREEN: 'screen:show',
  UNLOAD_SCREEN: 'screen:unload',
  SCREEN_READY: 'screen:ready',
  SCREEN_UNLOADED: 'screen:unloaded',

  SHOW_OVERLAY: 'overlay:show',
  DISMISS_OVERLAY: 'overlay:dismiss',
  OVERLAY_READY: 'overlay:ready',
  OVERLAY_UNLOADED: 'overlay:unloaded',

  // Run lifecycle
  START_NEW_RUN: 'run:start-new',
  RESUME_RUN: 'run:resume',

  // Level events
  LEVEL_STARTED: 'level:started',
  LEVEL_WON: 'level:won',
  LEVEL_LOST: 'level:lost',

  // Game flow events
  GAME_SHOW_MAP: 'game:show-map',
  MAP_LEVEL_SELECTED: 'map:level-selected',
  GAME_OVER_ACTION: 'game-over:action',
  GAME_OVER_DATA: 'game-over:data',
  GAME_QUIT: 'game:quit',

  // Gameplay events
  BRICK_DESTROYED: 'brick:destroyed',
  POWERUP_ACTIVATED: 'powerup:activated',

  // System events
  SAVE_COMPLETED: 'save:completed',
  SAVE_FAILED: 'save:failed',
} as const;

/**
 * Registry of all game events and their payload types.
 */
type GameEventKeys = keyof typeof GameEvent;

type EnsureAllGameEventKeys<T extends Record<GameEventKeys, any>> = T;

export interface GameEvents extends EnsureAllGameEventKeys<typeof GameEvent> {
  // App lifecycle
  [GameEvent.APP_START]: void;
  [GameEvent.ASSETS_LOADED]: void;

  // Screen navigation
  [GameEvent.SHOW_SCREEN]: { screen: AppScreenConstructor };
  [GameEvent.SCREEN_READY]: { screenId: string };
  [GameEvent.UNLOAD_SCREEN]: { screen: AppScreenConstructor };
  [GameEvent.SCREEN_UNLOADED]: { screenId: string };

  [GameEvent.SHOW_OVERLAY]: { overlay: AppScreenConstructor };
  [GameEvent.DISMISS_OVERLAY]: void;
  [GameEvent.OVERLAY_READY]: { overlayId: string };
  [GameEvent.OVERLAY_UNLOADED]: { overlayId: string };

  // Run lifecycle
  [GameEvent.START_NEW_RUN]: { startingLevelId: string };
  [GameEvent.RESUME_RUN]: { run: import('./game-state').RunState };

  // Level events
  [GameEvent.LEVEL_STARTED]: { levelId: string };
  [GameEvent.LEVEL_WON]: LevelResult;
  [GameEvent.LEVEL_LOST]: LevelResult;

  // Game flow events
  [GameEvent.GAME_SHOW_MAP]: {
    completedLevel: string | null;
    result: LevelResult | null;
  };
  [GameEvent.MAP_LEVEL_SELECTED]: MapSelection;
  [GameEvent.GAME_OVER_ACTION]: 'restart' | 'quit';
  [GameEvent.GAME_OVER_DATA]: {
    score: number;
    levelsCompleted: string[];
  };
  [GameEvent.GAME_QUIT]: void;

  // Gameplay events
  [GameEvent.BRICK_DESTROYED]: {
    brickId: string;
    position: { x: number; y: number };
    score: number;
  };
  [GameEvent.POWERUP_ACTIVATED]: {
    type: string;
  };

  // System events
  [GameEvent.SAVE_COMPLETED]: void;
  [GameEvent.SAVE_FAILED]: { error: Error };
}

/**
 * Get the event names as a union type
 */
export type GameEventName = keyof GameEvents;

/**
 * Get the payload type for a specific event
 */
export type GameEventPayload<K extends GameEventName> = GameEvents[K];

/**
 * Helper type to extract payload type from GameEvent constant
 *
 * @example
 * type Payload = EventPayload<typeof GameEvent.LEVEL_WON>;
 * // => LevelResult
 */
export type EventPayload<E extends GameEventName> = GameEvents[E];

/**
 * Helper type for event handler functions
 *
 * @example
 * const handler: EventHandler<typeof GameEvent.LEVEL_WON> = (result) => {
 *   // result is typed as LevelResult
 * };
 */
export type EventHandler<E extends GameEventName> = GameEvents[E] extends void
  ? () => void
  : (payload: GameEvents[E]) => void;
