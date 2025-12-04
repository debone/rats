/**
 * Level System
 *
 * Manages level lifecycle - loading, updating, and unloading levels.
 */

import type { Coroutine } from '@/core/game/Coroutine';
import type { System } from '@/core/game/System';
import type { GameContext } from '@/data/game-context';
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

    this.context.level = level.createInitialState();

    await level.load();

    console.log(`[LevelSystem] Level ${levelId} loaded`);
  }

  /**
   * Unload the current level
   */
  async unloadLevel(): Promise<void> {
    if (!this.currentLevel) return;

    console.log('[LevelSystem] Unloading level');

    this.context.systems.unregister('update', this.updateHandler);
    this.context.systems.unregister('resize', this.resizeHandler);

    // Cleanup level
    await this.currentLevel.unload();
    this.currentLevel = undefined;
    this.context.level = null;
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
