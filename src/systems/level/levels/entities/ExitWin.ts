import { defineEntity } from '@/core/entity/scope';
import { execute } from '@/core/game/Command';
import { GameEvent } from '@/data/events';
import { useGameEvent } from '@/hooks/hooks';
import { Levels_BallExitedLevelCommand } from '../commands/BallExitedCommand';

export interface ExitWinProps {
  onWin: () => void;
}

export const ExitWin = defineEntity((props: ExitWinProps) => {
  let done = false;

  useGameEvent(GameEvent.BALL_EXITED, async () => {
    if (done) return;
    done = true;
    await execute(Levels_BallExitedLevelCommand);
    props.onWin();
  });

  return {};
});

export type ExitWinEntity = ReturnType<typeof ExitWin>;
