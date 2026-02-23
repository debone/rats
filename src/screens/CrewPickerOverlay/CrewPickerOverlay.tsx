import { LAYER_NAMES, type AppScreen } from '@/core/window/types';
import { getGameContext } from '@/data/game-context';
import { getRunState } from '@/data/game-state';
import { LayoutContainer } from '@pixi/layout/components';
import { animate } from 'animejs';
import { DropShadowFilter } from 'pixi-filters';
import { Color, Container, Graphics, Ticker } from 'pixi.js';
import { addScraps } from './actions';
import { CrewSection } from './sections/CrewSection';
import { Footer } from './sections/Footer';
import { Header } from './sections/Header';
import { ShopSection } from './sections/ShopSection';

export class CrewPickerOverlay extends Container implements AppScreen {
  static readonly SCREEN_ID = 'crew-picker';
  static readonly assetBundles = ['default'];

  private _background: Graphics;
  private _popupBackground: LayoutContainer;

  constructor() {
    super({
      layout: {
        backgroundColor: new Color({ r: 30, g: 30, b: 45, a: 0.8 }),
        gap: 10,
        padding: 10,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      },
    });

    const background = new Graphics().rect(0, 0, 50, 50).fill({ color: 0x000000, alpha: 0.5 });
    background.interactive = true;
    this.addChild(background);
    this._background = background;

    const popupBackground = new LayoutContainer({
      layout: {
        backgroundColor: 0x272736,
        borderColor: 0x57294b,
        borderWidth: 1,
        borderRadius: 5,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      },
      alpha: 0,
    });
    this._popupBackground = popupBackground;

    this._popupBackground.background.filters = [
      new DropShadowFilter({
        color: 0x101019,
        blur: 10,
      }),
    ];
  }

  async prepare() {
    console.log('[CrewPickerOverlay] Preparing...');

    const context = getGameContext();

    <mount target={this._popupBackground}>
      <Header
        scrapsCounter={getRunState().scrapsCounter}
        onAddScraps={() => addScraps(50)}
        onClose={() => context.navigation.dismissCurrentOverlay()}
      />
      <ShopSection />
      <CrewSection surface={this} />
      <Footer />
    </mount>;

    this.addChild(this._popupBackground);
    context.navigation.addToLayer(this, LAYER_NAMES.POPUP);

    console.log('[CrewPickerOverlay] Prepared');
  }

  async show() {
    console.log('[CrewPickerOverlay] Showing...');
    await animate(this._popupBackground, { alpha: 1, duration: 500 });
    console.log('[CrewPickerOverlay] Shown');
  }

  async hide() {
    await animate(this._popupBackground.scale, { x: 0, y: 0, duration: 500, ease: 'inOutBack' });
  }

  update(_time: Ticker) {}

  resize(w: number, h: number) {
    this._background.width = w;
    this._background.height = h;
  }

  blur() {
    const context = getGameContext();
    context.phase = 'paused';
  }

  focus() {
    const context = getGameContext();
    if (context.phase === 'paused') {
      context.phase = 'level';
    }
  }

  reset() {
    console.log('[CrewPickerOverlay] Resetting...');

    for (let i = this.children.length - 1; i >= 0; i--) {
      this.children[i].destroy({ children: true });
    }
  }
}
