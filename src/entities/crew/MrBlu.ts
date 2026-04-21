import { ASSETS } from '@/assets';
import { sfx } from '@/core/audio/audio';
import type { CrewMemberDef } from './Crew';

export const MrBluCrewMember: CrewMemberDef = {
  type: 'mrblu',
  name: 'Mr. Blu',
  textureName: 'avatars-new_tile_14#0',
  hiringCost: 10,
  activeAbility: {
    name: 'Next cheese is blue',
    cost: 1,
    effect: (runState) => {
      sfx.play(ASSETS.sounds_Sell_Building_A, { volume: 0.5 });
      runState.crewBoons.mrblu_nextCheeseIsBlue.set(true);
    },
  },
  passiveAbility: {
    name: 'Cheese floats',
    mount: (runState) => {
      runState.crewBoons.mrblu_cheeseFloats.set(true);
    },
    unmount: (runState) => {
      runState.crewBoons.mrblu_cheeseFloats.set(false);
    },
  },
};
