import { Command } from '@/core/game/Command';
import type { Coroutine } from '@/core/game/Coroutine';
import { LevelSystem } from '../system';

export class UnloadLevelCommand extends Command {
  *execute(): Coroutine {
    console.log('[Command] Unload Level');
    const levelSystem = this.context.systems.get(LevelSystem);

    yield levelSystem.unloadLevel();
  }
}
