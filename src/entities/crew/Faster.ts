import type { CrewMemberDef } from './Crew';

export const FasterCrewMember: CrewMemberDef = {
  type: 'faster',
  name: 'Meowster',
  description: 'Some rats can send, fast.',
  textureName: 'avatars_tile_2#0',

  hiringCost: 8,

  ability: {
    name: 'Faster balls',
    description: 'Existing balls go brrr',
    cost: 1,
    effect: () => {
      console.log('Faster ability effect');
    },
  },
};
