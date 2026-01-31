import { Command } from '@/core/game/Command';
import { delay } from '@/core/game/Coroutine';
import { LAYER_NAMES } from '@/core/window/types';
import { t } from '@/i18n/i18n';
import { PhysicsSystem } from '@/systems/physics/system';
import { animate } from 'animejs';
import { Graphics, Text } from 'pixi.js';

export class Levels_BallExitedLevelCommand extends Command<void> {
  *execute() {
    const navigation = this.context.navigation;

    const dark = new Graphics();
    dark.rect(0, 0, navigation.width, navigation.height);
    dark.fill(0x322947);
    dark.alpha = 0;
    navigation.addToLayer(dark, LAYER_NAMES.OVERLAY);

    yield animate(dark, { alpha: 0.5, duration: 500, easing: 'linear' });

    const endLevel = new Text({
      text: t.dict['level.complete'],
      style: {
        fontFamily: 'Georgia',
        fontSize: 48,
        fill: 0xffffff,
      },
      layout: true,
    });

    navigation.addToLayer(endLevel, LAYER_NAMES.OVERLAY);

    this.context.systems.get(PhysicsSystem).stop();
    yield delay(1000);
  }
}
