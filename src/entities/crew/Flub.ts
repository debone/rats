import { getEntitiesOfKind } from '@/core/entity/entity';
import type { CrewMemberDef } from './Crew';
import { ENTITY_KINDS } from '../entity-kinds';

export const FlubCrewMember: CrewMemberDef = {
  type: 'flub',
  name: 'Flub',
  textureName: 'avatars-new_tile_11#0',
  hiringCost: 10,
  activeAbility: {
    name: 'Haste active balls',
    cost: 1,
    effect: () => {
      getEntitiesOfKind(ENTITY_KINDS.normBall).forEach((ball) => {
        if (ball.active) {
          ball.baseSpeed = ball.baseSpeed * 1.1;
          ball.sprite.tint = Math.max(0x00ff00, ball.sprite.tint - 0x660066);
        }
      });
    },
  },
  passiveAbility: {
    name: 'Balls are attracted to the boat',
    mount: (runState) => {
      runState.crewBoons.flub_ballsAttractedToBoat.set(true);
    },
    unmount: (runState) => {
      runState.crewBoons.flub_ballsAttractedToBoat.set(false);
    },
  },
};
