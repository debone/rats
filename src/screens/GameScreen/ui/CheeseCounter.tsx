import { ASSETS, type PrototypeTextures } from '@/assets';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { typedAssets } from '@/core/assets/typed-assets';
import { type RefCountable, type Strategy, createRefs } from '@/core/reactivity/refs/ref-collection';
import type { Cleanup } from '@/core/reactivity/signals/types';
import { getRunState } from '@/data/game-state';
import { LayoutContainer } from '@pixi/layout/components';
import { animate } from 'animejs';
import { Sprite, Text } from 'pixi.js';

export class CheeseCounter extends LayoutContainer {
  cheeseCounter: RefCountable;

  constructor() {
    super();

    this.layout = {
      backgroundColor: 0x272736,
      borderColor: 0x57294b,
      borderWidth: 1,
      borderRadius: 2,
      padding: 5,
      width: 132,
      minHeight: 42,
    };

    let cheeseBox!: LayoutContainer;

    const cheeseTexture = typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures['cheese_tile_1#0'];

    <mount target={this}>
      <box
        layout={{
          padding: 5,
          gap: 2,
          position: 'absolute',
          top: 5,
          left: 5,
        }}
      >
        <sprite texture={cheeseTexture} scale={1.25} layout={{ objectFit: 'cover' }} tint={0x666666} />
        <sprite texture={cheeseTexture} scale={1.25} layout={{ objectFit: 'cover' }} tint={0x666666} />
        <sprite texture={cheeseTexture} scale={1.25} layout={{ objectFit: 'cover' }} tint={0x666666} />
        <sprite texture={cheeseTexture} scale={1.25} layout={{ objectFit: 'cover' }} tint={0x666666} />
        <sprite texture={cheeseTexture} scale={1.25} layout={{ objectFit: 'cover' }} tint={0x666666} />
      </box>
      <box
        layout={{
          padding: 5,
          width: 128,
          gap: 2,
        }}
        ref={(ref) => (cheeseBox = ref)}
      ></box>
    </mount>;

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

    this.cheeseCounter = createRefs({
      path: 'cheese',
      template: () => {
        const ballSprite = new Sprite(typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures['cheese_tile_1#0']);
        ballSprite.scale.set(1.25, 1.25);
        ballSprite.layout = {
          objectFit: 'cover',
        };
        return ballSprite;
      },
      size: getRunState().cheeseCounter,
      parent: cheeseBox,
      strategy: ballStrategy,
    });
  }

  destroy() {
    super.destroy();
    this.cheeseCounter.destroy();
  }
}
export class CheeseCounter2 extends LayoutContainer {
  cheeseSubscription: Cleanup;

  constructor() {
    super();

    this.layout = {
      backgroundColor: 0x272736,
      borderColor: 0x57294b,
      borderWidth: 1,
      borderRadius: 2,
      padding: 5,
      gap: 5,
      minHeight: 20,
      alignItems: 'baseline',
      minWidth: 48,
    };

    const cheeseSprite = new Sprite({
      texture: typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures['cheese_tile_1#0'],
    });

    cheeseSprite.layout = {
      objectFit: 'none',
      width: 16,
      height: 16,
    };

    this.addChild(cheeseSprite);

    const cheeseCountText = new Text({
      text: '0',
      style: {
        ...TEXT_STYLE_DEFAULT,
        fontSize: 16,
      },
      layout: true,
    });

    this.addChild(cheeseCountText);

    this.cheeseSubscription = getRunState().cheeseCounter.subscribe((cheeseCount) => {
      cheeseCountText.text = cheeseCount.toString();
    });
  }

  destroy() {
    super.destroy();
    this.cheeseSubscription();
  }
}
