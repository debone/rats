import { t } from '@/i18n/i18n';
import type { CrewMemberDef } from './Crew';

export const MicesiveCrewMember: CrewMemberDef = {
  type: 'micesive',
  name: t.dict['crew.micesive.name'],
  textureName: 'avatars-new_tile_16#0',
  hiringCost: 10,
  activeAbility: {
    name: t.dict['crew.micesive.active.name'],
    cost: 1,
    effect: (runState) => {
      runState.crewBoons.micesive_nextBricksHaveMoreRubbles.set(5);
    },
  },
  passiveAbility: {
    name: t.dict['crew.micesive.passive.name'],
    mount: (runState) => {
      runState.crewBoons.micesive_cheeseGivesBalls.set(true);
    },
    unmount: (runState) => {
      runState.crewBoons.micesive_cheeseGivesBalls.set(false);
    },
  },
};
