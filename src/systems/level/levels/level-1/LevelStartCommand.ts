import { Command } from '@/core/game/Command';
import { delay } from '@/core/game/Coroutine';
import { LAYER_NAMES } from '@/core/window/types';
import { t } from '@/i18n/i18n';
import { animate } from 'animejs';
import { Graphics, Text } from 'pixi.js';

export class Level_1_LevelStartCommand extends Command<void> {
  *execute() {
    const navigation = this.context.navigation;

    const dark = new Graphics();
    dark.rect(0, 0, navigation.width, navigation.height);
    dark.fill(0x322947);
    dark.alpha = 1;
    navigation.addToLayer(dark, LAYER_NAMES.OVERLAY);

    const startLevel = new Text({
      text: t.dict['level.start'],
      style: {
        fontFamily: 'Georgia',
        fontSize: 48,
        fill: 0xffffff,
      },
      layout: true,
    });

    navigation.addToLayer(startLevel, LAYER_NAMES.OVERLAY);
    yield delay(20);

    animate(startLevel, { alpha: 0, duration: 1000, easing: 'linear' });
    animate(dark, { alpha: 0, duration: 1000, easing: 'linear' });

    setTimeout(() => {
      dark.destroy();
      startLevel.destroy();
      navigation.hideLayer(LAYER_NAMES.OVERLAY);
    }, 1050);
  }
}
