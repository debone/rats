import { Command } from '@/core/game/Command';
import type { Coroutine } from '@/core/game/Coroutine';

export class DismissOverlayCommand extends Command {
  *execute(): Coroutine {
    yield this.context.navigation.dismissCurrentOverlay();
  }
}
