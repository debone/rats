import type { CrewMemberDef } from './Crew';

export const MrBluCrewMember: CrewMemberDef = {
  type: 'mrblu',
  name: 'Mr. Blu',
  textureName: 'avatars-new_tile_14#0',
  hiringCost: 10,
  activeAbility: {
    name: 'Next cheese is blue',
    cost: 1,
    effect: () => {
      console.log('Mr. Blu ability effect');
    },
  },
  passiveAbility: {
    name: 'Cheese floats',
    effect: () => {
      console.log('Mr. Blu ability effect');
    },
  },
};
