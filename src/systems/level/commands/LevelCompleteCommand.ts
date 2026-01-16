import { Command, execute } from '@/core/game/Command';
import { delay, type Coroutine } from '@/core/game/Coroutine';
import { addCompletedLevel, setCurrentLevelId, type LevelResult } from '@/data/game-state';
import { GameScreen } from '@/screens/GameScreen/GameScreen';
import { PhysicsSystem } from '@/systems/physics/system';
import { ShowScreenCommand } from '../../navigation/commands/ShowScreenCommand';
import { LoadLevelCommand } from './LoadLevelCommand';
import { UnloadLevelCommand } from './UnloadLevelCommand';

export class LevelCompleteCommand extends Command<LevelResult> {
  *execute(result: LevelResult): Coroutine {
    console.log('[Command] Level Complete', result);

    const physicsSystem = this.context.systems.get(PhysicsSystem);

    // Update run state
    addCompletedLevel(result.levelId);

    // Cutscene phase
    this.context.phase = 'cutscene';
    //yield execute(UnloadLevelCommand);
    yield delay(500);

    physicsSystem.stop();
    yield execute(UnloadLevelCommand);

    // Show map screen
    //this.context.phase = 'map';
    //yield execute(ShowScreenCommand, { screen: MapScreen });

    // Wait for player selection
    // TODO: Replace with actual map screen interaction
    //yield delay(2000);

    yield execute(ShowScreenCommand, { screen: GameScreen });

    const nextLevelId = 'level-2';
    setCurrentLevelId(nextLevelId);
    yield execute(LoadLevelCommand, { levelId: nextLevelId });

    /*
    let selection;
    if (this.context.meta.runs % 2 === 0) {
      selection = { levelId: 'level-1' };
    } else {
      selection = { levelId: 'level-2' };
      //selection = yield this.context.events.wait(GameEvent.MAP_LEVEL_SELECTED);
    }

    // const selection = yield this.context.events.wait(GameEvent.MAP_LEVEL_SELECTED);

    // Show game screen and start next level
    yield execute(ShowScreenCommand, { screen: GameScreen });
    this.context.run.currentLevelId = selection.levelId;
    yield execute(LoadLevelCommand, { levelId: selection.levelId });
    */
  }
}
