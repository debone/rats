import { Command, execute } from '@/core/game/Command';
import type { Coroutine } from '@/core/game/Coroutine';
import { GameEvent } from '@/data/events';
import { SaveSystem } from '../../save/system';
import { PhysicsSystem } from '../../physics/system';
import { LevelSystem } from '../../level/system';
import { StartNewRunCommand } from './StartNewRunCommand';

interface Payload {
  score: number;
  levelsCompleted: number;
}

export class GameOverCommand extends Command<Payload> {
  *execute({ score, levelsCompleted }: Payload): Coroutine {
    console.log('[Command] Game Over', { score, levelsCompleted });

    // Remove game-specific systems
    this.context.systems.remove(LevelSystem);
    this.context.systems.remove(PhysicsSystem);

    // Clear run state
    this.context.run = null;
    yield this.context.systems.get(SaveSystem).clearRun();

    // Emit data for UI
    this.context.events.emit(GameEvent.GAME_OVER_DATA, { score, levelsCompleted });

    // Wait for player action
    const action = yield this.context.events.wait(GameEvent.GAME_OVER_ACTION);

    if (action === 'restart') {
      yield execute(StartNewRunCommand, { startingLevelId: 'level-1' });
    } else {
      this.context.events.emit(GameEvent.GAME_QUIT);
    }
  }
}

