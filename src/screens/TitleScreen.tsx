import { MIN_HEIGHT, MIN_WIDTH, TEXT_STYLE_DEFAULT } from '@/consts';
import { execute } from '@/core/game/Command';
import { LAYER_NAMES, type AppScreen } from '@/core/window/types';
import { getGameContext } from '@/data/game-context';
import { GameEvent } from '@/data/events';
import { LayoutContainer } from '@pixi/layout/components';
import { Button } from '@pixi/ui';
import { ShowOverlayCommand } from '@/systems/navigation/commands/ShowOverlayCommand';
import { OptionsOverlay } from './OptionsOverlay';
import { animate } from 'animejs';
import { DropShadowFilter } from 'pixi-filters';
import { Assets, Container, Text, TilingSprite } from 'pixi.js';

function makeMenuButton(label: string, fontSize = 18) {
  const bg = new LayoutContainer({
    layout: {
      paddingTop: 10,
      paddingBottom: 10,
      paddingLeft: 28,
      paddingRight: 28,
      backgroundColor: 0x1a0d1e,
      borderColor: 0x9944bb,
      borderWidth: 2,
      borderRadius: 5,
      alignItems: 'center',
      justifyContent: 'center',
      width: 200,
    },
  });
  bg.addChild(new Text({ text: label, style: { ...TEXT_STYLE_DEFAULT, fontSize }, layout: true }));
  const btn = new Button(bg);

  btn.onHover.connect(() => {
    bg.background.tint = 0xcc88ff;
  });
  btn.onOut.connect(() => {
    bg.background.tint = 0xffffff;
  });

  return btn;
}

export class TitleScreen extends Container implements AppScreen {
  static readonly SCREEN_ID = 'title';
  static readonly assetBundles = ['preload', 'default'];

  private _bg?: TilingSprite;
  private _content: LayoutContainer;

  constructor() {
    super();

    this._content = new LayoutContainer({
      layout: {
        width: MIN_WIDTH,
        height: MIN_HEIGHT,
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
      width: MIN_WIDTH,
      height: MIN_HEIGHT,
    });
    this._bg = bg;
    ctx.navigation.addToLayer(bg, LAYER_NAMES.BACKGROUND);

    // Title text
    const titleText = new Text({
      text: 'RATZ',
      style: {
        ...TEXT_STYLE_DEFAULT,
        fontSize: 72,
        letterSpacing: 12,
        fontWeight: 'bold',
      },
      layout: true,
    });
    titleText.filters = [
      new DropShadowFilter({ color: 0xcc44ff, blur: 12 }),
      new DropShadowFilter({ color: 0x000000, blur: 4 }),
    ];

    const subtitleText = new Text({
      text: 'A CHEESE BREAKOUT ROGUELITE',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 10, letterSpacing: 3 },
      layout: { marginBottom: 30 },
    });

    const playBtn = makeMenuButton('PLAY');
    const optionsBtn = makeMenuButton('OPTIONS', 16);

    playBtn.onPress.connect(() => {
      ctx.events.emit(GameEvent.TITLE_PLAY_PRESSED);
    });

    optionsBtn.onPress.connect(() => {
      execute(ShowOverlayCommand, { overlay: OptionsOverlay });
    });

    const versionText = new Text({
      text: 'v0.1.0-alpha',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 9 },
      layout: { marginTop: 40 },
    });

    <mount target={this._content}>
      {titleText}
      {subtitleText}
      {playBtn.view!}
      {optionsBtn.view!}
      {versionText}
    </mount>;

    ctx.navigation.addToLayer(this._content, LAYER_NAMES.UI);
  }

  async show() {
    await animate(this._content, { alpha: 1, duration: 600, ease: 'outQuad' });
  }

  async hide() {
    await animate(this._content, { alpha: 0, duration: 300, ease: 'inQuad' });
  }

  resize(w: number, h: number) {
    if (this._bg) {
      this._bg.width = w;
      this._bg.height = h;
    }
    this._content.layout = {
      ...this._content.layout!,
      width: w,
      height: h,
    };
  }

  reset() {
    this._content.destroy({ children: true });
    this._bg?.destroy();
  }
}
