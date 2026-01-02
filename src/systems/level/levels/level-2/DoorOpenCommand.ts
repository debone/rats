import { Command } from '@/core/game/Command';
import { delay } from '@/core/game/Coroutine';
import { animate } from 'animejs';
import { b2Body_GetPosition, b2Body_SetTransform, b2Rot, type b2BodyId } from 'phaser-box2d';

type DoorOpenCommandResult = {
  doors: b2BodyId[];
};

export class Level_2_DoorOpenCommand extends Command<DoorOpenCommandResult> {
  *execute({ doors }: DoorOpenCommandResult) {
    yield delay(300);

    for (const door of doors) {
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
  }
}
