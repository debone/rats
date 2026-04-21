import type { CrewMemberDef } from './Crew';

export const AuraCrewMember: CrewMemberDef = {
  type: 'aura',
  name: 'Aura',
  textureName: 'avatars-new_tile_2#0',
  hiringCost: 10,
  activeAbility: {
    name: 'Doubles all balls',
    cost: 1,
    effect: () => {
      console.log('Aura ability effect');
    },
  },
  passiveAbility: {
    name: 'Cheese can break bricks',
    mount: (_runState) => {},
    unmount: (_runState) => {},
  },
};
