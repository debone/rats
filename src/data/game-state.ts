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
    brickDamage: Signal<number>;
    cheeseStorageBonus: Signal<number>;
    abilityDiscount: Signal<number>;
    boatLengthRatio: Signal<number>;
  };

  crewBoons: {
    nuggets_nextAbilityFree: Signal<boolean>;
    lacfree_nextBricksHaveCheese: Signal<number>;
    lacfree_abilitiesConsumeRubbles: Signal<boolean>;
    micesive_nextBricksHaveRubbles: Signal<number>;
    ratfather_bricksGiveMoreCheese: Signal<boolean>;
    mysz_ballsStickToBoat: Signal<boolean>;
    flub_ballsAttractedToBoat: Signal<boolean>;
    mrblu_nextCheeseIsBlue: Signal<boolean>;
    mrblu_cheeseFloats: Signal<boolean>;
    micesive_cheeseGivesBall: Signal<boolean>;
    aura_cheeseBreaksBricks: Signal<boolean>;
    pirat_boatImmobilized: Signal<boolean>;
    littlemi_everythingFloats: Signal<boolean>;
    ratoulie_abilitiesConsumeBalls: Signal<boolean>;
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
        brickDamage: signal(1),
        cheeseStorageBonus: signal(0),
        abilityDiscount: signal(0),
        boatLengthRatio: signal(1),
      },
      crewBoons: {
        nuggets_nextAbilityFree: signal(false),
        lacfree_nextBricksHaveCheese: signal(0),
        lacfree_abilitiesConsumeRubbles: signal(false),
        micesive_nextBricksHaveRubbles: signal(0),
        ratfather_bricksGiveMoreCheese: signal(false),
        mysz_ballsStickToBoat: signal(false),
        flub_ballsAttractedToBoat: signal(false),
        mrblu_nextCheeseIsBlue: signal(false),
        mrblu_cheeseFloats: signal(false),
        micesive_cheeseGivesBall: signal(false),
        aura_cheeseBreaksBricks: signal(false),
        pirat_boatImmobilized: signal(false),
        littlemi_everythingFloats: signal(false),
        ratoulie_abilitiesConsumeBalls: signal(false),
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
  const maxCheese = MAX_CHEESE + getRunState().stats.cheeseStorageBonus.get();
  getRunState().cheeseCounter.update((value) => Math.max(0, Math.min(maxCheese, value + delta)));
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

export function onboardCrewMember(crewMember: CrewMemberDefKey): void {
  const crewMemberInstance = new CrewMemberInstance(
    crewMember,
    `crew-${crewMember}-${Math.random().toString(36).substring(2, 6)}`,
  );
  CREW_DEFS[crewMember].passiveAbility.mount(getRunState());

  getRunState().firstMember.set(crewMemberInstance);
}

export function offboardCrewMember(crewMember: CrewMemberDefKey): void {
  CREW_DEFS[crewMember].passiveAbility.unmount(getRunState());
}

export function activateCrewAbility(index: number): void {
  const runState = getRunState();
  const crewMember = index === 0 ? runState.firstMember.get() : runState.secondMember.get();

  if (!crewMember) return;

  const def = CREW_DEFS[crewMember.defKey];

  if (runState.crewBoons.nuggets_nextAbilityFree.get()) {
    runState.crewBoons.nuggets_nextAbilityFree.set(false);
  } else {
    const cost = Math.max(0, def.activeAbility.cost - runState.stats.abilityDiscount.get());

    if (runState.crewBoons.ratoulie_abilitiesConsumeBalls.get()) {
      if (cost > runState.ballsRemaining.get()) return;
      removeBallFromRun(cost);
    } else if (runState.crewBoons.lacfree_abilitiesConsumeRubbles.get()) {
      if (cost > runState.scrapsCounter.get()) return;
      changeScraps(-cost);
    } else {
      if (cost > runState.cheeseCounter.get()) return;
      changeCheese(-cost);
    }
  }

  def.activeAbility.effect(runState);
}
