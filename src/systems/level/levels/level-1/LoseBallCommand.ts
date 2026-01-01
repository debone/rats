import { type PrototypeTextures, ASSETS } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { Command } from '@/core/game/Command';
import { delay } from '@/core/game/Coroutine';
import { getGameContext } from '@/data/game-context';
import { animate } from 'animejs';
import { Sprite } from 'pixi.js';

export class Level_1_LoseBallCommand extends Command<void> {
  *execute() {
    const context = getGameContext();
    context.state.level?.ballsRemaining.update((value) => value - 1);

    yield delay(300);

    const bg = typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures;
    const sprite = new Sprite(bg[`bricks_tile_1#0`]);
    sprite.alpha = 0;
    sprite.tint = 0xff0000;
    sprite.anchor.set(0.5, 0.5);
    sprite.position.set(100, 300);
    sprite.scale.set(4, 4);
    this.context.container!.addChild(sprite);

    animate(sprite, { alpha: 1, duration: 200, easing: 'linear' });

    yield animate(sprite, { rotation: Math.PI, duration: 1000, easing: 'linear' });

    sprite.destroy();
  }
}
