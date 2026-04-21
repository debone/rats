import type { CrewMemberDef } from './Crew';

export const MyszCrewMember: CrewMemberDef = {
  type: 'mysz',
  name: 'Mysz',
  textureName: 'avatars-new_tile_10#0',
  hiringCost: 10,
  activeAbility: {
    name: 'Recall balls',
    cost: 1,
    effect: () => {
      console.log('Mysz ability effect');
    },
  },
  passiveAbility: {
    name: 'Balls stick to boat',
    mount: (_runState) => {},
    unmount: (_runState) => {},
  },
};
