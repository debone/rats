import { Command, execute } from '@/core/game/Command';
import type { Coroutine } from '@/core/game/Coroutine';
import { GameScreen } from '@/screens/GameScreen';
import { LoadLevelCommand } from '@/systems/level/commands/LoadLevelCommand';
import { LevelSystem } from '@/systems/level/system';
import { ShowScreenCommand } from '@/systems/navigation/commands/ShowScreenCommand';
import { PhysicsSystem } from '@/systems/physics/system';

export class LevelSelectedCommand extends Command<{ levelId: string }> {
  *execute({ levelId }: { levelId: string }): Coroutine {
    console.log('[Command] Level Selected', levelId);
    yield execute(ShowScreenCommand, { screen: GameScreen });

    // Add game-specific systems dynamically
    this.context.systems.add(PhysicsSystem);
    this.context.systems.add(LevelSystem);

    // Start the first level
    yield execute(LoadLevelCommand, { levelId });
  }
}
