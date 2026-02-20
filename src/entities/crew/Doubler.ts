import type { CrewMemberDef } from './Crew';

export const DoublerCrewMember: CrewMemberDef = {
  type: 'doubler',
  name: 'Doubler',
  description: 'double the balls',
  textureName: 'avatars_tile_3#0',
  ability: {
    name: 'Double Up',
    description: 'double the balls',
    cost: 10,
    effect: () => {
      console.log('Doubler ability effect');
    },
  },
};
