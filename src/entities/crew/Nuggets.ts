import { sfx } from '@/core/audio/audio';
import { ASSETS } from '@/assets';
import type { CrewMemberDef } from './Crew';

export const NuggetsCrewMember: CrewMemberDef = {
  type: 'nuggets',
  name: 'Nuggets',
  textureName: 'avatars-new_tile_6#0',

  hiringCost: 6,

  activeAbility: {
    name: 'Next ability use is free',
    cost: 1,
    effect: (runState) => {
      sfx.play(ASSETS.sounds_Rat_Squeak_A, { volume: 0.5 });
      runState.crewBoons.nuggets_nextAbilityFree.set(true);
    },
  },
  passiveAbility: {
    name: 'Slower boat',
    mount: (runState) => {
      runState.stats.boatVelocityRatio.update((current) => current * 0.8);
    },
    unmount: (runState) => {
      runState.stats.boatVelocityRatio.update((current) => current / 0.8);
    },
  },
};
