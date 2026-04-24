import { CREW_RARITIES, type CrewMemberDef } from './Crew';

export const AuraCrewMember: CrewMemberDef = {
  type: 'aura',
  name: 'Aura',
  textureName: 'avatars-new_tile_2#0',
  hiringCost: 10,
  rarity: CREW_RARITIES.rare,
  activeAbility: {
    name: 'Doubles all balls',
    cost: 1,
    effect: () => {
      console.log('Aura ability effect');
    },
  },
  passiveAbility: {
    name: 'Cheese can break bricks',
    effect: () => {
      console.log('Aura ability effect');
    },
  },
};
