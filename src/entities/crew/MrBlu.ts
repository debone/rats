import { getRunState } from '@/data/game-state';
import { t } from '@/i18n/i18n';
import { type CrewMemberDef } from './Crew';
import { CREW_RARITIES } from './types';

export const MrBluCrewMember: CrewMemberDef = {
  type: 'mrblu',
  name: t.dict['crew.mrblu.name'],
  textureName: 'avatars-new_tile_14#0',
  hiringCost: 10,
  rarity: CREW_RARITIES.common,
  activeAbility: {
    name: t.dict['crew.mrblu.active.name'],
    cost: 1,
    effect: () => {
      getRunState().crewBoons.mrblu_nextCheeseIsBlue.set(true);
    },
  },
  passiveAbility: {
    name: t.dict['crew.mrblu.passive.name'],
    mount: (runState) => {
      runState.crewBoons.mrblu_cheeseFloats.set(true);
    },
    unmount: (runState) => {
      runState.crewBoons.mrblu_cheeseFloats.set(false);
    },
  },
};
