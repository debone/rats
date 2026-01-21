import { Command } from '@/core/game/Command';
import type { Coroutine } from '@/core/game/Coroutine';
import type { AppScreenConstructor } from '@/core/window/types';

export class ShowPopupCommand extends Command<{ popup: AppScreenConstructor }> {
  *execute({ popup }: { popup: AppScreenConstructor }): Coroutine {
    throw new Error(`Not implemented: ${popup.SCREEN_ID}`);
    // yield navigation.presentPopup(popup);
  }
}
