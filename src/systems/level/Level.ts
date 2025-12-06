import { execute } from '@/core/game/Command';
import { GameEvent } from '@/data/events';
import type { GameContext } from '@/data/game-context';
import type { Boon, LevelResult, LevelState } from '@/data/game-state';
import { b2Body_IsValid, b2DestroyBody, type b2BodyId } from 'phaser-box2d';
import { LevelFinishedCommand } from './commands/LevelFinishedCommand';

/** Configuration for a level */
export interface LevelConfig {
  id: string;
  name: string;
  arena: {
    width: number;
    height: number;
  };
  ballSpeed?: number;
  ballCount?: number;
}

/**
 * Base class for all levels
 */
export abstract class Level {
  /** Unique identifier for this level */
  static id: string;

  /** Game context reference */
  protected context!: GameContext;

  /** Level configuration */
  protected config: LevelConfig;

  public bodies: b2BodyId[] = [];

  constructor(config: LevelConfig) {
    this.config = config;
  }

  addBody(bodyId: b2BodyId): void {
    this.bodies.push(bodyId);
  }

  removeBody(bodyId: b2BodyId): void {
    this.bodies = this.bodies.filter((id) => {
      if (id === bodyId && b2Body_IsValid(id)) {
        b2DestroyBody(id);
        console.log('[Level] Removed body ', id);
        return false;
      }
      return true;
    });
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
  createInitialState(): LevelState {
    return {
      ballsRemaining: this.config.ballCount || 3,
      bricksDestroyed: 0,
      powerupsCollected: [],
      elapsedTime: 0,
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
  update(delta: number): void {
    // Update elapsed time
    if (this.context.level) {
      this.context.level.elapsedTime += delta;
    }

    // Check win/lose conditions
    if (this.checkWinCondition()) {
      this.onWin();
    } else if (this.checkLoseCondition()) {
      this.onLose();
    }
  }

  /**
   * Unload level - cleanup
   */
  async unload(): Promise<void> {
    console.log(`[Level] Unloading level: ${this.config.id}`);
    // Override to clean up physics bodies, entities, etc.
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
    const levelState = this.context.level;
    return levelState ? levelState.ballsRemaining <= 0 : false;
  }

  /**
   * Called when the level is won
   */
  protected onWin(): void {
    const result: LevelResult = {
      success: true,
      score: this.calculateScore(),
      boonsEarned: this.selectBoons(),
      timeElapsed: this.context.level?.elapsedTime || 0,
      perfectClear: this.checkPerfectClear(),
    };

    // Prevent multiple calls
    this.context.level = null;

    this.context.events.emit(GameEvent.LEVEL_WON, result);
    execute(LevelFinishedCommand, { success: true, result });
  }

  /**
   * Called when the level is lost
   */
  protected onLose(): void {
    const result: LevelResult = {
      success: false,
      score: this.calculateScore(),
      boonsEarned: [],
      timeElapsed: this.context.level?.elapsedTime || 0,
    };

    // Prevent multiple calls
    this.context.level = null;

    this.context.events.emit(GameEvent.LEVEL_LOST, result);
    execute(LevelFinishedCommand, { success: false, result });
  }

  /**
   * Calculate score for the level
   * Override for custom scoring
   */
  protected calculateScore(): number {
    const levelState = this.context.level;
    if (!levelState) return 0;

    let score = 0;
    score += levelState.bricksDestroyed * 100;
    score += levelState.powerupsCollected.length * 500;

    // Time bonus (faster = more points)
    const timeBonus = Math.max(0, 60000 - levelState.elapsedTime) / 100;
    score += Math.floor(timeBonus);

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
   * Check if the level was cleared perfectly
   */
  protected checkPerfectClear(): boolean {
    const levelState = this.context.level;
    if (!levelState) return false;

    // Perfect clear: no balls lost
    return levelState.ballsRemaining === (this.config.ballCount || 3);
  }

  /**
   * Helper: Access active boons from run state
   */
  protected get activeBoons(): Boon[] {
    return this.context.run?.activeBoons || [];
  }

  /**
   * Helper: Check if a specific boon is active
   */
  protected hasBoon(boonId: string): boolean {
    return this.activeBoons.some((b) => b.id === boonId);
  }
}
