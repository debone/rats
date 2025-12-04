/**
 * Game State Data Structures
 *
 * This file contains all the core data structures for game state.
 * These are pure data definitions without implementation logic.
 */

/** Boon/powerup that carries across levels */
export interface Boon {
  id: string;
  name: string;
  description: string;
  type: 'ball' | 'paddle' | 'brick' | 'meta';
  effect: any; // Can be typed more specifically per boon
}

/** Persistent meta-game state - survives across sessions */
export interface MetaGameState {
  // Progression
  runs: number;
  unlockedLevels: string[];
  completedLevels: string[];
  highScores: Record<string, number>;

  // Meta progression
  permanentUpgrades: string[];
  totalCoins: number;
  achievements: string[];

  // Last session info for restoration
  lastPlayedLevel?: string;
  currentRun?: RunState;
}

/** Current run state - survives across levels in same run */
export interface RunState {
  // What level you're on
  currentLevelId: string;
  levelsCompleted: string[];

  // Run-specific state
  activeBoons: Boon[];
  temporaryUpgrades: string[];
  lives: number;
  score: number;

  // Any other run-scoped data
  difficulty: number;
  seed?: string;
}

/** In-level state - specific to current level instance */
export interface LevelState {
  ballsRemaining: number;
  bricksDestroyed: number;
  powerupsCollected: string[];
  elapsedTime: number;
}

/** Result of completing a level */
export interface LevelResult {
  success: boolean;
  score: number;
  boonsEarned: Boon[];
  timeElapsed: number;
  perfectClear?: boolean;
}

/** Map selection from player */
export interface MapSelection {
  levelId: string;
}

/** Create a default meta state */
export function createDefaultMetaState(): MetaGameState {
  return {
    runs: 0,
    unlockedLevels: ['level-1'],
    completedLevels: [],
    highScores: {},
    permanentUpgrades: [],
    totalCoins: 0,
    achievements: [],
  };
}

/** Create a default run state */
export function createDefaultRunState(): RunState {
  return {
    currentLevelId: 'level-1',
    levelsCompleted: [],
    activeBoons: [],
    temporaryUpgrades: [],
    lives: 3,
    score: 0,
    difficulty: 1,
  };
}

/** Create a default level state */
export function createDefaultLevelState(): LevelState {
  return {
    ballsRemaining: 3,
    bricksDestroyed: 0,
    powerupsCollected: [],
    elapsedTime: 0,
  };
}
