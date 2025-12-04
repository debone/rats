import { Command } from '@/core/game/Command';
import type { Coroutine } from '@/core/game/Coroutine';
import type { AppScreenConstructor } from '@/core/window/types';
import { navigation } from '@/core/window/navigation';

export class ShowScreenCommand extends Command<{ screen: AppScreenConstructor }> {
  *execute({ screen }: { screen: AppScreenConstructor }): Coroutine {
    yield navigation.showScreen(screen);
  }
}

