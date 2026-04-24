import { CREW_RARITIES, type CrewMemberDef } from './Crew';

export const NeonCrewMember: CrewMemberDef = {
  type: 'neon',
  name: 'Neon',
  textureName: 'avatars-new_tile_8#0',
  hiringCost: 15,
  rarity: CREW_RARITIES.rare,
  activeAbility: {
    name: 'Explode balls',
    cost: 2,
    effect: () => {
      console.log('Neon ability effect');
    },
  },
  passiveAbility: {
    name: 'Faster boat',
    effect: () => {
      console.log('Neon ability effect');
    },
  },
};
