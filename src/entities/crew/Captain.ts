import type { CrewMemberDef } from './Crew';

export const CaptainCrewMember: CrewMemberDef = {
  type: 'captain',
  name: 'Captain',
  description: 'ship is faster',
  textureName: 'avatars_tile_4#0',
  ability: {
    name: 'Speed Up',
    description: 'ship is faster',
    cost: 1,
    effect: () => {
      console.log('Captain ability effect');
    },
  },
};
