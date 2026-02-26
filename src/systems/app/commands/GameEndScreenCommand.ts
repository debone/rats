import { Command } from '@/core/game/Command';
import { delay } from '@/core/game/Coroutine';
import { LAYER_NAMES } from '@/core/window/types';
import { t } from '@/i18n/i18n';
import { animate } from 'animejs';
import { Graphics, Text } from 'pixi.js';

const END_SCREEN_DURATION = 6000;
//const LEVEL_START_DURATION = 1000;

export class GameEndScreenCommand extends Command<void> {
  *execute() {
    const navigation = this.context.navigation;

    const dark = new Graphics();
    dark.rect(0, 0, navigation.width, navigation.height);
    dark.fill(0x322947);
    dark.alpha = 0;
    navigation.addToLayer(dark, LAYER_NAMES.OVERLAY);
    yield animate(dark, { alpha: 1, duration: 500, easing: 'linear' });

    const startLevel = new Text({
      text: t.dict['game.over'],
      style: {
        fontFamily: 'Georgia',
        fontSize: 48,
        fill: 0xffffff,
      },
      layout: true,
    });

    navigation.addToLayer(startLevel, LAYER_NAMES.OVERLAY);
    yield delay(END_SCREEN_DURATION);

    animate(startLevel, { alpha: 0, duration: END_SCREEN_DURATION, easing: 'linear' });
    animate(dark, { alpha: 0, duration: END_SCREEN_DURATION, easing: 'linear' });

    setTimeout(() => {
      dark.destroy();
      startLevel.destroy();
      navigation.hideLayer(LAYER_NAMES.OVERLAY);
    }, END_SCREEN_DURATION + 50);
  }
}
