import { ASSETS } from '@/assets';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { bgm } from '@/core/audio/audio';
import { execute } from '@/core/game/Command';
import { LAYER_NAMES, type AppScreen } from '@/core/window/types';
import { GameEvent } from '@/data/events';
import { getGameContext } from '@/data/game-context';
import { ShowOverlayCommand } from '@/systems/navigation/commands/ShowOverlayCommand';
import { animate } from 'animejs';
import { DropShadowFilter } from 'pixi-filters';
import { Assets, Container, Text, TilingSprite } from 'pixi.js';
import { MenuButton } from './components/MenuButton';
import { OptionsOverlay } from './OptionsOverlay';

export class TitleScreen extends Container implements AppScreen {
  static readonly SCREEN_ID = 'title';
  static readonly assetBundles = ['preload', 'default'];

  private _bg?: TilingSprite;

  constructor() {
    super({
      layout: {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
      },
      alpha: 0,
    });
  }

  async prepare() {
    const ctx = getGameContext();

    // Tiling background
    const bg = new TilingSprite({
      texture: Assets.get('tiles').textures.grid,
      x: -ctx.navigation.width / 2,
      y: -ctx.navigation.height / 2,
    });
    this._bg = bg;
    ctx.navigation.addToLayer(bg, LAYER_NAMES.BACKGROUND);

    bgm.play(ASSETS.sounds_10__Darkened_Pursuit_LOOP);

    // Title text
    const titleText = new Text({
      text: 'RATS',
      style: {
        ...TEXT_STYLE_DEFAULT,
        fontSize: 72,
        letterSpacing: -4,
        fontWeight: 'bold',
      },
      layout: true,
    });
    titleText.filters = [
      new DropShadowFilter({ color: 0xcc44ff, blur: 12 }),
      new DropShadowFilter({ color: 0x000000, blur: 4 }),
    ];

    const subtitleText = new Text({
      text: 'RATS AGAINST THE SEWERS',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 10, letterSpacing: 3 },
      layout: { marginBottom: 30 },
    });

    const onPlay = () => {
      // ctx.events.emit(GameEvent.TITLE_PLAY_PRESSED);
      ctx.events.emit(GameEvent.SCREEN_UNLOADED, { screenId: TitleScreen.SCREEN_ID });
    };

    const onOptions = () => {
      execute(ShowOverlayCommand, { overlay: OptionsOverlay });
    };

    const versionText = new Text({
      text: 'v0.1.0-alpha',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 9 },
      layout: { marginTop: 40 },
    });

    <mount target={this}>
      {titleText}
      {subtitleText}
      <MenuButton label="PLAY" onPress={onPlay} />
      <MenuButton label="OPTIONS" onPress={onOptions} />
      {versionText}
    </mount>;

    ctx.navigation.addToLayer(this, LAYER_NAMES.UI);
  }

  async show() {
    await animate(this, { alpha: 1, duration: 600, ease: 'outQuad' });
  }

  async hide() {
    await animate(this, { alpha: 0, duration: 300, ease: 'inQuad' });
  }

  resize(w: number, h: number) {
    if (this._bg) {
      this._bg.width = w;
      this._bg.height = h;
      this._bg.x = -w / 2;
      this._bg.y = -h / 2;
    }
  }

  reset() {
    this._bg?.destroy();
  }
}
