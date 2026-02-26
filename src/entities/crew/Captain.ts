import type { CrewMemberDef } from './Crew';

export const CaptainCrewMember: CrewMemberDef = {
  type: 'captain',
  name: 'Rattain',
  description: 'A leading rat',
  textureName: 'avatars_tile_4#0',

  hiringCost: 12,

  ability: {
    name: 'Speed Up',
    description: 'The ship will move faster',
    cost: 2,
    effect: () => {
      console.log('Captain ability effect');
    },
  },
};
