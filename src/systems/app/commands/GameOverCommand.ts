import { Command, execute } from '@/core/game/Command';
import type { Coroutine } from '@/core/game/Coroutine';
import { GameEvent } from '@/data/events';
import { getRunState } from '@/data/game-state';
import { UnloadLevelCommand } from '@/systems/level/commands/UnloadLevelCommand';
import { LevelSystem } from '@/systems/level/system';
import { PhysicsSystem } from '../../physics/system';
import { GameEndScreenCommand } from './GameEndScreenCommand';
import { StartNewRunCommand } from './StartNewRunCommand';

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
