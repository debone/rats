import { getEntitiesOfKind } from '@/core/entity/entity';
import { ENTITY_KINDS } from '@/entities/entity-kinds';
import type { CrewMemberDef } from './Crew';

export const TwoEarsCrewMember: CrewMemberDef = {
  type: 'twoears',
  name: 'The Two Ears',
  textureName: 'avatars-new_tile_3#0',
  hiringCost: 10,
  activeAbility: {
    name: 'Destroy random brick',
    cost: 1,
    effect: () => {
      const bricks = getEntitiesOfKind(ENTITY_KINDS.brick);
      if (bricks.length === 0) return;
      const target = bricks[Math.floor(Math.random() * bricks.length)];
      target.hit();
    },
  },
  passiveAbility: {
    name: 'Boat can shoot',
    mount: (_runState) => {},
    unmount: (_runState) => {},
  },
};
