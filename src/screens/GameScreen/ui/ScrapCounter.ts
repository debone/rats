import { ASSETS, type PrototypeTextures } from '@/assets';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { typedAssets } from '@/core/assets/typed-assets';
import { createRefs, type RefCountable } from '@/core/reactivity/refs/ref-collection';
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
      alignItems: 'baseline',
      minWidth: 48,
    };

    const scrapSprite = new Sprite({
      texture: typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures['scraps#0'],
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
        fontSize: 16,
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

class ScrapCounter2 extends LayoutContainer {
  scrapsUI: RefCountable;

  constructor() {
    super();

    this.layout = {
      backgroundColor: 0x272736,
      borderColor: 0x57294b,
      borderWidth: 1,
      borderRadius: 2,
      padding: 3,
      paddingLeft: 5,
      paddingRight: 5,
      gap: 5,
      width: 128,
    };

    const scrapCountText = new Text({
      text: '0',
      style: {
        ...TEXT_STYLE_DEFAULT,
        fontWeight: 'bold',
      },
      layout: true,
    });

    this.addChild(scrapCountText);

    this.scrapSubscription = getRunState().scrapsCounter.subscribe((scrapCount) => {
      scrapCountText.text = scrapCount.toString();
    });

    const scrapsContainer = new LayoutContainer({
      layout: {
        gap: 5,
        flexWrap: 'wrap',
      },
    });

    this.addChild(scrapsContainer);

    this.scrapsUI = createRefs({
      path: 'scraps',
      template: () => {
        const scrapSprite = new Sprite(typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures['scraps#0']);
        scrapSprite.scale.set(0.75, 0.75);
        scrapSprite.layout = {
          objectFit: 'cover',
        };
        return scrapSprite;
      },
      size: getRunState().scrapsCounter,
      parent: scrapsContainer,
    });
  }

  scrapSubscription: Cleanup;

  destroy() {
    super.destroy();
    this.scrapsUI.destroy();
    this.scrapSubscription();
  }
}
