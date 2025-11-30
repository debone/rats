import { createDefaultMetaState, createDefaultRunState } from './game-state';
import type { MetaGameState, RunState } from './game-state';

export const META_SAVE_KEY = 'game_meta';
export const RUN_SAVE_KEY = 'game_run';

export const DEFAULT_STORAGE = {
  /**
   * Indicates if the audio is muted
   */
  muted: false,
  /**
   * The highest score achieved by the player
   */
  [META_SAVE_KEY]: createDefaultMetaState() as MetaGameState,
  [RUN_SAVE_KEY]: createDefaultRunState() as RunState,
};
