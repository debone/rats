import { CREW_RARITIES, type CrewMemberDef } from './Crew';

export const RatoulieCrewMember: CrewMemberDef = {
  type: 'ratoulie',
  name: 'Ratoulie',
  textureName: 'avatars-new_tile_17#0',
  hiringCost: 10,
  rarity: CREW_RARITIES.common,
  activeAbility: {
    name: 'Drop all boat cheese',
    cost: 1,
    effect: () => {
      console.log('Ratoulie ability effect');
    },
  },
  passiveAbility: {
    name: 'Abilities consume balls',
    effect: () => {
      console.log('Ratoulie ability effect');
    },
  },
};
