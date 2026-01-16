import { Command, execute } from '@/core/game/Command';
import type { Coroutine } from '@/core/game/Coroutine';
import type { LevelResult } from '@/data/game-state';
import { LevelCompleteCommand } from './LevelCompleteCommand';
import { GameOverCommand } from '@/systems/app/commands/GameOverCommand';

export class LevelFinishedCommand extends Command<LevelResult> {
  *execute(result: LevelResult): Coroutine {
    console.log(`[Command] Level Finished: ${result.success ? 'WIN' : 'LOSE'}`, result);

    if (result.success) {
      yield execute(LevelCompleteCommand, result);
    } else {
      yield execute(GameOverCommand);
    }
  }
}
