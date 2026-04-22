/**
 * Game State Data Structures
 *
 * This file contains all the core data structures for game state.
 * These are pure data definitions without implementation logic.
 */

import { MAX_CHEESE } from '@/consts';
import { createKeyedCollection, SignalCollection } from '@/core/reactivity/signals/signal-collection';
import { signal } from '@/core/reactivity/signals/signals';
import type { Signal } from '@/core/reactivity/signals/types';
import { CREW_DEFS, CrewMemberInstance, type CrewMemberDefKey } from '@/entities/crew/Crew';
import type { LevelConfig } from '@/systems/level/Level';

export interface GameState {
  meta: MetaGameState;
  run: RunState;
  level: LevelState;
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
  cheeseCounter: Signal<number>;
  crewMembers: SignalCollection<CrewMemberInstance>;
  firstMember: Signal<CrewMemberInstance | undefined>;
  secondMember: Signal<CrewMemberInstance | undefined>;

  stats: {
    boatVelocityRatio: Signal<number>;
    ballSpeedRatio: Signal<number>;
    ballDamage: Signal<number>;
  };

  crewBoons: {
    nuggets_nextAbilityFree: Signal<boolean>;
  };
  // Run-specific state
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
      ballsRemaining: signal(5),
      scrapsCounter: signal(0),
      cheeseCounter: signal(5),
      crewMembers: createKeyedCollection([
        /**
         new DoublerCrewMember('doubler2'),
         new DoublerCrewMember('doubler3'),
         new DoublerCrewMember('doubler'),
        /**/
        //new CrewMemberInstance('doubler', 'doubler1'),
        //new CrewMemberInstance('captain', 'captain'),
        //new CrewMemberInstance('faster', 'faster'),
        //new CrewMemberInstance('empty', 'empty'),
        /**/
      ]),
      firstMember: signal(undefined),
      secondMember: signal(undefined),
      stats: {
        boatVelocityRatio: signal(1),
        ballSpeedRatio: signal(1),
        ballDamage: signal(1),
      },
      crewBoons: {
        nuggets_nextAbilityFree: signal(false),
      },
      //firstMember: signal(new CrewMemberInstance('doubler', 'doubler2')),
      //secondMember: signal(new CrewMemberInstance('faster', 'faster3')),
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
  // FIXME [RATZ-107]: this doesn't work on itchio???
  metaState.completedLevels.add(levelId);
}

export function setCurrentLevelId(levelId: string): void {
  const runState = getRunState();
  runState.currentLevelId = levelId;
}

export function getCurrentLevelId(): string {
  return getRunState().currentLevelId;
}

export function changeScraps(count: number): void {
  // Sorry Victor from future trying to make negative scraps happen
  getRunState().scrapsCounter.update((value) => Math.max(0, value + count));
}

export function changeCheese(delta: number): void {
  getRunState().cheeseCounter.update((value) => Math.max(0, Math.min(MAX_CHEESE, value + delta)));
}

export function addBallToRun(count: number): void {
  getRunState().ballsRemaining.update((value) => value + count);
}

export function removeBallFromRun(count: number): void {
  getRunState().ballsRemaining.update((value) => Math.max(0, value - count));
}

export function setBallsRemaining(count: number): void {
  getRunState().ballsRemaining.set(count);
}

export function onboardCrewMember(crewMember: CrewMemberDefKey, place: 'first' | 'second' = 'first'): void {
  const crewMemberInstance = new CrewMemberInstance(
    crewMember,
    `crew-${crewMember}-${Math.random().toString(36).substring(2, 6)}`,
  );
  CREW_DEFS[crewMember].passiveAbility.mount(getRunState());

  if (place === 'first') {
    getRunState().firstMember.set(crewMemberInstance);
  } else {
    getRunState().secondMember.set(crewMemberInstance);
  }
}

export function offboardCrewMember(crewMember: CrewMemberDefKey): void {
  CREW_DEFS[crewMember].passiveAbility.unmount(getRunState());
}

export function activateCrewAbility(index: number): void {
  const crewMember = index === 0 ? getRunState().firstMember.get() : getRunState().secondMember.get();

  if (!crewMember) {
    return;
  }

  const def = CREW_DEFS[crewMember.defKey];

  if (getRunState().crewBoons.nuggets_nextAbilityFree.get()) {
    getRunState().crewBoons.nuggets_nextAbilityFree.set(false);
  } else {
    if (def.activeAbility.cost > getRunState().cheeseCounter.get()) {
      return;
    }

    changeCheese(-def.activeAbility.cost);
  }

  def.activeAbility.effect(getRunState());
}
