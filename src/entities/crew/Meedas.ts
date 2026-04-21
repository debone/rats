import type { CrewMemberDef } from './Crew';

export const MeedasCrewMember: CrewMemberDef = {
  type: 'meedas',
  name: 'Meedas',
  textureName: 'avatars-new_tile_12#0',
  hiringCost: 10,
  activeAbility: {
    name: 'Rubble becomes cheese',
    cost: 1,
    effect: () => {
      console.log('Meedas ability effect');
    },
  },
  passiveAbility: {
    name: 'Balls float',
    effect: () => {
      console.log('Meedas ability effect');
    },
  },
};
