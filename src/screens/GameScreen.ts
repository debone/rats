import { MIN_HEIGHT, MIN_WIDTH } from '@/consts';
import type { AppScreen } from '@/core/window/types';
import { LayoutContainer } from '@pixi/layout/components';
import { Assets, Container, Graphics, TilingSprite } from 'pixi.js';

export class GameScreen extends Container implements AppScreen {
  static readonly SCREEN_ID = 'game';
  static readonly assetBundles = ['preload', 'default'];

  private readonly _background: TilingSprite;

  constructor() {
    super();

    this.layout = {
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'column',
    };

    const tilingSprite = new TilingSprite({ texture: Assets.get('tiles').textures.grid, width: 64, height: 64 });
    this._background = tilingSprite;
    this.addChild(this._background);

    const background = new LayoutContainer({
      layout: {
        width: MIN_WIDTH,
        height: MIN_HEIGHT,
        justifyContent: 'center',
        backgroundColor: 'pink',
        alignItems: 'center',
      },
    });

    this.addChild(background);
  }

  public resize(w: number, h: number) {
    // Fit background to screen
    this._background.width = w;
    this._background.height = h;
  }
}
