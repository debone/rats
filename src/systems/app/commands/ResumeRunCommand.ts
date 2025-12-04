import { Command, execute } from '@/core/game/Command';
import type { Coroutine } from '@/core/game/Coroutine';
import type { RunState } from '@/data/game-state';
import { PhysicsSystem } from '../../physics/system';
import { LevelSystem } from '../../level/system';
import { ShowScreenCommand } from '../../navigation/commands/ShowScreenCommand';
import { LoadLevelCommand } from '../../level/commands/LoadLevelCommand';
import { GameScreen } from '@/screens/GameScreen';

export class ResumeRunCommand extends Command<{ run: RunState }> {
  *execute({ run }: { run: RunState }): Coroutine {
    console.log('[Command] Resume Run');

    // Restore run state
    this.context.run = run;

    // Show game screen
    yield execute(ShowScreenCommand, { screen: GameScreen });

    // Add game-specific systems dynamically
    this.context.systems.add(PhysicsSystem);
    this.context.systems.add(LevelSystem);

    // Resume from current level
    yield execute(LoadLevelCommand, { levelId: run.currentLevelId });
  }
}

