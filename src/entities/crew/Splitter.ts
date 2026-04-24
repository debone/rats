import { CREW_RARITIES, type CrewMemberDef } from './Crew';

export const SplitterCrewMember: CrewMemberDef = {
  type: 'splitter',
  name: 'Splitter',
  textureName: 'avatars-new_tile_5#0',
  hiringCost: 10,
  rarity: CREW_RARITIES.rare,
  activeAbility: {
    name: 'Double balls',
    cost: 1,
    effect: () => {
      console.log('Splitter ability effect');
    },
  },
  passiveAbility: {
    name: '+2 cheese storage',
    effect: () => {
      console.log('Splitter ability effect');
    },
  },
};
