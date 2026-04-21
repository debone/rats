import { assert } from '@/core/common/assert';
import { setActiveLevelChildren } from '@/core/entity/scope';
import type { System } from '@/core/game/System';
import type { GameContext } from '@/data/game-context';
import { EntityCollisionSystem } from '../physics/EntityCollisionSystem';
import { PhysicsSystem } from '../physics/system';
import type { BreakoutLevelEntity } from './levels/BreakoutLevel';
import { BreakoutLevel } from './levels/BreakoutLevel';
import { LEVEL_DEFINITIONS } from './levels/level-definitions';

export class LevelSystem implements System {
  static SYSTEM_ID = 'level';

  private context!: GameContext;
  private currentLevel?: BreakoutLevelEntity;

  updateHandler = this.updateLevel.bind(this);
  resizeHandler = this.resizeLevel.bind(this);

  init(context: GameContext) {
    this.context = context;
  }

  async loadLevel(levelId: string): Promise<void> {
    console.log(`[LevelSystem] Loading level: ${levelId}`);

    const defFactory = LEVEL_DEFINITIONS[levelId];
    assert(defFactory, `[LevelSystem] Unknown level: ${levelId}`);

    const level = BreakoutLevel(defFactory());
    this.currentLevel = level;

    // Keep activeLevelChildren set for the level's entire lifetime so entities
    // spawned during gameplay (Scrap, dropped Cheese, etc.) are also tracked.
    setActiveLevelChildren(level.children);
    await level.load();

    console.log(`[LevelSystem] Level ${levelId} loaded`);
  }

  async unloadLevel(): Promise<void> {
    assert(this.currentLevel, 'Current level is not set');

    console.log('[LevelSystem] Unloading level');

    this.context.systems.unregister('update', this.updateHandler);
    this.context.systems.unregister('resize', this.resizeHandler);

    // Destroy the level entity — this destroys all tracked children first, then the level itself.
    this.currentLevel.destroy();
    setActiveLevelChildren(null);

    this.context.systems.get(PhysicsSystem).clearOrphans();
    this.context.systems.get(EntityCollisionSystem).clear();

    this.currentLevel = undefined;
  }

  stop() {
    console.log('[LevelSystem] Stopping current level...');
    this.context.systems.unregister('update', this.updateHandler);
    this.context.systems.unregister('resize', this.resizeHandler);
  }

  start() {
    console.log('[LevelSystem] Starting current level...');
    this.context.systems.register('update', this.updateHandler);
    this.context.systems.register('resize', this.resizeHandler);
  }

  private updateLevel(delta: number) {
    this.currentLevel!.update(delta);
  }

  private resizeLevel(w: number, h: number) {
    // resize is optional on level entities
    void w;
    void h;
  }

  destroy() {
    if (this.currentLevel && this.context) {
      this.context.systems.unregister('update', this.updateHandler);
      this.context.systems.unregister('resize', this.resizeHandler);
    }
  }
}
