import { TEXT_STYLE_DEFAULT } from '@/consts';
import type { Cleanup, Signal } from '@/core/reactivity/signals/types';
import { LayoutContainer } from '@pixi/layout/components';
import { Sprite, Text, Texture } from 'pixi.js';

export class ItemCounter extends LayoutContainer {
  itemSubscription: Cleanup;

  constructor(texture: Texture, signal: Signal<number>) {
    super();

    this.layout = {
      backgroundColor: 0x272736,
      borderColor: 0x57294b,
      borderWidth: 1,
      borderRadius: 2,
      padding: 5,
      gap: 5,
      minHeight: 20,
      alignItems: 'center',
      minWidth: 64,
    };

    const itemSprite = new Sprite({
      texture,
      scale: 1.5,
    });

    itemSprite.layout = {
      objectFit: 'none',
      width: 16,
      height: 16,
    };

    this.addChild(itemSprite);

    const itemCountText = new Text({
      text: '0',
      style: {
        ...TEXT_STYLE_DEFAULT,
        fontSize: 16,
      },
      layout: {
        marginLeft: 2,
        marginTop: -2,
      },
    });

    this.addChild(itemCountText);

    this.itemSubscription = signal.subscribe((itemCount) => {
      itemCountText.text = itemCount.toString();
    });
  }

  destroy() {
    super.destroy();
    this.itemSubscription();
  }
}
