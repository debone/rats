import { getEntitiesOf } from '@/core/entity/scope';
import { NormBall } from '@/gameplay/entities/NormBall';
import { t } from '@/i18n/i18n';
import { type CrewMemberDef } from './Crew';
import { CREW_RARITIES } from './types';

export const FlubCrewMember: CrewMemberDef = {
  type: 'flub',
  name: t.dict['crew.flub.name'],
  textureName: 'avatars-new_tile_11#0',
  hiringCost: 10,
  rarity: CREW_RARITIES.uncommon,
  activeAbility: {
    name: t.dict['crew.flub.active.name'],
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
    name: t.dict['crew.flub.passive.name'],
    mount: (runState) => {
      runState.crewBoons.flub_ballsAttractedToBoat.set(true);
    },
    unmount: (runState) => {
      runState.crewBoons.flub_ballsAttractedToBoat.set(false);
    },
  },
};
