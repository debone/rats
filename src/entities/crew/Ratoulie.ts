import type { CrewMemberDef } from './Crew';

export const RatoulieCrewMember: CrewMemberDef = {
  type: 'ratoulie',
  name: 'Ratoulie',
  textureName: 'avatars-new_tile_17#0',
  hiringCost: 10,
  activeAbility: {
    name: 'Drop all boat cheese',
    cost: 1,
    effect: () => {
      console.log('Ratoulie ability effect');
    },
  },
  passiveAbility: {
    name: 'Abilities consume balls',
    mount: (_runState) => {},
    unmount: (_runState) => {},
  },
};
