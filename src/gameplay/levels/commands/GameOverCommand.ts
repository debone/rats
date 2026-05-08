import { Command, execute } from '@/core/game/Command';
import type { Coroutine } from '@/core/game/Coroutine';
import { GameEvent } from '@/data/events';
import { getRunState } from '@/data/game-state';
import { UnloadLevelCommand } from '@/systems/level/commands/UnloadLevelCommand';
import { LevelSystem } from '@/systems/level/system';
import { PhysicsSystem } from '@/systems/physics/system';
import { GameEndScreenCommand } from './GameEndScreenCommand';

export class GameOverCommand extends Command {
  *execute(): Coroutine {
    console.log('[Command] Game Over');

    // Remove game-specific systems
    const physicsSystem = this.context.systems.get(PhysicsSystem);
    const levelSystem = this.context.systems.get(LevelSystem);

    physicsSystem.stop();
    levelSystem.stop();

    yield execute(UnloadLevelCommand);
    yield execute(GameEndScreenCommand);

    const score = getRunState().levelsCompleted.length;
    const levelsCompleted = getRunState().levelsCompleted;

    this.context.events.emit(GameEvent.GAME_OVER_DATA, { score, levelsCompleted });
  }
}
