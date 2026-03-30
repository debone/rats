import { ASSETS, type PrototypeTextures } from '@/assets';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { typedAssets } from '@/core/assets/typed-assets';
import type { Cleanup } from '@/core/reactivity/signals/types';
import { getRunState } from '@/data/game-state';
import { LayoutContainer } from '@pixi/layout/components';
import { Sprite, Text } from 'pixi.js';

export class ScrapCounter extends LayoutContainer {
  scrapSubscription: Cleanup;

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
      alignItems: 'center',
      minWidth: 64,
    };

    const scrapSprite = new Sprite({
      texture: typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures['scraps#0'],
      scale: 2,
    });

    scrapSprite.layout = {
      objectFit: 'none',
      width: 16,
      height: 16,
    };

    this.addChild(scrapSprite);

    const scrapCountText = new Text({
      text: '0',
      style: {
        ...TEXT_STYLE_DEFAULT,
        fontSize: 14,
      },
      layout: true,
    });

    this.addChild(scrapCountText);

    this.scrapSubscription = getRunState().scrapsCounter.subscribe((scrapCount) => {
      scrapCountText.text = scrapCount.toString();
    });
  }

  destroy() {
    super.destroy();
    this.scrapSubscription();
  }
}
