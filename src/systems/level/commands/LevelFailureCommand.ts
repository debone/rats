import { assert } from '@/core/common/assert';
import { Command } from '@/core/game/Command';
import type { Coroutine } from '@/core/game/Coroutine';
import type { LevelResult } from '@/data/game-state';

export class LevelFailureCommand extends Command<LevelResult> {
  *execute(_result: LevelResult): Coroutine {
    console.log('[Command] Level Failure');

    assert(false, 'Level failure command not implemented');

    /*
    this.context.state.run.lives--;

    if (this.context.state.run.lives <= 0) {
      yield execute(GameOverCommand, {
        score: this.context.state.run.score,
        levelsCompleted: this.context.state.run.levelsCompleted.length,
      });
    } else {
      yield execute(LoadLevelCommand, {
        levelId: this.context.state.run.currentLevelId,
      });
    }
      */
  }
}
