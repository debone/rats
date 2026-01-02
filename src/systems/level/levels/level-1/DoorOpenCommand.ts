import { ASSETS, type PrototypeTextures } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { Command } from '@/core/game/Command';
import { delay } from '@/core/game/Coroutine';
import { animate } from 'animejs';
import { b2Body_GetPosition, b2Body_SetTransform, b2Rot, b2Vec2, type b2BodyId } from 'phaser-box2d';
import { Sprite } from 'pixi.js';

type DoorOpenCommandResult = {
  doors: b2BodyId[];
};

export class Level_1_DoorOpenCommand extends Command<DoorOpenCommandResult> {
  *execute({ doors }: DoorOpenCommandResult) {
    // Wait for player selection
    // TODO: Replace with actual map screen interaction
    yield delay(300);

    for (const door of doors) {
      // Open the door by applying an impulse or changing its position
      // This is a placeholder; actual implementation may vary
      // For example, you might want to set the door to a "open" state
      const pos = b2Body_GetPosition(door);
      const doorPos = pos.clone();
      const rot = new b2Rot(1, 0);

      animate(doorPos, {
        x: pos.x - 8,
        duration: 500,
        easing: 'easeInOutQuad',
        onUpdate: () => {
          b2Body_SetTransform(door, doorPos, rot);
        },
      });
    }

    /*
    let selection;
    if (this.context.meta.runs % 2 === 0) {
      selection = { levelId: 'level-1' };
    } else {
      selection = { levelId: 'level-2' };
      //selection = yield this.context.events.wait(GameEvent.MAP_LEVEL_SELECTED);
    }

    // const selection = yield this.context.events.wait(GameEvent.MAP_LEVEL_SELECTED);

    // Show game screen and start next level
    yield execute(ShowScreenCommand, { screen: GameScreen });
    this.context.run.currentLevelId = selection.levelId;
    yield execute(LoadLevelCommand, { levelId: selection.levelId });
    */
  }
}
