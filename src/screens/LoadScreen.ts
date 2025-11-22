import type { AppScreen } from '@/core/window/types';
import { CompositeTilemap } from '@pixi/tilemap';
import { animate } from 'animejs';
import { Assets, Container, Sprite, Texture, TilingSprite } from 'pixi.js';

export class LoadScreen extends Container implements AppScreen {
  static readonly SCREEN_ID = 'load';
  static readonly assetBundles = ['preload', 'default'];

  private readonly _background: TilingSprite;

  constructor() {
    super();

    const tilingSprite = new TilingSprite({ texture: Assets.get('tiles').textures.grid, width: 64, height: 64 });
    this._background = tilingSprite;
    this.addChild(this._background);

    const texture = Texture.from('vite.svg');
    const sprite = new Sprite(texture);
    this.addChild(sprite);
    animate(sprite, { x: 1000, duration: 5000, easing: 'easeInOutSine' });

    //const text = new Text('Loading...', { fontSize: 24, fontWeight: 'bold' });
    //this.addChild(text);

    console.log(Assets.get('tiles').textures.grid);

    const tilemap = new CompositeTilemap();

    tilemap.tile(Assets.get('tiles').textures.ball, 32, 0);
    tilemap.tile(Assets.get('tiles').textures.ball, 48, 0);

    this.addChild(tilemap);
  }

  public resize(w: number, h: number) {
    // Fit background to screen
    this._background.width = w;
    this._background.height = h;
  }
}
