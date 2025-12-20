import { execute } from '@/core/game/Command';
import { GameEvent } from '@/data/events';
import type { GameContext } from '@/data/game-context';
import type { Boon, LevelResult, LevelState } from '@/data/game-state';
import {
  b2Body_GetUserData,
  b2Body_IsValid,
  b2Shape_GetBody,
  b2World_GetContactEvents,
  b2World_GetSensorEvents,
  b2WorldId,
  type b2BodyId,
} from 'phaser-box2d';
import { CollisionHandlerRegistry } from '../physics/collision-handler';
import { LevelFinishedCommand } from './commands/LevelFinishedCommand';

/** Configuration for a level */
export interface LevelConfig {
  id: string;
  name: string;
  arena: {};
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

  protected collisions = new CollisionHandlerRegistry();

  constructor(config: LevelConfig) {
    this.config = config;
  }

  registerBody(bodyId: b2BodyId): void {
    this.bodies.push(bodyId);
  }

  unregisterBody(bodyId: b2BodyId): void {
    this.bodies = this.bodies.filter((id) => id !== bodyId);
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

    this.checkCollisions(this.context.worldId!);
  }

  protected checkCollisions(worldId: b2WorldId): void {
    const contactEvents = b2World_GetContactEvents(worldId);

    for (let i = 0; i < contactEvents.beginCount; i++) {
      const event = contactEvents.beginEvents[i];
      if (!event) continue;

      const bodyIdA = b2Shape_GetBody(event.shapeIdA);
      const bodyIdB = b2Shape_GetBody(event.shapeIdB);

      if (!b2Body_IsValid(bodyIdA) || !b2Body_IsValid(bodyIdB)) continue;

      const userDataA = b2Body_GetUserData(bodyIdA) as { type: string } | null;
      const userDataB = b2Body_GetUserData(bodyIdB) as { type: string } | null;

      if (userDataA?.type && userDataB?.type) {
        this.collisions.handle({ bodyA: bodyIdA, bodyB: bodyIdB, userDataA, userDataB }, this.context);
      }
    }

    // TODO: Do I care sensors go into the same bag?

    const sensorEvents = b2World_GetSensorEvents(worldId);

    for (let i = 0; i < sensorEvents.beginCount; i++) {
      const event = sensorEvents.beginEvents[i];
      if (!event) continue;

      const bodyIdA = b2Shape_GetBody(event.visitorShapeId);
      const bodyIdB = b2Shape_GetBody(event.sensorShapeId);

      if (!b2Body_IsValid(bodyIdA) || !b2Body_IsValid(bodyIdB)) continue;

      const userDataA = b2Body_GetUserData(bodyIdA) as { type: string } | null;
      const userDataB = b2Body_GetUserData(bodyIdB) as { type: string } | null;

      if (userDataA?.type && userDataB?.type) {
        this.collisions.handle({ bodyA: bodyIdA, bodyB: bodyIdB, userDataA, userDataB }, this.context);
      }
    }

    // Destroy queued bodies after iteration
    this.collisions.flushDestructions();
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
