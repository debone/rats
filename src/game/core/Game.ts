import { Container } from 'pixi.js';
import type { GameScreen } from '@/screens/GameScreen';
import type { GameContext } from './types';
import type { LevelResult } from '@/data/game-state';
import { createDefaultMetaState } from '@/data/game-state';
import { GameEvent } from '@/data/events';
import { SystemRunner } from './SystemRunner';
import { EventEmitter, EventContext } from './EventEmitter';
import type { Level } from '../levels/Level';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { SaveSystem } from '../systems/SaveSystem';
import { type Coroutine, runCoroutine, delay } from './Coroutine';

export class Game {
  /** Game context shared across systems and levels */
  public readonly context: GameContext;

  /** Currently active level instance */
  private currentLevel?: Level;

  constructor(screen: GameScreen, container: Container) {
    // Create event emitter and context
    const emitter = new EventEmitter();
    const events = new EventContext(emitter);

    // Initialize context
    this.context = {
      screen,
      worldId: null as any, // Will be set by PhysicsSystem
      container,
      meta: createDefaultMetaState(),
      run: null,
      level: null,
      phase: 'idle',
      systems: new SystemRunner(this),
      events,
    };
  }

  /**
   * Initialize the game - load systems and meta state
   */
  async init() {
    // Add core systems
    this.context.systems.add(PhysicsSystem);
    this.context.systems.add(SaveSystem);

    // Initialize all systems
    this.context.systems.init();

    // Load meta state from storage
    const saveSystem = this.context.systems.get(SaveSystem);
    const savedMeta = await saveSystem.loadMeta();
    if (savedMeta) {
      this.context.meta = savedMeta;
    }
  }

  /**
   * Update game - called every frame
   */
  update(delta: number) {
    // Update all systems
    this.context.systems.update(delta);

    // Update current level
    if (this.currentLevel && this.context.phase === 'level') {
      this.currentLevel.update(delta);
    }
  }

  /**
   * Resize game
   */
  resize(w: number, h: number) {
    this.context.systems.resize(w, h);
    this.currentLevel?.resize?.(w, h);
  }

  /**
   * Pause game
   */
  pause() {
    if (this.context.phase === 'level') {
      this.context.phase = 'paused';
      this.currentLevel?.pause?.();
    }
  }

  /**
   * Resume game
   */
  resume() {
    if (this.context.phase === 'paused') {
      this.context.phase = 'level';
      this.currentLevel?.resume?.();
    }
  }

  /**
   * Start a new run from the beginning
   */
  async startNewRun(startingLevelId: string = 'level-1') {
    this.context.run = {
      currentLevelId: startingLevelId,
      levelsCompleted: [],
      activeBoons: [],
      temporaryUpgrades: [],
      lives: 3,
      score: 0,
      difficulty: 1,
    };

    // Save the new run
    await this.context.systems.get(SaveSystem).save();

    // Start the first level
    await this.startLevel(startingLevelId);
  }

  /**
   * Resume an existing run from save data
   */
  async resumeRun() {
    const saveSystem = this.context.systems.get(SaveSystem);
    const savedRun = await saveSystem.loadRun();

    if (!savedRun) {
      throw new Error('No run to resume');
    }

    this.context.run = savedRun;
    await this.startLevel(this.context.run.currentLevelId);
  }

  /**
   * Start a specific level
   */
  async startLevel(levelId: string) {
    console.log(`[Game] Starting level: ${levelId}`);

    this.context.phase = 'transition';

    // Unload previous level if any
    if (this.currentLevel) {
      await this.currentLevel.unload();
      this.currentLevel = undefined;
    }

    // Dynamically import the level class
    const levelModule = await this.loadLevelModule(levelId);
    const LevelClass = levelModule.default;

    // Instantiate the level
    const level = new LevelClass();
    this.currentLevel = level;

    // Initialize level with context
    level.init(this.context);

    // Create initial level state
    this.context.level = level.createInitialState();

    // Load level (setup geometry, entities, etc.)
    await level.load();

    // Transition to playing
    this.context.phase = 'level';

    // Emit event (now typed and cmd+clickable!)
    this.context.events.emit(GameEvent.LEVEL_STARTED, { levelId });

    console.log(`[Game] Level ${levelId} started`);
  }

  /**
   * Called when a level is completed
   */
  async onLevelComplete(result: LevelResult) {
    console.log('[Game] Level completed:', result);

    if (!result.success) {
      await this.handleLevelFailure(result);
      return;
    }

    // Update run state
    if (!this.context.run) {
      console.error('[Game] No active run when level completed');
      return;
    }

    this.context.run.levelsCompleted.push(this.context.run.currentLevelId);
    this.context.run.score += result.score;
    this.context.run.activeBoons.push(...result.boonsEarned);

    // Update meta state
    if (!this.context.meta.completedLevels.includes(this.context.run.currentLevelId)) {
      this.context.meta.completedLevels.push(this.context.run.currentLevelId);
    }

    // Save progress
    await this.context.systems.get(SaveSystem).save();

    // Start the level complete flow
    await runCoroutine(this.levelCompleteFlow(result));
  }

  /**
   * Coroutine flow for level completion sequence
   * Orchestrates: cutscene → map → level selection → next level
   */
  private async *levelCompleteFlow(result: LevelResult): Coroutine {
    console.log('[Game] Running level complete flow');

    if (!this.context.run) return;

    this.context.phase = 'cutscene';

    // 1. Play cutscene (if any)
    // await this.playCutscene('level_complete', result);
    // For now, just a delay
    yield delay(500);

    // 2. Show map screen
    this.context.phase = 'map';
    this.context.events.emit(GameEvent.GAME_SHOW_MAP, {
      completedLevel: this.context.run.currentLevelId,
      result,
    });

    // 3. Wait for player to select next level
    const selection = yield this.context.events.wait(GameEvent.MAP_LEVEL_SELECTED);

    // 4. Update run state and start next level
    this.context.run.currentLevelId = selection.levelId;
    await this.startLevel(selection.levelId);
  }

  /**
   * Handle level failure
   */
  private async handleLevelFailure(_result: LevelResult) {
    console.log('[Game] Level failed');

    if (!this.context.run) return;

    this.context.run.lives--;

    if (this.context.run.lives <= 0) {
      // Game over
      await runCoroutine(this.gameOverFlow());
    } else {
      // Retry level
      await this.startLevel(this.context.run.currentLevelId);
    }
  }

  /**
   * Coroutine flow for game over
   * Orchestrates: game over screen → player choice → restart or quit
   */
  private async *gameOverFlow(): Coroutine {
    console.log('[Game] Running game over flow');

    if (!this.context.run) return;

    this.context.phase = 'cutscene';

    // Show game over screen
    this.context.events.emit(GameEvent.GAME_SHOW_GAME_OVER, {
      score: this.context.run.score,
      levelsCompleted: this.context.run.levelsCompleted.length,
    });

    // Wait for player to restart or quit
    const action = yield this.context.events.wait(GameEvent.GAME_OVER_ACTION);

    if (action === 'restart') {
      await this.startNewRun();
    } else {
      // Return to main menu (handled by GameScreen)
      this.context.events.emit(GameEvent.GAME_QUIT);
    }
  }

  /**
   * Load a level module dynamically
   */
  private async loadLevelModule(levelId: string): Promise<any> {
    // Dynamic import based on level ID
    try {
      return await import(`../levels/${levelId}.ts`);
    } catch (error) {
      console.error(`[Game] Failed to load level: ${levelId}`, error);
      throw error;
    }
  }

  /**
   * Cleanup and destroy the game
   */
  destroy() {
    this.currentLevel?.unload();
    this.context.systems.destroy();
  }
}
