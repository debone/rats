import { Command } from '@/core/game/Command';
import type { Coroutine } from '@/core/game/Coroutine';

export class DismissPopupCommand extends Command {
  *execute(): Coroutine {
    throw new Error('Not implemented');
    // yield navigation.dismissPopup();
  }
}
