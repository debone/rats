import { MIN_HEIGHT, MIN_WIDTH } from '@/consts';
import { execute } from '@/core/game/Command';
import type { AppScreen } from '@/core/window/types';
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
    super();

    this.layout = {
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'column',
    };

    // Game container (black box for the game area)
    const gameContainer = new LayoutContainer({
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

    this.addChild(gameContainer);
    this.gameContainer = gameContainer;
    const text = new Text({
      text: 'Map Screen (TODO)',
      style: { fontSize: 24, fill: 'pink' },
      layout: {},
    });
    gameContainer.addChild(text);

    const button = new Button(new Graphics({ layout: { width: 100, height: 50 } }).rect(0, 0, 100, 50).fill('red'));
    button.onPress.connect(() => execute(LevelSelectedCommand, { levelId: 'level-1' }));

    gameContainer.addChild(button.view!);

    execute(LevelSelectedCommand, { levelId: 'level-1' });
  }

  gameContainer: LayoutContainer;

  async show(): Promise<void> {
    // INSERT_YOUR_CODE
    // Fade in the gameContainer when the screen is shown using animejs
    if (this.gameContainer) {
      this.gameContainer.alpha = 0;
      await animate(this.gameContainer, { alpha: 1, duration: 250, easing: 'easeOutQuad' });
    }
  }

  resize(_w: number, _h: number) {
    // TODO: Implement resize
  }

  reset() {
    console.log('[MapScreen] Resetting...');
    this.gameContainer.removeChildren();
    this.gameContainer.destroy({ children: true });
  }
}
