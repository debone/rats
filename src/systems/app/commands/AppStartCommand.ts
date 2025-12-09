import { Command, execute } from '@/core/game/Command';
import type { Coroutine } from '@/core/game/Coroutine';
import { SaveSystem } from '../../save/system';
import { ShowScreenCommand } from '../../navigation/commands/ShowScreenCommand';
import { StartNewRunCommand } from './StartNewRunCommand';
import { ResumeRunCommand } from './ResumeRunCommand';
import { LoadScreen } from '@/screens/LoadScreen';
import { LevelSystem } from '@/systems/level/system';
import { PhysicsSystem } from '@/systems/physics/system';

export class AppStartCommand extends Command {
  *execute(): Coroutine {
    console.log('[Command] App Start');

    // Show load screen
    yield execute(ShowScreenCommand, { screen: LoadScreen });

    // Check for saved run
    let savedRun = yield this.context.systems.get(SaveSystem).loadRun();

    // TODO remove this
    savedRun = null;

    // Add game-specific systems dynamically
    this.context.systems.add(PhysicsSystem);
    this.context.systems.add(LevelSystem);

    if (savedRun) {
      yield execute(ResumeRunCommand, { run: savedRun });
    } else {
      yield execute(StartNewRunCommand, { startingLevelId: 'level-1' });
    }
  }
}
