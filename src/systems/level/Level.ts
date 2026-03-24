import type { FollowResult } from '@/core/camera/effects/follow';
import { getEntities } from '@/core/entity/scope';
import { execute } from '@/core/game/Command';
import { GameEvent } from '@/data/events';
import type { GameContext } from '@/data/game-context';
import { getLevelState, getRunState, type Boon, type LevelResult } from '@/data/game-state';
import { EntityCollisionSystem } from '../physics/EntityCollisionSystem';
import { PhysicsSystem } from '../physics/system';
import { LevelFinishedCommand } from './commands/LevelFinishedCommand';

/** Configuration for a level */
export interface LevelConfig {
  id: string;
  name: string;
}

/**
 * Base class for all levels
 */
export abstract class Level {
  /** Game context reference */
  protected context!: GameContext;

  /** Level configuration */
  protected config: LevelConfig;
  protected follow?: FollowResult;

  constructor(config: LevelConfig) {
    this.config = config;
  }

  /**
   * Initialize level with game context
   */
  init(context: GameContext): void {
    this.context = context;
  }

  /**
   * Create initial level state
   * Override this to customize initial state
   */
  createInitialState(): LevelConfig {
    return {
      id: this.config.id,
      name: this.config.name,
      //bricksDestroyed: 0,
      //powerupsCollected: [],
      //elapsedTime: 0,
    };
  }

  /**
   * Load level - setup geometry, entities, etc.
   * This is where you create physics bodies, spawn entities, etc.
   */
  abstract load(): Promise<void>;

  /**
   * Update level logic
   * Called every frame while the level is active
   */
  update(_delta: number): void {
    // Update elapsed time
    // [STATE] TODO: not sure what would be the way here
    /*
    if (this.context.state.level) {
      this.context.level.elapsedTime += delta;
    }
    */
  }

  /**
   * Unload level - cleanup
   */
  async unload(): Promise<void> {
    console.log(`[Level] Unloading level: ${this.config.id}`);

    this.follow?.stop();

    getEntities().forEach((entity) => {
      if (!entity.destroy) {
        debugger;
      }
      entity.destroy();
    });
    this.context.systems.get(PhysicsSystem).clearOrphans();
    this.context.systems.get(EntityCollisionSystem).clear();
  }

  /**
   * Pause level
   */
  pause?(): void {
    // Override if needed
  }

  /**
   * Resume level
   */
  resume?(): void {
    // Override if needed
  }

  /**
   * Resize level
   */
  resize?(_w: number, _h: number): void {
    // Override if needed
  }

  /**
   * Check if the player has won the level
   * Override this for custom win conditions
   */
  protected checkWinCondition(): boolean {
    // Default: all bricks destroyed (if there are any)
    return false; // Override in subclass
  }

  /**
   * Check if the player has lost the level
   * Override this for custom lose conditions
   */
  protected checkLoseCondition(): boolean {
    // Default: no balls remaining
    // [STATE] TODO: make it a method
    const runState = getRunState();
    return runState ? runState.ballsRemaining.get() <= 0 : false;
  }

  /**
   * Called when the level is won
   */
  public onWin(): void {
    const result: LevelResult = {
      levelId: this.config.id,
      success: true,
      //score: this.calculateScore(),
      //boonsEarned: this.selectBoons(),
      //timeElapsed: this.context.level?.elapsedTime || 0,
      //perfectClear: this.checkPerfectClear(),
    };

    this.context.events.emit(GameEvent.LEVEL_WON, result);
    execute(LevelFinishedCommand, result);
  }

  /**
   * Called when the level is lost
   */
  protected onLose(): void {
    const result: LevelResult = {
      levelId: this.config.id,
      success: false,
      //score: this.calculateScore(),
      //boonsEarned: [],
      //timeElapsed: this.context.level?.elapsedTime || 0,
    };

    // Prevent multiple calls
    this.context.events.emit(GameEvent.LEVEL_LOST, result);
    execute(LevelFinishedCommand, result);
  }

  /**
   * Calculate score for the level
   * Override for custom scoring
   */
  protected calculateScore(): number {
    const levelState = getLevelState();
    if (!levelState) return 0;

    let score = 0;
    //score += levelState.bricksDestroyed * 100;
    //score += levelState.powerupsCollected.length * 500;

    // Time bonus (faster = more points)
    // const timeBonus = Math.max(0, 60000 - levelState.elapsedTime) / 100;
    //score += Math.floor(timeBonus);

    return score;
  }

  /**
   * Select boons to award after level completion
   * Override for custom boon selection
   */
  protected selectBoons(): Boon[] {
    // TODO: Implement boon selection logic
    return [];
  }

  /**
   * Helper: Access active boons from run state
   */
  protected get activeBoons(): Boon[] {
    // const runState = getRunState();
    // return runState ? runState.activeBoons : [];
    return [];
  }

  /**
   * Helper: Check if a specific boon is active
   */
  protected hasBoon(boonId: string): boolean {
    return this.activeBoons.some((b) => b.id === boonId);
  }
}
