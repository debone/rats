import { Command, execute } from '@/core/game/Command';
import { delay, type Coroutine } from '@/core/game/Coroutine';
import { addCompletedLevel, setCurrentLevelId, type LevelResult } from '@/data/game-state';
import { CrewShopOverlay } from '@/screens/CrewPickerOverlay/CrewShopOverlay';
import { GameScreen } from '@/screens/GameScreen/GameScreen';
import { PhysicsSystem } from '@/systems/physics/system';
import { ShowOverlayCommand } from '../../navigation/commands/ShowOverlayCommand';
import { ShowScreenCommand } from '../../navigation/commands/ShowScreenCommand';
import { LevelSystem } from '../system';
import { LoadLevelCommand } from './LoadLevelCommand';
import { UnloadLevelCommand } from './UnloadLevelCommand';

export class LevelCompleteCommand extends Command<LevelResult> {
  *execute(result: LevelResult): Coroutine {
    console.log('[Command] Level Complete', result);

    const physicsSystem = this.context.systems.get(PhysicsSystem);
    const levelSystem = this.context.systems.get(LevelSystem);

    // Update run state
    addCompletedLevel(result.levelId);

    // Cutscene phase
    this.context.phase = 'cutscene';
    yield delay(500);

    // Crew shop: overlay pauses physics/level internally; waitForCompletion resumes once dismissed
    yield execute(ShowOverlayCommand, { overlay: CrewShopOverlay, waitForCompletion: true });

    physicsSystem.stop();
    levelSystem.stop();

    yield execute(UnloadLevelCommand);

    // Show map screen
    //this.context.phase = 'map';
    //yield execute(ShowScreenCommand, { screen: MapScreen });

    // Wait for player selection
    // TODO: Replace with actual map screen interaction
    //yield delay(2000);

    yield execute(ShowScreenCommand, { screen: GameScreen });

    let nextLevelId = '';
    if (result.levelId === 'level-0') nextLevelId = 'level-1';
    if (result.levelId === 'level-1') nextLevelId = 'level-4';
    else if (result.levelId === 'level-4') nextLevelId = 'level-3';
    else if (result.levelId === 'level-3') nextLevelId = 'level-2';
    else if (result.levelId === 'level-2') nextLevelId = 'level-0';

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
