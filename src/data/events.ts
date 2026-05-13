/**
 * Game Event Registry
 *
 * All game events are defined here with their payload types.
 * This provides type safety for the event system.
 *
 * Event names are exported as constants so you can cmd+click to find all usages.
 */

import type { LevelResult, MapSelection, RunState } from './game-state';

/**
 * Event name constants - use these for cmd+click navigation
 *
 * @example
 * events.emit(GameEvent.LEVEL_STARTED, { levelId: 'level-1' });
 * events.on(GameEvent.LEVEL_WON, (result) => { ... });
 */
export const GameEvent = {
  // System events
  SAVE_COMPLETED: 'save:completed',
  SAVE_FAILED: 'save:failed',

  // Screen navigation
  SCREEN_READY: 'screen:ready',
  SCREEN_UNLOADED: 'screen:unloaded',
  OVERLAY_READY: 'overlay:ready',
  OVERLAY_UNLOADED: 'overlay:unloaded',

  // Run lifecycle
  START_NEW_RUN: 'run:start-new',
  RESUME_RUN: 'run:resume',
  CAMPAIGN_LEVEL_WON: 'campaign:level-won',
  CAMPAIGN_LEVEL_LOST: 'campaign:level-lost',

  // Game flow events
  GAME_SHOW_MAP: 'game:show-map',
  MAP_LEVEL_SELECTED: 'map:level-selected',
  GAME_OVER_ACTION: 'game-over:action',
  GAME_OVER_DATA: 'game-over:data',
  GAME_QUIT: 'game:quit',

  // Gameplay events
  BALL_EXITED: 'ball:exited',
  BALL_LOST: 'ball:lost',

  // Crew ability events (fired by active abilities, handled by entities)
  CREW_SHOOT_BALL: 'crew:shoot-ball',
  CREW_DOUBLE_BALLS: 'crew:double-balls',
} as const;

/**
 * Registry of all game events and their payload types.
 */
type GameEventKeys = keyof typeof GameEvent;

type EnsureAllGameEventKeys<T extends Record<GameEventKeys, any>> = T;

export interface GameEvents extends EnsureAllGameEventKeys<typeof GameEvent> {
  // System events
  [GameEvent.SAVE_COMPLETED]: void;
  [GameEvent.SAVE_FAILED]: { error: Error };

  // Screen navigation
  [GameEvent.SCREEN_READY]: { screenId: string };
  [GameEvent.SCREEN_UNLOADED]: { screenId: string };
  [GameEvent.OVERLAY_READY]: { overlayId: string };
  [GameEvent.OVERLAY_UNLOADED]: { overlayId: string };

  // Run lifecycle
  [GameEvent.START_NEW_RUN]: { startingLevelId: string };
  [GameEvent.RESUME_RUN]: { run: RunState };
  [GameEvent.CAMPAIGN_LEVEL_WON]: { levelId: string };
  [GameEvent.CAMPAIGN_LEVEL_LOST]: void;

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
  [GameEvent.BALL_EXITED]: void;
  [GameEvent.BALL_LOST]: void;

  // Crew ability events
  [GameEvent.CREW_SHOOT_BALL]: void;
  [GameEvent.CREW_DOUBLE_BALLS]: void;
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
