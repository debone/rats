import { CREW_RARITIES, type CrewMemberDef } from './Crew';

export const FlubCrewMember: CrewMemberDef = {
  type: 'flub',
  name: 'Flub',
  textureName: 'avatars-new_tile_11#0',
  hiringCost: 10,
  rarity: CREW_RARITIES.uncommon,
  activeAbility: {
    name: 'Haste balls',
    cost: 1,
    effect: () => {
      console.log('Flub ability effect');
    },
  },
  passiveAbility: {
    name: 'Balls are attracted to the boat',
    effect: () => {
      console.log('Flub ability effect');
    },
  },
};
