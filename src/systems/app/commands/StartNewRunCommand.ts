import { Command, execute } from '@/core/game/Command';
import type { Coroutine } from '@/core/game/Coroutine';
import { SaveSystem } from '../../save/system';
import { PhysicsSystem } from '../../physics/system';
import { LevelSystem } from '../../level/system';
import { ShowScreenCommand } from '../../navigation/commands/ShowScreenCommand';
import { LoadLevelCommand } from '../../level/commands/LoadLevelCommand';
import { GameScreen } from '@/screens/GameScreen';

export class StartNewRunCommand extends Command<{ startingLevelId: string }> {
  *execute({ startingLevelId }: { startingLevelId: string }): Coroutine {
    console.log('[Command] Start New Run');

    // Initialize run state
    this.context.run = {
      currentLevelId: startingLevelId,
      levelsCompleted: [],
      activeBoons: [],
      temporaryUpgrades: [],
      lives: 3,
      score: 0,
      difficulty: 1,
    };

    // Save the new run
    yield this.context.systems.get(SaveSystem).save();

    // Show game screen
    yield execute(ShowScreenCommand, { screen: GameScreen });

    // Add game-specific systems dynamically
    this.context.systems.add(PhysicsSystem);
    this.context.systems.add(LevelSystem);

    // Start the first level
    yield execute(LoadLevelCommand, { levelId: startingLevelId });
  }
}

