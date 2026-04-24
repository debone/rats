import { CREW_RARITIES, type CrewMemberDef } from './Crew';

export const RatfatherCrewMember: CrewMemberDef = {
  type: 'ratfather',
  name: 'Ratfather',
  textureName: 'avatars-new_tile_4#0',
  hiringCost: 10,
  rarity: CREW_RARITIES.common,
  activeAbility: {
    name: 'Ghost balls (2s)',
    cost: 1,
    effect: () => {
      console.log('Ratfather ability effect');
    },
  },
  passiveAbility: {
    name: 'Bricks give more cheese',
    effect: () => {
      console.log('Ratfather ability effect');
    },
  },
};
