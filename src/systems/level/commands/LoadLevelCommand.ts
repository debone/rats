import { Command, execute } from '@/core/game/Command';
import type { Coroutine } from '@/core/game/Coroutine';
import { GameEvent } from '@/data/events';
import { getRunState } from '@/data/game-state';
import { CrewPickerOverlay } from '@/screens/CrewPickerOverlay/CrewPickerOverlay';
import { ShowOverlayCommand } from '@/systems/navigation/commands/ShowOverlayCommand';
import { PhysicsSystem } from '@/systems/physics/system';
import { LevelSystem } from '../system';

export class LoadLevelCommand extends Command<{ levelId: string }> {
  *execute({ levelId }: { levelId: string }): Coroutine {
    console.log(`[Command] Load Level: ${levelId}`);

    const levelSystem = this.context.systems.get(LevelSystem);
    const physicsSystem = this.context.systems.get(PhysicsSystem);

    this.context.phase = 'transition';

    yield levelSystem.loadLevel(levelId);

    this.context.phase = 'level';

    if (getRunState().currentLevelId !== 'level-1') {
      yield execute(ShowOverlayCommand, { overlay: CrewPickerOverlay });
    }

    physicsSystem.start();
    levelSystem.start();

    this.context.events.emit(GameEvent.LEVEL_STARTED, { levelId });
  }
}
