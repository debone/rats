import { ASSETS, FRAMES, type PrototypeTextures } from '@/assets';
import { TEXT_STYLE_DEFAULT, TEXT_STYLE_TITLE } from '@/consts';
import { typedAssets } from '@/core/assets/typed-assets';
import { signal } from '@/core/reactivity/signals/signals';
import { LAYER_NAMES, type AppScreen } from '@/core/window/types';
import { getGameContext } from '@/data/game-context';
import { getRunState } from '@/data/game-state';
import { LayoutContainer } from '@pixi/layout/components';
import { Button } from '@pixi/ui';
import { animate } from 'animejs';
import { DropShadowFilter } from 'pixi-filters';
import { Color, Container, Graphics, Sprite, Text, Ticker } from 'pixi.js';

class PrimaryButton extends Button {
  constructor(label: string) {
    const view = new LayoutContainer({
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

    view.addChild(new Text({ text: label, style: TEXT_STYLE_DEFAULT, layout: true }));

    super(view);

    this.onPress.connect(() => {
      console.log('Primary button pressed');
    });
  }
}

class CrewMemberBadge extends LayoutContainer {
  constructor(name: string) {
    /*
+---------------------------------------------------------+
|                                                         |
|  +------------+                                         |
|  |            | TITLE                                   |
|  |            |                                         |
|  |            | Description                             |
|  |            |                                         |
|  |            |                                         |
|  |            |                                         |
|  |            |                                         |
|  +------------+                                         |
|                                                         |
|  +------------+ +-------------------------------------+ |
|  | crew power | | 123 Scraps to hire                  | |
|  +------------+ +-------------------------------------+ |
|                                                         |
+---------------------------------------------------------+
 */
    super({
      layout: {
        backgroundColor: 0x272736,
        borderColor: 0x57294b,
        borderWidth: 1,
        borderRadius: 3,
        minWidth: 480,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 5,
        gap: 10,
        height: '100%',
      },
    });

    const leftContent = new LayoutContainer({
      layout: {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: 5,
        debug: true,
      },
    });

    const middleContent = new LayoutContainer({
      layout: {
        flexGrow: 1,
        height: '100%',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        gap: 10,
        padding: 5,
      },
    });

    const rightContent = new LayoutContainer({
      layout: {
        height: '100%',
        flexDirection: 'column',
        gap: 10,
        padding: 5,
      },
    });

    const frame = new Sprite({
      texture: typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures[FRAMES.prototype['avatars_tile_2#0']],
      layout: true,
    });
    leftContent.addChild(frame);

    const nameText = new Text({ text: name, style: TEXT_STYLE_TITLE, layout: true });
    middleContent.addChild(nameText);

    const descriptionText = new Text({ text: 'Description', style: TEXT_STYLE_DEFAULT, layout: true });
    middleContent.addChild(descriptionText);

    const crewPowerText = new PrimaryButton('123 Scraps to hire');
    rightContent.addChild(crewPowerText.view!);

    this.addChild(leftContent);
    this.addChild(middleContent);
    this.addChild(rightContent);
  }
}

class CrewPickerPanel {
  public readonly view: LayoutContainer;

  constructor() {
    this.view = new LayoutContainer({
      layout: {
        gap: 10,
        padding: 10,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      },
    });

    const title = new Text({ text: 'Crew Picker', style: TEXT_STYLE_DEFAULT, layout: true });
    this.view.addChild(title);

    const description = new Text({ text: 'Select a crew member to continue', style: TEXT_STYLE_DEFAULT, layout: true });
    this.view.addChild(description);

    const crewMembers = new LayoutContainer({
      layout: {
        gap: 10,
        padding: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
      },
    });

    this.view.addChild(crewMembers);

    const crewMemberBadge = new CrewMemberBadge('John Doe');
    crewMembers.addChild(crewMemberBadge);

    const membersCount = signal(0);

    const countText = new Text({ text: '0/3', style: TEXT_STYLE_DEFAULT, layout: true });

    membersCount.subscribe((count) => {
      countText.text = `${count}/3`;
    });

    this.view.addChild(countText);

    const addMemberButton = new PrimaryButton('Add Member');
    addMemberButton.onPress.connect(() => {
      membersCount.update((count) => count + 1);
      getRunState().scrapsCounter.update((count) => count + 10);
    });

    this.view.addChild(addMemberButton.view!);
  }
}

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

    const closeButton = new PrimaryButton('Close');

    closeButton.onPress.connect(() => {
      // navigation.dismissPopup();
      console.log('Close button pressed');
      context.navigation.dismissCurrentOverlay();
    });

    this._popupBackground.addChild(closeButton.view!);

    this.addChild(this._popupBackground);

    const crewPickerPanel = new CrewPickerPanel();
    this._popupBackground.addChild(crewPickerPanel.view!);

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
