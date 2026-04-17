import type { CrewMemberDef } from './Crew';

export const AresCapCrewMember: CrewMemberDef = {
  type: 'arescap',
  name: "Yer' Ares Cap",
  textureName: 'avatars-new_tile_19#0',
  hiringCost: 10,
  activeAbility: {
    name: 'Transforms 1 ball into 1 cheese',
    cost: 1,
    effect: () => {
      console.log('Ares Cap ability effect');
    },
  },
  passiveAbility: {
    name: 'Balls cause 2 damage',
    effect: () => {
      console.log('Ares Cap ability effect');
    },
  },
};
