import type { CrewMemberDef } from './Crew';

export const SplitterCrewMember: CrewMemberDef = {
  type: 'splitter',
  name: 'Splitter',
  textureName: 'avatars-new_tile_5#0',
  hiringCost: 10,
  activeAbility: {
    name: 'Double balls',
    cost: 1,
    effect: () => {
      console.log('Splitter ability effect');
    },
  },
  passiveAbility: {
    name: '+2 cheese storage',
    mount: (_runState) => {},
    unmount: (_runState) => {},
  },
};
