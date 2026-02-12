import { ASSETS, type PrototypeTextures } from '@/assets';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { typedAssets } from '@/core/assets/typed-assets';
import type { Cleanup } from '@/core/reactivity/signals/types';
import { getRunState } from '@/data/game-state';
import { LayoutContainer } from '@pixi/layout/components';
import { Sprite, Text } from 'pixi.js';

export class CheeseCounter extends LayoutContainer {
  cheeseSubscription: Cleanup;

  constructor() {
    super();

    this.layout = {
      backgroundColor: 0x272736,
      borderColor: 0x57294b,
      borderWidth: 1,
      borderRadius: 2,
      padding: 5,
      gap: 5,
      minHeight: 20,
      alignItems: 'baseline',
      minWidth: 48,
    };

    const cheeseSprite = new Sprite({
      texture: typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures['cheese_tile_1#0'],
    });

    cheeseSprite.layout = {
      objectFit: 'none',
      width: 16,
      height: 16,
    };

    this.addChild(cheeseSprite);

    const cheeseCountText = new Text({
      text: '0',
      style: {
        ...TEXT_STYLE_DEFAULT,
        fontSize: 16,
      },
      layout: true,
    });

    this.addChild(cheeseCountText);

    this.cheeseSubscription = getRunState().cheeseCounter.subscribe((cheeseCount) => {
      cheeseCountText.text = cheeseCount.toString();
    });
  }

  destroy() {
    super.destroy();
    this.cheeseSubscription();
  }
}
