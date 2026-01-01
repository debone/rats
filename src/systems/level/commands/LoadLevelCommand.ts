import { Command, execute } from '@/core/game/Command';
import type { Coroutine } from '@/core/game/Coroutine';
import { GameEvent } from '@/data/events';
import { LevelSystem } from '../system';
import { UnloadLevelCommand } from './UnloadLevelCommand';
import { PhysicsSystem } from '@/systems/physics/system';

export class LoadLevelCommand extends Command<{ levelId: string }> {
  *execute({ levelId }: { levelId: string }): Coroutine {
    console.log(`[Command] Load Level: ${levelId}`);
    const levelSystem = this.context.systems.get(LevelSystem);

    // Unload previous level if exists
    if (this.context.state.run.currentLevelId !== '') {
      yield execute(UnloadLevelCommand);
    }

    this.context.phase = 'transition';

    yield levelSystem.loadLevel(levelId);

    this.context.phase = 'level';

    // Register for updates
    this.context.systems.register('update', levelSystem.updateHandler);
    this.context.systems.register('resize', levelSystem.resizeHandler);

    const physicsSystem = this.context.systems.get(PhysicsSystem);
    physicsSystem.start();

    this.context.events.emit(GameEvent.LEVEL_STARTED, { levelId });
  }
}
