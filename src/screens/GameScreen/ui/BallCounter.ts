import { ASSETS } from '@/assets';
import { createRefs, type RefCountable } from '@/core/reactivity/refs/ref-collection';
import { getRunState } from '@/data/game-state';
import { LayoutContainer } from '@pixi/layout/components';
import { Assets, Sprite } from 'pixi.js';

export class BallCounter extends LayoutContainer {
  ballsUI: RefCountable;

  constructor() {
    super();

    this.layout = {
      backgroundColor: 0x272736,
      borderColor: 0x57294b,
      borderWidth: 1,
      borderRadius: 2,
      padding: 3,
      width: 128,
      minHeight: 20,
      flexWrap: 'wrap',
    };

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
      this,
    );
  }
}
