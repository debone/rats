import { Command, execute } from '@/core/game/Command';
import type { Coroutine } from '@/core/game/Coroutine';
import { setBallsRemaining } from '@/data/game-state';
import { MapScreen } from '@/screens/MapScreen';
import { PhysicsSystem } from '@/systems/physics/system';
import { ShowScreenCommand } from '../../navigation/commands/ShowScreenCommand';
import { SaveSystem } from '../../save/system';
import { STARTING_BALLS } from '@/consts';

export class StartNewRunCommand extends Command<{ startingLevelId: string }> {
  *execute({ startingLevelId }: { startingLevelId: string }): Coroutine {
    console.log('[Command] Start New Run');

    console.log('[Command] Start New Run: requested starting level', startingLevelId);

    // Hi Victor from future, if you see this, I'm sorry.
    // I already evolved from the idea of just setting the state directly
    // but then the methods still need calling
    setBallsRemaining(STARTING_BALLS);

    // Save the new run
    yield this.context.systems.get(SaveSystem).save();

    const physicsSystem = this.context.systems.get(PhysicsSystem);

    if (!this.context.worldId) {
      physicsSystem.createWorld(false);
    }

    // Show game screen
    yield execute(ShowScreenCommand, { screen: MapScreen });
  }
}
