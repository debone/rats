import { Command } from '@/core/game/Command';
import type { Coroutine } from '@/core/game/Coroutine';
import type { LevelResult } from '@/data/game-state';

interface Payload {
  success: boolean;
  result: LevelResult;
}

export class LevelFinishedCommand extends Command<Payload> {
  *execute({ success, result }: Payload): Coroutine {
    console.log(`[Command] Level Finished: ${success ? 'WIN' : 'LOSE'}`, result);

    if (!this.context.run) return;

    return;
    /*
    if (success) {
      yield execute(LevelCompleteCommand, result);
    } else {
      yield execute(LevelFailureCommand, result);
    }*/
  }
}
