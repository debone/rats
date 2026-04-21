import type { CrewMemberDef } from './Crew';

export const MicesiveCrewMember: CrewMemberDef = {
  type: 'micesive',
  name: 'Micesive',
  textureName: 'avatars-new_tile_16#0',
  hiringCost: 10,
  activeAbility: {
    name: 'Next 5 bricks have 5 rubbles',
    cost: 1,
    effect: () => {
      console.log('Micesive ability effect');
    },
  },
  passiveAbility: {
    name: 'Cheese gives +1 ball',
    effect: () => {
      console.log('Micesive ability effect');
    },
  },
};
