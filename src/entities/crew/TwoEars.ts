import type { CrewMemberDef } from './Crew';

export const TwoEarsCrewMember: CrewMemberDef = {
  type: 'twoears',
  name: 'The Two Ears',
  textureName: 'avatars-new_tile_3#0',
  hiringCost: 10,
  activeAbility: {
    name: 'Destroy random brick',
    cost: 1,
    effect: () => {
      console.log('Two Ears ability effect');
    },
  },
  passiveAbility: {
    name: 'Boat can shoot',
    mount: (_runState) => {},
    unmount: (_runState) => {},
  },
};
