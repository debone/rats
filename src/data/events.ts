/**
 * Game Event Registry
 *
 * All game events are defined here with their payload types.
 * This provides type safety for the event system.
 *
 * Event names are exported as constants so you can cmd+click to find all usages.
 */

import type { LevelResult, MapSelection } from './game-state';

/**
 * Event name constants - use these for cmd+click navigation
 *
 * @example
 * events.emit(GameEvent.LEVEL_STARTED, { levelId: 'level-1' });
 * events.on(GameEvent.LEVEL_WON, (result) => { ... });
 */
export const GameEvent = {
  // Level events
  LEVEL_STARTED: 'level:started',
  LEVEL_WON: 'level:won',
  LEVEL_LOST: 'level:lost',
  LEVEL_COMPLETE: 'level:complete',

  // Game flow events
  GAME_SHOW_MAP: 'game:show-map',
  MAP_LEVEL_SELECTED: 'map:level-selected',
  GAME_SHOW_GAME_OVER: 'game:show-game-over',
  GAME_OVER_ACTION: 'game-over:action',
  GAME_QUIT: 'game:quit',

  // Gameplay events
  BRICK_DESTROYED: 'brick:destroyed',
  BOON_ACQUIRED: 'boon:acquired',
  POWERUP_COLLECTED: 'powerup:collected',
  BALL_LOST: 'ball:lost',

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
  // Level events
  [GameEvent.LEVEL_STARTED]: { levelId: string };
  [GameEvent.LEVEL_WON]: LevelResult;
  [GameEvent.LEVEL_LOST]: LevelResult;
  [GameEvent.LEVEL_COMPLETE]: LevelResult;

  // Game flow events
  [GameEvent.GAME_SHOW_MAP]: {
    completedLevel: string;
    result: LevelResult;
  };
  [GameEvent.MAP_LEVEL_SELECTED]: MapSelection;
  [GameEvent.GAME_SHOW_GAME_OVER]: {
    score: number;
    levelsCompleted: number;
  };
  [GameEvent.GAME_OVER_ACTION]: 'restart' | 'quit';
  [GameEvent.GAME_QUIT]: void;

  // Gameplay events
  [GameEvent.BRICK_DESTROYED]: {
    brickId: string;
    position: { x: number; y: number };
    score: number;
  };
  [GameEvent.BOON_ACQUIRED]: {
    boonId: string;
    source: 'level' | 'brick' | 'event';
  };
  [GameEvent.POWERUP_COLLECTED]: {
    powerupId: string;
    type: string;
  };
  [GameEvent.BALL_LOST]: {
    ballsRemaining: number;
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
