import { defineEntity, getUnmount } from '@/core/entity/scope';
import { execute } from '@/core/game/Command';
import { GameEvent } from '@/data/events';
import { ENTITY_KINDS, type EntityBase } from '@/entities/entity-kinds';
import { useGameEvent } from '@/hooks/hooks';
import { Levels_BallExitedLevelCommand } from '../commands/BallExitedCommand';

export interface ExitWinProps {
  onWin: () => void;
}

export interface ExitWinEntity extends EntityBase<typeof ENTITY_KINDS.exitWin> {}

export const ExitWin = defineEntity((props: ExitWinProps): ExitWinEntity => {
  const unmount = getUnmount();
  let done = false;

  useGameEvent(GameEvent.BALL_EXITED, async () => {
    if (done) return;
    done = true;
    await execute(Levels_BallExitedLevelCommand);
    props.onWin();
  });

  return {
    kind: ENTITY_KINDS.exitWin,
    destroy() {
      unmount();
    },
  };
});
