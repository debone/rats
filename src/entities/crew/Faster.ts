import type { CrewMemberDef } from './Crew';

export const FasterCrewMember: CrewMemberDef = {
  type: 'faster',
  name: 'Faster',
  description: 'balls go brrr',
  textureName: 'avatars_tile_2#0',
  ability: {
    name: 'Faster',
    description: 'balls go brrr',
    cost: 10,
    effect: () => {
      console.log('Faster ability effect');
    },
  },
};
