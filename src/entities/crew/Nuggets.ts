import type { CrewMemberDef } from './Crew';

export const NuggetsCrewMember: CrewMemberDef = {
  type: 'nuggets',
  name: 'Nuggets',
  textureName: 'avatars-new_tile_6#0',

  hiringCost: 6,

  activeAbility: {
    name: 'Next ability use is free',
    cost: 0,
    effect: () => {
      console.log('Nuggets ability effect');
    },
  },
  passiveAbility: {
    name: 'Slower boat',
    effect: () => {
      console.log('Nuggets ability effect');
    },
  },
};
