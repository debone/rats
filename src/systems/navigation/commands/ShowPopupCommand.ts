import { Command } from '@/core/game/Command';
import type { Coroutine } from '@/core/game/Coroutine';
import type { AppScreenConstructor } from '@/core/window/types';
import { navigation } from '@/core/window/navigation';

export class ShowPopupCommand extends Command<{ popup: AppScreenConstructor }> {
  *execute({ popup }: { popup: AppScreenConstructor }): Coroutine {
    yield navigation.presentPopup(popup);
  }
}

