import { ASSETS, FRAMES, type BackgroundTextures } from '@/assets';
import { MIN_HEIGHT, MIN_WIDTH } from '@/consts';
import { typedAssets } from '@/core/assets/typed-assets';
import type { AppScreen } from '@/core/window/types';
import { LayoutContainer, LayoutSprite, LayoutText } from '@pixi/layout/components';
import { CompositeTilemap } from '@pixi/tilemap';
import { animate } from 'animejs';
import { Assets, Container, Sprite, Texture, TilingSprite } from 'pixi.js';

export class LoadScreen extends Container implements AppScreen {
  static readonly SCREEN_ID = 'load';
  static readonly assetBundles = ['preload', 'ui'];

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

    const texture = Texture.from(ASSETS.vite_vite);
    const sprite = new Sprite(texture);
    this.addChild(sprite);
    animate(sprite, { x: 700, duration: 3000, easing: 'easeInOutSine' });

    //const text = new Text('Loading...', { fontSize: 24, fontWeight: 'bold' });
    //this.addChild(text);

    console.log(Assets.get('background.aseprite').textures);

    console.log(Assets.get(ASSETS.tiles).textures.grid);

    const tilemap = new CompositeTilemap();

    const bg = typedAssets.get<BackgroundTextures>(ASSETS.background).textures;
    const bgTextures = FRAMES.background;

    const aa_tile_1 = bg[bgTextures['aa_tile_1#0']];
    const aa_tile_2 = bg[bgTextures['aa_tile_2#0']];
    const aa_tile_3 = bg[bgTextures['aa_tile_3#0']];

    tilemap.tile(Assets.get('tiles').textures.ball, 32, 0);
    tilemap.tile(Assets.get('tiles').textures.ball, 48, 0);

    tilemap.tile(bg['aa_tile_1#0'], 32, 0);
    tilemap.tile(aa_tile_1, 32, 32);
    tilemap.tile(aa_tile_1, 32, 64);
    tilemap.tile(aa_tile_1, 32, 96);
    tilemap.tile(aa_tile_1, 32, 128);
    tilemap.tile(aa_tile_1, 32, 160);
    tilemap.tile(aa_tile_3, 32, 192);
    tilemap.tile(aa_tile_2, 32, 224);
    tilemap.tile(aa_tile_2, 32, 256);
    tilemap.tile(aa_tile_2, 32, 288);
    tilemap.tile(aa_tile_2, 32, 320);
    tilemap.tile(aa_tile_2, 32, 352);
    tilemap.tile(aa_tile_2, 32, 384);

    this.addChild(tilemap);

    const background = new LayoutContainer({
      layout: {
        width: MIN_WIDTH,
        height: MIN_HEIGHT,
        justifyContent: 'center',
        backgroundColor: 'red',
        alignItems: 'center',
      },
    });

    this.addChild(background);

    const text = new LayoutText({
      text: 'Loading...',
      style: { fontSize: 24, fontWeight: 'bold' },
      layout: { width: 300, height: 300 },
    });
    background.addChild(text);

    const defaults = {
      backgroundColor: `#1e293b`,
      borderWidth: 1,
      borderColor: `#fff`,
    };

    const box = new LayoutContainer({
      layout: { ...defaults, width: 300, height: 300, justifyContent: 'center', alignItems: 'center' },
    });
    background.addChild(box);

    const spr = new LayoutSprite({
      texture: aa_tile_1,
      layout: { width: aa_tile_1.width, height: 10 },
    });
    box.addChild(spr);

    spr.scale = 10;

    //this.sprite2 = new Sprite(texture);
    //box.addChild(this.sprite2);
    //this.box = box;

    console.log(box.layout);

    //this.sprite2.scale = 3;
    //this.sprite2.anchor.set(0.5, 0.5);

    //background.addChild(new LayoutContainer({ layout: { ...defaults, width: 300, height: 300 } }));
  }

  //private sprite2: Sprite;
  //private box: LayoutContainer;
  /*
  public show(): Promise<void> {
    const boxWidth = this.box.layout?.computedLayout.width;
    const boxHeight = this.box.layout?.computedLayout.height;
    this.sprite2.position.set(boxWidth ?? 0 / 2, boxHeight ?? 0 / 2);

    this.layout?.forceUpdate();
    this.box.layout?.forceUpdate();
    console.log(this.box.layout?.computedLayout);

    return Promise.resolve();
  }*/

  public async hide(): Promise<void> {
    await animate(this, { alpha: 0, duration: 1000, easing: 'easeInOutSine' });
    return Promise.resolve();
  }

  public resize(w: number, h: number) {
    // Fit background to screen
    this._background.width = w;
    this._background.height = h;
  }
}
