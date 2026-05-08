import { GameEvent } from '@/data/events';
import { getGameContext } from '@/data/game-context';
import { getRunState } from '@/data/game-state';

export function useLevelOutcome(levelId: string) {
  let finished = false;

  const onWin = () => {
    if (finished) return;
    finished = true;
    const result = { levelId, success: true };
    getGameContext().events.emit(GameEvent.LEVEL_WON, result);
  };

  const onLose = () => {
    if (finished) return;
    finished = true;
    const result = { levelId, success: false };
    getGameContext().events.emit(GameEvent.LEVEL_LOST, result);
  };

  const checkLoseCondition = () => {
    const runState = getRunState();
    return runState ? runState.ballsRemaining.get() <= 0 : false;
  };

  return { onWin, onLose, checkLoseCondition };
}
