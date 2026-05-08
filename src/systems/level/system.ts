/**
 * Level System
 *
 * Manages level lifecycle - loading, updating, and unloading levels.
 */

import { assert } from '@/core/common/assert';
import { execute } from '@/core/game/Command';
import type { System } from '@/core/game/System';
import type { GameContext } from '@/data/game-context';
import { LEVEL_DEFINITIONS } from '@/gameplay/campaign/campaign-def';
import type { BreakoutLevelEntity } from '@/gameplay/levels/BreakoutLevel';
import { Levels_LevelStartCommand } from '@/gameplay/levels/commands/LevelStartCommand';
import { EntityCollisionSystem } from '@/systems/physics/EntityCollisionSystem';
import { PhysicsSystem } from '@/systems/physics/system';

/** Configuration for a level */
export interface LevelConfig {
  id: string;
  name: string;
}

export class LevelSystem implements System {
  static SYSTEM_ID = 'level';
  private context!: GameContext;
  private currentLevel?: BreakoutLevelEntity;

  init(context: GameContext) {
    this.context = context;
  }

  async loadLevel(levelId: string): Promise<void> {
    console.log(`[LevelSystem] Loading level: ${levelId}`);

    const levelDefinition = LEVEL_DEFINITIONS[levelId];
    assert(levelDefinition, `Level definition for ${levelId} not found`);

    const level = levelDefinition();
    this.currentLevel = level;
    // TODO: maybe this is also events?
    await execute(Levels_LevelStartCommand);
  }

  async unloadLevel(): Promise<void> {
    assert(this.currentLevel, 'Current level is not set');
    this.currentLevel.destroy();

    this.context.systems.get(PhysicsSystem).clearOrphans();
    this.context.systems.get(EntityCollisionSystem).clear();

    this.currentLevel = undefined;
  }

  stop() {}

  start() {}

  destroy() {}
}
