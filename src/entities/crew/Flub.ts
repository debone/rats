import { getEntitiesOf } from '@/core/entity/entity';
import type { CrewMemberDef } from './Crew';
import { NormBall } from '@/systems/level/levels/entities/NormBall';

export const FlubCrewMember: CrewMemberDef = {
  type: 'flub',
  name: 'Flub',
  textureName: 'avatars-new_tile_11#0',
  hiringCost: 10,
  activeAbility: {
    name: 'Haste active balls',
    cost: 1,
    effect: () => {
      getEntitiesOf(NormBall).forEach((ball) => {
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
