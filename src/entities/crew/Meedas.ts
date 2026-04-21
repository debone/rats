import { ASSETS } from '@/assets';
import { sfx } from '@/core/audio/audio';
import { getEntitiesOfKind } from '@/core/entity/entity';
import { changeCheese } from '@/data/game-state';
import { ENTITY_KINDS } from '@/entities/entity-kinds';
import { Cheese } from '@/systems/level/levels/entities/Cheese';
import { b2Body_GetPosition } from 'phaser-box2d';
import type { CrewMemberDef } from './Crew';

export const MeedasCrewMember: CrewMemberDef = {
  type: 'meedas',
  name: 'Meedas',
  textureName: 'avatars-new_tile_12#0',
  hiringCost: 10,
  activeAbility: {
    name: 'Rubble becomes cheese',
    cost: 1,
    effect: () => {
      sfx.play(ASSETS.sounds_Sell_Building_A, { volume: 0.5 });
      const scraps = getEntitiesOfKind(ENTITY_KINDS.scrap);
      scraps.forEach((scrap) => {
        const pos = b2Body_GetPosition(scrap.bodyId);
        scrap.destroy();
        Cheese({ pos: { x: pos.x, y: pos.y }, type: 'yellow', onCollected: () => changeCheese(1) });
      });
    },
  },
  passiveAbility: {
    name: 'Balls float',
    mount: (runState) => {
      runState.stats.ballSpeedRatio.update((v) => v * 0.65);
    },
    unmount: (runState) => {
      runState.stats.ballSpeedRatio.update((v) => v / 0.65);
    },
  },
};
