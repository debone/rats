import { CREW_RARITIES, type CrewMemberDef } from './Crew';

export const PanteratCrewMember: CrewMemberDef = {
  type: 'panterat',
  name: 'Panterat',
  textureName: 'avatars-new_tile_13#0',
  hiringCost: 10,
  rarity: CREW_RARITIES.uncommon,
  activeAbility: {
    name: 'Strengthen balls',
    cost: 1,
    effect: () => {
      console.log('Panterat ability effect');
    },
  },
  passiveAbility: {
    name: 'Abilities cost 1 less',
    effect: () => {
      console.log('Panterat ability effect');
    },
  },
};
