import { defineEntity } from '@/core/entity/scope';
import { execute } from '@/core/game/Command';
import { GameEvent } from '@/data/events';
import { Levels_BallExitedLevelCommand } from '@/gameplay/levels/commands/BallExitedCommand';
import { useGameEvent } from '@/hooks/hooks';

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
});
