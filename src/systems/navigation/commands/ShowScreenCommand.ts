import { Command } from '@/core/game/Command';
import type { Coroutine } from '@/core/game/Coroutine';
import type { AppScreenConstructor } from '@/core/window/types';
import { navigation } from '@/core/window/navigation';
import { GameEvent } from '@/data/events';

export class ShowScreenCommand extends Command<{ screen: AppScreenConstructor; waitForCompletion?: boolean }> {
  *execute({ screen, waitForExit }: { screen: AppScreenConstructor; waitForExit?: boolean }): Coroutine {
    yield navigation.showScreen(screen);
    // TODO: was this necessary? Maybe if we have screens that can be reused. The map knows what next, but maybe we are in the shop screen?
    if (waitForExit) {
      yield this.context.events.wait(GameEvent.SCREEN_UNLOADED, { screenId: screen.SCREEN_ID });
    }
  }
}
