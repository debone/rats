import { Command } from '@/core/game/Command';
import type { Coroutine } from '@/core/game/Coroutine';
import type { AppScreenConstructor } from '@/core/window/types';
import { GameEvent } from '@/data/events';

export class ShowOverlayCommand extends Command<{ overlay: AppScreenConstructor; waitForCompletion?: boolean }> {
  *execute({ overlay, waitForCompletion }: { overlay: AppScreenConstructor; waitForCompletion?: boolean }): Coroutine {
    yield this.context.navigation.showOverlay(overlay);

    if (waitForCompletion) {
      yield this.context.events.wait(GameEvent.OVERLAY_UNLOADED, { overlayId: overlay.SCREEN_ID });
    }
  }
}
