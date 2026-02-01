import { ASSETS, type PrototypeTextures } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { createRefs, type RefCountable } from '@/core/reactivity/refs/ref-collection';
import { getRunState } from '@/data/game-state';
import { LayoutContainer } from '@pixi/layout/components';
import { Sprite } from 'pixi.js';

export class ScrapCounter extends LayoutContainer {
  scrapsUI: RefCountable;

  constructor() {
    super();

    this.layout = {
      backgroundColor: 0x272736,
      borderColor: 0x57294b,
      borderWidth: 1,
      borderRadius: 2,
      padding: 3,
      width: 128,
      minHeight: 20,
      flexWrap: 'wrap',
    };

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
      parent: this,
    });
  }

  destroy() {
    super.destroy();
    this.scrapsUI.destroy();
  }
}
