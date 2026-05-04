import { Command, execute } from '@/core/game/Command';
import { delay, type Coroutine } from '@/core/game/Coroutine';
import { setCurrentLevelId } from '@/data/game-state';
import { GameScreen } from '@/screens/GameScreen/GameScreen';
import { PhysicsSystem } from '@/systems/physics/system';
import { ShowScreenCommand } from '../../navigation/commands/ShowScreenCommand';
import { LevelSystem } from '../system';
import { LoadLevelCommand } from './LoadLevelCommand';
import { UnloadLevelCommand } from './UnloadLevelCommand';

export class LevelTransitionCommand extends Command<{ nextLevelId: string }> {
  *execute({ nextLevelId }: { nextLevelId: string }): Coroutine {
    const physicsSystem = this.context.systems.get(PhysicsSystem);
    const levelSystem = this.context.systems.get(LevelSystem);

    this.context.phase = 'cutscene';
    yield delay(500);

    physicsSystem.stop();
    levelSystem.stop();

    yield execute(UnloadLevelCommand);
    yield execute(ShowScreenCommand, { screen: GameScreen });

    setCurrentLevelId(nextLevelId);
    yield execute(LoadLevelCommand, { levelId: nextLevelId });
  }
}
