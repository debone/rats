import { Command } from '@/core/game/Command';
import { delay } from '@/core/game/Coroutine';
import { t } from '@/i18n/i18n';
import { animate } from 'animejs';
import { Graphics, Text } from 'pixi.js';

export class Level_1_LevelStartCommand extends Command<void> {
  *execute() {
    const layers = this.context.layers!;

    const dark = new Graphics();
    dark.rect(-100, -100, layers.overlay.width + 200, layers.overlay.height + 200);
    dark.fill(0x322947);
    dark.alpha = 1;
    layers.overlay.addChild(dark);

    const startLevel = new Text({
      text: t.dict['level.start'],
      style: {
        fontFamily: 'Georgia',
        fontSize: 48,
        fill: 0xffffff,
      },
      layout: true,
    });

    layers.overlay.addChild(startLevel);
    yield delay(20);

    animate(startLevel, { alpha: 0, duration: 1000, easing: 'linear' });
    animate(dark, { alpha: 0, duration: 1000, easing: 'linear' });

    setTimeout(() => {
      dark.destroy();
      startLevel.destroy();
    }, 1050);
  }
}
