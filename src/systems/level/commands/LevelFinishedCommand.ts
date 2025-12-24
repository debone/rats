import { Command, execute } from '@/core/game/Command';
import type { Coroutine } from '@/core/game/Coroutine';
import type { LevelResult } from '@/data/game-state';
import { LevelCompleteCommand } from './LevelCompleteCommand';
import { LevelFailureCommand } from './LevelFailureCommand';

interface Payload {
  success: boolean;
  result: LevelResult;
}

export class LevelFinishedCommand extends Command<Payload> {
  *execute({ success, result }: Payload): Coroutine {
    console.log(`[Command] Level Finished: ${success ? 'WIN' : 'LOSE'}`, result);

    if (!this.context.run) return;

    if (success) {
      yield execute(LevelCompleteCommand, result);
    } else {
      yield execute(LevelFailureCommand, result);
    }
  }
}
