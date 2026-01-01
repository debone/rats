import { Command, execute } from '@/core/game/Command';
import { delay, type Coroutine } from '@/core/game/Coroutine';
import type { LevelResult } from '@/data/game-state';
import { GameScreen } from '@/screens/GameScreen/GameScreen';
import { PhysicsSystem } from '@/systems/physics/system';
import { ShowScreenCommand } from '../../navigation/commands/ShowScreenCommand';
import { SaveSystem } from '../../save/system';
import { LoadLevelCommand } from './LoadLevelCommand';

export class LevelCompleteCommand extends Command<LevelResult> {
  *execute(result: LevelResult): Coroutine {
    console.log('[Command] Level Complete', result);

    const saveSystem = this.context.systems.get(SaveSystem);
    const physicsSystem = this.context.systems.get(PhysicsSystem);

    // Update run state
    this.context.state.run.levelsCompleted.push(this.context.state.run.currentLevelId);
    // this.context.state.run.score += result.score;
    // this.context.state.run.activeBoons.push(...result.boonsEarned);

    // Update meta state
    if (!this.context.state.meta.completedLevels.includes(this.context.state.run.currentLevelId)) {
      this.context.state.meta.completedLevels.push(this.context.state.run.currentLevelId);
    }

    // Update meta state
    this.context.state.meta.runs++;

    // Save progress
    yield saveSystem.save();

    // Cutscene phase
    this.context.phase = 'cutscene';
    //yield execute(UnloadLevelCommand);
    yield delay(500);

    physicsSystem.stop();

    // Show map screen
    //this.context.phase = 'map';
    //yield execute(ShowScreenCommand, { screen: MapScreen });

    // Wait for player selection
    // TODO: Replace with actual map screen interaction
    //yield delay(2000);

    yield execute(ShowScreenCommand, { screen: GameScreen });
    this.context.state.run.currentLevelId = 'level-2';
    yield execute(LoadLevelCommand, { levelId: 'level-2' });

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
