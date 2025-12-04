import type { AppScreen } from '@/core/window/types';
import { Container, Text } from 'pixi.js';

/**
 * MapScreen - Placeholder for level selection map
 * TODO: Implement actual map UI
 */
export class MapScreen extends Container implements AppScreen {
  static readonly SCREEN_ID = 'map';
  static readonly assetBundles = ['default'];

  constructor() {
    super();

    const text = new Text({
      text: 'Map Screen (TODO)',
      style: { fontSize: 24, fill: 0xffffff },
    });
    text.x = 100;
    text.y = 100;
    this.addChild(text);
  }

  resize(_w: number, _h: number) {
    // TODO: Implement resize
  }
}
