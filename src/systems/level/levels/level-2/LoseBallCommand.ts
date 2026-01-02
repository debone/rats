import { Command } from '@/core/game/Command';
import { delay } from '@/core/game/Coroutine';
import { getGameContext } from '@/data/game-context';

export class Level_2_LoseBallCommand extends Command<void> {
  *execute() {
    const context = getGameContext();
    context.state.level?.ballsRemaining.update((value) => value - 1);

    yield delay(300);
  }
}
