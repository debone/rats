import { STARTING_BALLS } from '@/consts';
import { defineEntity, getUnmount, onMount } from '@/core/entity/scope';
import { Command, execute } from '@/core/game/Command';
import { GameEvent } from '@/data/events';
import { getGameContext } from '@/data/game-context';
import { setBallsRemaining } from '@/data/game-state';
import { useGameEvent } from '@/hooks/hooks';
import { FirstCrewSelector } from '@/screens/FirstCrewSelector';
import { LoadScreen } from '@/screens/LoadScreen';
import { LevelSystem } from '@/systems/level/system';
import { ShowScreenCommand } from '@/systems/navigation/commands/ShowScreenCommand';
import { EntityCollisionSystem } from '@/systems/physics/EntityCollisionSystem';
import { PhysicsSystem } from '@/systems/physics/system';
import { GameScene } from './GameScene';
import { VFXSystem } from '@/systems/vfx/VFXSystem';

export const HomeScene = defineEntity(() => {
  const destroy = getUnmount();

  useGameEvent(GameEvent.START_NEW_RUN, ({ startingLevelId }) => {
    destroy();
    GameScene({
      startingLevelId,
      onEnd: () => {
        HomeScene();
      },
    });
  });

  onMount(() => {
    execute(StartNewRunCommand);
  });

  return {};
});

// AppStartCommand
export class StartNewRunCommand extends Command {
  *execute() {
    const context = getGameContext();
    yield execute(ShowScreenCommand, { screen: LoadScreen });

    // TODO: check for savedRun here and transition to GameScene directly if found
    // const savedRun = await context.systems.get(SaveSystem).loadRun();

    context.systems.add(PhysicsSystem);
    context.systems.add(EntityCollisionSystem);
    context.systems.add(LevelSystem);
    context.systems.add(VFXSystem);

    setBallsRemaining(STARTING_BALLS);

    // context.systems.get(SaveSystem).save();

    if (!context.worldId) {
      context.systems.get(PhysicsSystem).createWorld(false);
    }

    yield execute(ShowScreenCommand, { screen: FirstCrewSelector });
  }
}
