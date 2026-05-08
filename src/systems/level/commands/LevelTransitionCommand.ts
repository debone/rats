import { Command, execute } from '@/core/game/Command';
import type { Coroutine } from '@/core/game/Coroutine';
import { UnloadLevelCommand } from './UnloadLevelCommand';
import { LevelSystem } from '../system';
import { PhysicsSystem } from '@/systems/physics/system';
import { GameScreen } from '@/screens/GameScreen/GameScreen';
import { ShowScreenCommand } from '@/systems/navigation/commands/ShowScreenCommand';
import { LoadLevelCommand } from './LoadLevelCommand';
import { setCurrentLevelId } from '@/data/game-state';

export class LevelTransitionCommand extends Command<{ nextLevelId: string }> {
  *execute({ nextLevelId }: { nextLevelId: string }): Coroutine {
    const physicsSystem = this.context.systems.get(PhysicsSystem);
    const levelSystem = this.context.systems.get(LevelSystem);

    physicsSystem.stop();
    levelSystem.stop();

    yield execute(UnloadLevelCommand);
    yield execute(ShowScreenCommand, { screen: GameScreen });

    setCurrentLevelId(nextLevelId);
    yield execute(LoadLevelCommand, { levelId: nextLevelId });
  }
}
