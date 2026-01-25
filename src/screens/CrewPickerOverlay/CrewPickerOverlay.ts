import { TEXT_STYLE_DEFAULT } from '@/consts';
import { LAYER_NAMES, type AppScreen } from '@/core/window/types';
import { getGameContext } from '@/data/game-context';
import { LayoutContainer } from '@pixi/layout/components';
import { Button } from '@pixi/ui';
import { animate } from 'animejs';
import { DropShadowFilter } from 'pixi-filters';
import { Color, Container, Graphics, Text, Ticker } from 'pixi.js';

export class CrewPickerOverlay extends Container implements AppScreen {
  static readonly SCREEN_ID = 'crew-picker';
  static readonly assetBundles = ['default'];

  private _background: Graphics;

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
        width: 200,
        height: 200,
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

  private _popupBackground: LayoutContainer;

  async prepare() {
    console.log('[CrewPickerOverlay] Preparing...');

    const context = getGameContext();

    const buttonContainer = new LayoutContainer({
      layout: {
        gap: 10,
        padding: 10,
        backgroundColor: 0x272736,
        borderColor: 0x57294b,
        borderWidth: 1,
        borderRadius: 3,
        alignItems: 'center',
        justifyContent: 'center',
      },
    });

    buttonContainer.addChild(new Text({ text: 'Close', style: TEXT_STYLE_DEFAULT, layout: true }));

    const closeButton = new Button(buttonContainer);
    closeButton.enabled = true;

    closeButton.onPress.connect(() => {
      // navigation.dismissPopup();
      console.log('Close button pressed');
      context.navigation.dismissCurrentOverlay();
    });

    this._popupBackground.addChild(buttonContainer);

    this.addChild(this._popupBackground);

    context.navigation.addToLayer(this, LAYER_NAMES.POPUP);

    console.log('[CrewPickerOverlay] Prepared');
  }

  /**
   * Show is called when the screen is displayed.
   */
  async show() {
    console.log('[GameScreen] Showing...');
    // The game is already running via systems

    await animate(this._popupBackground, { alpha: 1, duration: 500 });

    // We just need to display the visuals
    console.log('[GameScreen] Shown');
  }

  async hide() {
    await animate(this._popupBackground.scale, { x: 0, y: 0, duration: 500, ease: 'inOutBack' });
  }

  /**
   * Update is called every frame.
   * Note: Game logic updates are handled by the SystemRunner in main.ts
   */
  update(_time: Ticker) {
    // Game screen specific updates (UI animations, etc.)
    // The actual game logic is updated by SystemRunner
  }

  /**
   * Resize is called when the screen size changes.
   */
  resize(w: number, h: number) {
    this._background.width = w;
    this._background.height = h;
  }

  /**
   * Called when window loses focus.
   */
  blur() {
    console.log('[GameScreen] Blurring...');
    const context = getGameContext();
    context.phase = 'paused';
  }

  /**
   * Called when window gains focus.
   */
  focus() {
    console.log('[GameScreen] Focusing...');
    const context = getGameContext();
    if (context.phase === 'paused') {
      context.phase = 'level';
    }
  }

  /**
   * Reset is called when the screen is removed.
   */
  reset() {
    console.log('[GameScreen] Resetting...');

    // Destroy containers
    for (const child of this.children) {
      child.destroy();
    }
  }
}
