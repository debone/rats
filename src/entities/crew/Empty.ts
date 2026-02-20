import type { CrewMemberDef } from './Crew';

export const EmptyCrewMember: CrewMemberDef = {
  type: 'empty',
  name: 'Empty',
  description: 'no ability',
  textureName: 'avatars_tile_1#0',
  ability: {
    name: 'No Ability',
    description: 'no ability',
    cost: 0,
    effect: () => {
      console.log('Empty ability effect');
    },
  },
};
