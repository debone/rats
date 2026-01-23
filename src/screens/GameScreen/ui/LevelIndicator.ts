import type { Cleanup } from '@/core/reactivity/signals/types';
import { getLevelState } from '@/data/game-state';
import { LayoutContainer } from '@pixi/layout/components';
import { Text } from 'pixi.js';

export class LevelIndicator extends LayoutContainer {
  constructor() {
    super();

    this.layout = {
      width: 128,
      flexWrap: 'wrap',
    };

    const levelNameText = new Text({
      text: 'Level 1',
      style: {
        fontSize: 12,
        fontFamily: 'Georgia',
        fill: 0xffffff,
      },
      layout: true,
    });

    this.addChild(levelNameText);

    this.levelNameSubscription = getLevelState().levelName.subscribe((levelName) => {
      levelNameText.text = levelName;
    });
  }

  private levelNameSubscription: Cleanup;

  destroy(...args: any[]) {
    super.destroy(...args);
    this.levelNameSubscription();
  }
}
