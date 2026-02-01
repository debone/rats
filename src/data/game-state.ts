/**
 * Game State Data Structures
 *
 * This file contains all the core data structures for game state.
 * These are pure data definitions without implementation logic.
 */

import { createKeyedCollection, SignalCollection } from '@/core/reactivity/signals/signal-collection';
import { signal } from '@/core/reactivity/signals/signals';
import type { Signal } from '@/core/reactivity/signals/types';
import {
  CaptainCrewMember,
  CrewMember,
  DoublerCrewMember,
  EmptyCrewMember,
  FasterCrewMember,
} from '@/screens/GameScreen/ui/CrewIndicator';
import type { LevelConfig } from '@/systems/level/Level';
import { GameEvent } from './events';
import { getGameContext } from './game-context';

export interface GameState {
  meta: MetaGameState;
  run: RunState;
  level: LevelState;
}

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
  completedLevels: Set<string>;
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

  ballsRemaining: Signal<number>;

  scrapsCounter: Signal<number>;
  crewMembers: SignalCollection<CrewMember>;
  // Run-specific state
  // activeBoons: Boon[];
  // temporaryUpgrades: string[];
  // lives: number;
  // score: number;

  // Any other run-scoped data
  // difficulty: number;
  // seed?: string;
}

/** In-level state - specific to current level instance */
export interface LevelState {
  levelId: string;
  levelName: Signal<string>;
  //bricksDestroyed: number;
  //powerupsCollected: string[];
  //elapsedTime: number;
}

/** Result of completing a level */
export interface LevelResult {
  levelId: string;
  success: boolean;
  //score: number;
  //boonsEarned: Boon[];
  //timeElapsed: number;
  //perfectClear?: boolean;
}

/** Map selection from player */
export interface MapSelection {
  levelId: string;
}

let gameState: GameState | null = null;

function getGameState(): GameState {
  return gameState!;
}

export function setGameState(state: GameState): void {
  gameState = state;
}

export function createGameState(): GameState {
  return {
    meta: {
      runs: 0,
      unlockedLevels: ['level-1'],
      completedLevels: new Set(),
      highScores: {},
      permanentUpgrades: [],
      totalCoins: 0,
      achievements: [],
    },
    run: {
      currentLevelId: '',
      levelsCompleted: [],
      ballsRemaining: signal(1, { label: 'ballsRemaining' }),
      scrapsCounter: signal(0, { label: 'scrapsCounter' }),
      crewMembers: createKeyedCollection([
        /**
         new DoublerCrewMember('doubler2'),
         new DoublerCrewMember('doubler3'),
         new DoublerCrewMember('doubler'),
        /**/
        new DoublerCrewMember('doubler1'),
        new CaptainCrewMember('captain'),
        new FasterCrewMember('faster'),
        new EmptyCrewMember('empty'),
        /**/
      ]),
      // activeBoons: [],
      // temporaryUpgrades: [],
      // lives: 3,
      // score: 0,
      // difficulty: 1,
    },
    level: {
      levelId: '',
      levelName: signal('', { label: 'levelName' }),
      //bricksDestroyed: 0,
      //powerupsCollected: [],
      //elapsedTime: 0,
    },
  };
}

export function setMetaState(state: MetaGameState): void {
  getGameState().meta = state;
}

export function getMetaState(): MetaGameState {
  return getGameState().meta;
}

export function getRunState(): RunState {
  return getGameState().run;
}

export function getLevelState(): LevelState {
  return getGameState().level;
}

export function setLevelState(state: LevelConfig): void {
  getLevelState().levelName.set(state.name);
  getLevelState().levelId = state.id;
}

export function addCompletedLevel(levelId: string): void {
  const metaState = getMetaState();
  const runState = getRunState();

  runState.levelsCompleted.push(levelId);
  // this.context.state.run.score += result.score;
  // this.context.state.run.activeBoons.push(...result.boonsEarned);

  // Update meta state
  metaState.completedLevels.add(levelId);
}

export function setCurrentLevelId(levelId: string): void {
  const runState = getRunState();
  runState.currentLevelId = levelId;
}

export function getCurrentLevelId(): string {
  return getRunState().currentLevelId;
}

export function addBallToRun(count: number): void {
  getRunState().ballsRemaining.update((value) => value + count);
}

export function removeBallFromRun(count: number): void {
  getRunState().ballsRemaining.update((value) => value - count);
}

export function setBallsRemaining(count: number): void {
  getRunState().ballsRemaining.set(count);
}

export function activateCrewMember(): void {
  const rest = getRunState().crewMembers.getAll();
  const crewMember = rest.shift();

  getGameContext().events.emit(GameEvent.POWERUP_ACTIVATED, {
    type: crewMember!.type,
  });

  const index = rest.findIndex((m) => m.type === 'empty');

  if (index === -1) {
    getRunState().crewMembers.set([...rest, crewMember!]);
  } else {
    getRunState().crewMembers.set([...rest.splice(0, index), crewMember!, ...rest]);
  }
}

export function swapCrewMembers(): void {
  const runState = getRunState();

  if (runState.scrapsCounter.get() < 10) {
    return;
  }

  runState.scrapsCounter.update((value) => value - 10);

  const rest = runState.crewMembers.getAll();
  const crewMember = rest.shift();

  const index = rest.findIndex((m) => m.type === 'empty');

  if (index === -1) {
    getRunState().crewMembers.set([...rest, crewMember!]);
  } else {
    getRunState().crewMembers.set([...rest.splice(0, index), crewMember!, ...rest]);
  }

  console.log('swapCrewMembers', getRunState().crewMembers.getAll());
}
