import { ASSETS, type PrototypeTextures } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { Command } from '@/core/game/Command';
import { delay } from '@/core/game/Coroutine';
import { animate } from 'animejs';
import { Sprite } from 'pixi.js';

export class Level_1_DoorOpenCommand extends Command<void> {
  *execute() {
    // Wait for player selection
    // TODO: Replace with actual map screen interaction
    yield delay(300);

    const bg = typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures;
    const sprite = new Sprite(bg[`bricks_tile_1#0`]);
    sprite.alpha = 0;
    sprite.anchor.set(0.5, 0.5);
    sprite.position.set(400, 300);
    sprite.scale.set(4, 4);
    this.context.container!.addChild(sprite);

    animate(sprite, { alpha: 1, duration: 200, easing: 'linear' });

    yield delay(200);

    animate(sprite, { rotation: Math.PI, duration: 1000, easing: 'linear' });

    /*
    let selection;
    if (this.context.meta.runs % 2 === 0) {
      selection = { levelId: 'level-1' };
    } else {
      selection = { levelId: 'level-2' };
      //selection = yield this.context.events.wait(GameEvent.MAP_LEVEL_SELECTED);
    }

    // const selection = yield this.context.events.wait(GameEvent.MAP_LEVEL_SELECTED);

    // Show game screen and start next level
    yield execute(ShowScreenCommand, { screen: GameScreen });
    this.context.run.currentLevelId = selection.levelId;
    yield execute(LoadLevelCommand, { levelId: selection.levelId });
    */
  }
}
