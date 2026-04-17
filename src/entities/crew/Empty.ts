import type { CrewMemberDef } from './Crew';

export const EmptyCrewMember: CrewMemberDef = {
  type: 'empty',
  name: 'Empty',
  description: 'no ability',
  textureName: 'avatars-new_tile_1#0',

  hiringCost: 0,

  activeAbility: {
    name: 'No Ability',
    cost: 0,
    effect: () => {
      console.log('Empty ability effect');
    },
  },

  passiveAbility: {
    name: 'No Ability',
    effect: () => {
      console.log('Empty ability effect');
    },
  },
};
