import { Command, execute } from '@/core/game/Command';
import type { Coroutine } from '@/core/game/Coroutine';
import { GameEvent } from '@/data/events';
import { getRunState } from '@/data/game-state';
import { PhysicsSystem } from '../../physics/system';
import { StartNewRunCommand } from './StartNewRunCommand';
import { UnloadLevelCommand } from '@/systems/level/commands/UnloadLevelCommand';

export class GameOverCommand extends Command {
  *execute(): Coroutine {
    console.log('[Command] Game Over');

    // Remove game-specific systems
    const physicsSystem = this.context.systems.get(PhysicsSystem);
    physicsSystem.stop();
    yield execute(UnloadLevelCommand);

    // Clear run state
    // this.context.state.run = createDefaultRunState();
    // yield this.context.systems.get(SaveSystem).clearRun();

    const score = getRunState().levelsCompleted.length;
    const levelsCompleted = getRunState().levelsCompleted;

    // Emit data for UI
    this.context.events.emit(GameEvent.GAME_OVER_DATA, { score, levelsCompleted });

    // Wait for player action
    const action = yield this.context.events.wait(GameEvent.GAME_OVER_ACTION);

    if (action === 'restart') {
      yield execute(StartNewRunCommand, { startingLevelId: 'level-1' });
    } else {
      this.context.events.emit(GameEvent.GAME_QUIT);
    }
  }
}
