import { Command } from '@/core/game/Command';
import type { Coroutine } from '@/core/game/Coroutine';
import { navigation } from '@/core/window/navigation';

export class DismissPopupCommand extends Command {
  *execute(): Coroutine {
    yield navigation.dismissPopup();
  }
}

