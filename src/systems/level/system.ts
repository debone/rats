import { assert } from '@/core/common/assert';
import { execute } from '@/core/game/Command';
import type { System } from '@/core/game/System';
import type { GameContext } from '@/data/game-context';
import { EntityCollisionSystem } from '../physics/EntityCollisionSystem';
import { PhysicsSystem } from '../physics/system';
import { Levels_LevelStartCommand } from './levels/commands/LevelStartCommand';
import type { BreakoutLevelEntity } from './levels/BreakoutLevel';
import { LEVEL_DEFINITIONS } from './levels/level-definitions';

export class LevelSystem implements System {
  static SYSTEM_ID = 'level';

  private context!: GameContext;
  private currentLevel?: BreakoutLevelEntity;

  init(context: GameContext) {
    this.context = context;
  }

  async loadLevel(levelId: string): Promise<void> {
    console.log(`[LevelSystem] Loading level: ${levelId}`);

    const defFactory = LEVEL_DEFINITIONS[levelId];
    assert(defFactory, `[LevelSystem] Unknown level: ${levelId}`);

    this.currentLevel = defFactory();

    await execute(Levels_LevelStartCommand);

    console.log(`[LevelSystem] Level ${levelId} loaded`);
  }

  async unloadLevel(): Promise<void> {
    assert(this.currentLevel, 'Current level is not set');

    console.log('[LevelSystem] Unloading level');

    this.currentLevel.destroy();

    this.context.systems.get(PhysicsSystem).clearOrphans();
    this.context.systems.get(EntityCollisionSystem).clear();

    this.currentLevel = undefined;
  }

  stop() {
    console.log('[LevelSystem] Stopping current level...');
  }

  start() {
    console.log('[LevelSystem] Starting current level...');
  }

  destroy() {}
}
