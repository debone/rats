/**
 * Level System
 *
 * Manages level lifecycle - loading, updating, and unloading levels.
 */

import { assert } from '@/core/common/assert';
import type { System } from '@/core/game/System';
import type { GameContext } from '@/data/game-context';
import { setLevelState } from '@/data/game-state';
import { PhysicsSystem } from '../physics/system';
import type { Level } from './Level';

export class LevelSystem implements System {
  static SYSTEM_ID = 'level';

  private context!: GameContext;
  private currentLevel?: Level;

  updateHandler = this.updateLevel.bind(this);
  resizeHandler = this.resizeLevel.bind(this);

  init(context: GameContext) {
    this.context = context;
  }

  /**
   * Load a level by ID
   */
  async loadLevel(levelId: string): Promise<void> {
    console.log(`[LevelSystem] Loading level: ${levelId}`);

    // Dynamically import the level module
    const levelModule = await import(`./levels/${levelId}.ts`);
    const LevelClass = levelModule.default;

    // Instantiate level and init
    const level = new LevelClass() as Level;
    this.currentLevel = level;
    level.init(this.context);

    setLevelState(level.createInitialState());

    await level.load();

    console.log(`[LevelSystem] Level ${levelId} loaded`);
  }

  /**
   * Unload the current level
   */
  async unloadLevel(): Promise<void> {
    assert(this.currentLevel, 'Current level is not set');

    const currentLevel = this.currentLevel;

    console.log('[LevelSystem] Unloading level');

    currentLevel.bodies.forEach((bodyId) => {
      currentLevel.unregisterBody(bodyId);
      this.context.systems.get(PhysicsSystem).queueDestruction(bodyId);
    });

    this.context.systems.unregister('update', this.updateHandler);
    this.context.systems.unregister('resize', this.resizeHandler);

    // Cleanup level
    await currentLevel.unload();
    this.currentLevel = undefined;
  }

  private updateLevel(delta: number) {
    this.currentLevel!.update(delta);
  }

  private resizeLevel(w: number, h: number) {
    this.currentLevel!.resize!(w, h);
  }

  destroy() {
    if (this.currentLevel && this.context) {
      this.context.systems.unregister('update', this.updateHandler);
      this.context.systems.unregister('resize', this.resizeHandler);
    }
  }
}
