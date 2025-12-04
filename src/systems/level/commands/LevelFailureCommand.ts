import { Command, execute } from '@/core/game/Command';
import type { Coroutine } from '@/core/game/Coroutine';
import type { LevelResult } from '@/data/game-state';
import { GameOverCommand } from '../../app/commands/GameOverCommand';
import { LoadLevelCommand } from './LoadLevelCommand';

export class LevelFailureCommand extends Command<LevelResult> {
  *execute(_result: LevelResult): Coroutine {
    console.log('[Command] Level Failure');

    if (!this.context.run) return;

    this.context.run.lives--;

    if (this.context.run.lives <= 0) {
      yield execute(GameOverCommand, {
        score: this.context.run.score,
        levelsCompleted: this.context.run.levelsCompleted.length,
      });
    } else {
      yield execute(LoadLevelCommand, {
        levelId: this.context.run.currentLevelId,
      });
    }
  }
}

