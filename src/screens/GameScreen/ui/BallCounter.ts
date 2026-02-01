import { ASSETS } from '@/assets';
import { createRefs, type RefCountable, type Strategy } from '@/core/reactivity/refs/ref-collection';
import { getRunState } from '@/data/game-state';
import { LayoutContainer } from '@pixi/layout/components';
import { animate } from 'animejs';
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

    const ballStrategy: Strategy = (parent, { adds, removes, moves }) => {
      // Animate removes out (parallel, staggered)
      removes.reverse().forEach(({ element }, i) => {
        animate(element, { alpha: 0, y: '+=20', duration: 200, delay: i * 30 }).then(() => element.destroy());
      });

      // Animate adds in (parallel, staggered, after removes)
      const removeTime = removes.length * 30 + 200;
      parent.addChild(...adds.map(({ element }) => element));
      adds.forEach(({ element }, i) => {
        element.alpha = 0;
        animate(element, { alpha: 1, duration: 200, delay: removeTime + i * 30 });
      });

      // Animate moves
      moves.forEach(({ element, to }) => {
        const targetX = to * 16;
        animate(element, { x: targetX, duration: 300 });
      });
    };

    this.ballsUI = createRefs({
      path: 'balls',
      template: () => {
        const ballSprite = new Sprite(Assets.get(ASSETS.tiles).textures.ball);
        ballSprite.scale.set(0.75, 0.75);
        ballSprite.layout = {
          objectFit: 'cover',
        };
        return ballSprite;
      },
      size: getRunState().ballsRemaining,
      parent: this,
      strategy: ballStrategy,
    });
  }

  destroy() {
    super.destroy();
    this.ballsUI.destroy();
  }
}
