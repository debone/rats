import { MIN_HEIGHT, MIN_WIDTH, TEXT_STYLE_DEFAULT } from '@/consts';
import { execute } from '@/core/game/Command';
import { LAYER_NAMES, type AppScreen } from '@/core/window/types';
import { getGameContext } from '@/data/game-context';
import { LevelSelectedCommand } from '@/systems/app/commands/LevelSelectedCommand';
import { LayoutContainer } from '@pixi/layout/components';
import { Button } from '@pixi/ui';
import { animate } from 'animejs';
import { Container, Graphics, Text } from 'pixi.js';

/**
 * MapScreen - Placeholder for level selection map
 * TODO: Implement actual map UI
 */
export class MapScreen extends Container implements AppScreen {
  static readonly SCREEN_ID = 'map';
  static readonly assetBundles = ['default'];

  constructor() {
    super({
      layout: {
        width: MIN_WIDTH,
        height: MIN_HEIGHT,
        justifyContent: 'center',
        backgroundColor: 'black',
        alignItems: 'center',
        flexDirection: 'column',
        padding: 20,
        gap: 20,
      },
    });
  }

  async prepare() {
    const navigation = getGameContext().navigation;
    navigation.addToLayer(this, LAYER_NAMES.UI);

    const text = new Text({
      text: 'Map Screen (TODO)',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 24 },
      layout: true,
    });
    this.addChild(text);

    const button = new Button(new Graphics({ layout: { width: 100, height: 50 } }).rect(0, 0, 100, 50).fill('red'));
    button.onPress.connect(() => execute(LevelSelectedCommand, { levelId: 'level-1' }));

    this.addChild(button.view!);

    execute(LevelSelectedCommand, { levelId: 'level-1' });
  }

  gameContainer?: LayoutContainer;

  async show(): Promise<void> {
    // INSERT_YOUR_CODE
    // Fade in the gameContainer when the screen is shown using animejs
    this.alpha = 0;
    await animate(this, { alpha: 1, duration: 250, easing: 'easeOutQuad' });
  }

  resize(_w: number, _h: number) {
    // TODO: Implement resize
  }

  reset() {
    console.log('[MapScreen] Resetting...');
    this.children.forEach((child) => child.destroy());
  }
}
