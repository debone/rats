import { ASSETS } from '@/assets';
import { MIN_HEIGHT, MIN_WIDTH } from '@/consts';
import { assert } from '@/core/common/assert';
import { createRefs, type RefCountable } from '@/core/reactivity/refs/ref-collection';
import { getGameContext } from '@/data/game-context';
import { getRunState } from '@/data/game-state';
import { LayoutContainer } from '@pixi/layout/components';
import { Assets, Sprite } from 'pixi.js';

export class BallCounter extends LayoutContainer {
  ballsUI: RefCountable;

  constructor(x: number, y: number) {
    super();

    this.x = x;
    this.y = y;

    this.layout = {
      padding: 10,
      flexDirection: 'column',
      alignItems: 'flex-start',
      width: MIN_WIDTH,
      height: MIN_HEIGHT,
      gap: 10,
    };

    const ballsContainer = new LayoutContainer({
      layout: {
        backgroundColor: 0x272736,
        borderColor: 0x57294b,
        borderWidth: 1,
        borderRadius: 2,
        padding: 3,
        width: 128,
        minHeight: 20,
        flexWrap: 'wrap',
      },
    });

    this.addChild(ballsContainer);

    this.ballsUI = createRefs(
      'balls',
      () => {
        const ballSprite = new Sprite(Assets.get(ASSETS.tiles).textures.ball);
        ballSprite.scale.set(0.75, 0.75);
        ballSprite.layout = {
          objectFit: 'cover',
        };
        return ballSprite;
      },
      getRunState().ballsRemaining,
      ballsContainer,
    );
  }
}
