import type { CrewMemberDef } from './Crew';

export const ApprenticeCrewMember: CrewMemberDef = {
  type: 'apprentice',
  name: 'Apprentice',
  textureName: 'avatars-new_tile_7#0',
  hiringCost: 10,
  activeAbility: {
    name: 'Shoots new ball',
    cost: 1,
    effect: () => {
      console.log('Apprentice ability effect');
    },
  },
  passiveAbility: {
    name: 'Slower balls',
    effect: () => {
      console.log('Apprentice ability effect');
    },
  },
};
