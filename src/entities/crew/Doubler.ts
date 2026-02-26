import type { CrewMemberDef } from './Crew';

export const DoublerCrewMember: CrewMemberDef = {
  type: 'doubler',
  name: 'Doub Doub',
  description: "It's all cheese magic",
  textureName: 'avatars_tile_3#0',

  hiringCost: 25,

  ability: {
    name: 'Double balls',
    description: 'All existing balls get duplicated',
    cost: 3,
    effect: () => {
      console.log('Doubler ability effect');
    },
  },
};
