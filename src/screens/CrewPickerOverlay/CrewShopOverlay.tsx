import { disposeContext, provideContext } from '@/core/reactivity/context';
import { createHoverIntent } from '@/core/reactivity/hover-intent';
import { signal } from '@/core/reactivity/signals/signals';
import { LAYER_NAMES, type AppScreen } from '@/core/window/types';
import { getGameContext } from '@/data/game-context';
import { LevelSystem } from '@/systems/level/system';
import { PhysicsSystem } from '@/systems/physics/system';
import { LayoutContainer } from '@pixi/layout/components';
import { animate } from 'animejs';
import { DropShadowFilter } from 'pixi-filters';
import { Color, Container, Graphics, Ticker } from 'pixi.js';
import { CREW_PICKER_CTX, type HoveredCrewMember } from './context';
import { ShopSection } from './sections/ShopSection';

/**
 * Minimal overlay: shop only. After the player successfully hires one crew member, the overlay
 * dismisses and the level resumes.
 */
export class CrewShopOverlay extends Container implements AppScreen {
  static readonly SCREEN_ID = 'crew-shop';
  static readonly assetBundles = ['default'];
  readonly SCREEN_ID = 'crew-shop';

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
    const gameContext = getGameContext();
    const physicsSystem = gameContext.systems.get(PhysicsSystem);
    const levelSystem = gameContext.systems.get(LevelSystem);

    physicsSystem.stop();
    levelSystem.stop();

    disposeContext(CREW_PICKER_CTX);
    const hoveredMember = signal<HoveredCrewMember | null>(null);
    provideContext(CREW_PICKER_CTX, {
      hoveredMember,
      hoverIntent: createHoverIntent(hoveredMember),
    });

    const resumeLevel = () => {
      gameContext.navigation.dismissCurrentOverlay();
      setTimeout(() => {
        physicsSystem.rampUp();
        levelSystem.start();
      }, 500);
    };

    <mount target={this._popupBackground}>
      <ShopSection onPicked={resumeLevel} />
    </mount>;

    this.addChild(this._popupBackground);
    gameContext.navigation.addToLayer(this, LAYER_NAMES.POPUP);
  }

  async show() {
    await animate(this._popupBackground, { alpha: 1, duration: 500 });
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
    for (let i = this.children.length - 1; i >= 0; i--) {
      this.children[i].destroy({ children: true });
    }

    disposeContext(CREW_PICKER_CTX);
  }
}
