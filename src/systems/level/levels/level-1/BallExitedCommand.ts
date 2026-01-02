import { Command } from '@/core/game/Command';
import { delay } from '@/core/game/Coroutine';
import { PhysicsSystem } from '@/systems/physics/system';
import { LayoutContainer } from '@pixi/layout/components';
import { animate } from 'animejs';
import { Graphics, Text } from 'pixi.js';

export class Level_1_BallExitedCommand extends Command<void> {
  *execute() {
    const exitOverlay = new LayoutContainer({
      layout: {
        width: '100%',
        height: '100%',
      },
    });
    this.context.container!.addChild(exitOverlay);

    yield delay(300);

    const dark = new Graphics();
    dark.rect(-100, -100, exitOverlay.width + 200, exitOverlay.height + 200);
    dark.fill(0x322947);
    dark.alpha = 0;
    exitOverlay.addChild(dark);

    yield animate(dark, { alpha: 0.5, duration: 500, easing: 'linear' });

    const endLevel = new Text({
      text: 'Level Complete!',
      style: {
        fontFamily: 'Georgia',
        fontSize: 48,
        fill: 0xffffff,
      },
      layout: {
        width: '100%',
        height: 'auto',
      },
    });

    exitOverlay.addChild(endLevel);

    this.context.systems.get(PhysicsSystem).stop();
    yield delay(1000);
  }
}
