import { execute } from '@/core/game/Command';
import { getGameContext } from '@/data/game-context';
import { GameEvent } from '@/data/events';
import { getRunState, type LevelResult } from '@/data/game-state';
import { LevelFinishedCommand } from './commands/LevelFinishedCommand';

export interface LevelConfig {
  id: string;
  name: string;
}

export function useLevelOutcome(levelId: string) {
  let finished = false;

  function onWin(): void {
    if (finished) return;
    finished = true;
    const result: LevelResult = { levelId, success: true };
    getGameContext().events.emit(GameEvent.LEVEL_WON, result);
    execute(LevelFinishedCommand, result);
  }

  function onLose(): void {
    if (finished) return;
    finished = true;
    const result: LevelResult = { levelId, success: false };
    getGameContext().events.emit(GameEvent.LEVEL_LOST, result);
    execute(LevelFinishedCommand, result);
  }

  function checkLoseCondition(): boolean {
    return getRunState().ballsRemaining.get() <= 0;
  }

  return { onWin, onLose, checkLoseCondition };
}
