import type { CrewMemberDef } from './Crew';

export const LittleMiCrewMember: CrewMemberDef = {
  type: 'littlemi',
  name: 'Little Mi',
  textureName: 'avatars-new_tile_15#0',
  hiringCost: 10,
  activeAbility: {
    name: 'Everything floats (15s)',
    cost: 1,
    effect: () => {
      console.log('Little Mi ability effect');
    },
  },
  passiveAbility: {
    name: 'Longer boat',
    effect: () => {
      console.log('Little Mi ability effect');
    },
  },
};
