import { Command, execute } from '@/core/game/Command';
import type { Coroutine } from '@/core/game/Coroutine';
import { MapScreen } from '@/screens/MapScreen';
import { ShowScreenCommand } from '../../navigation/commands/ShowScreenCommand';
import { SaveSystem } from '../../save/system';
import { PhysicsSystem } from '@/systems/physics/system';

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

    const physicsSystem = this.context.systems.get(PhysicsSystem);
    physicsSystem.createWorld(false);

    // Show game screen
    yield execute(ShowScreenCommand, { screen: MapScreen });
  }
}
