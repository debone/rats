import { Command } from '@/core/game/Command';
import { delay } from '@/core/game/Coroutine';
import { removeBallFromRun } from '@/data/game-state';

export class Level_2_LoseBallCommand extends Command<void> {
  *execute() {
    removeBallFromRun(1);

    yield delay(300);
  }
}
