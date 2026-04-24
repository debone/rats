import { CREW_RARITIES, type CrewMemberDef } from './Crew';

export const PiRatCrewMember: CrewMemberDef = {
  type: 'pirat',
  name: 'Pi Rat',
  textureName: 'avatars-new_tile_18#0',
  hiringCost: 10,
  rarity: CREW_RARITIES.common,
  activeAbility: {
    name: 'Adds ball',
    cost: 1,
    effect: () => {
      console.log('Pi Rat ability effect');
    },
  },
  passiveAbility: {
    name: 'Boat is immobilized',
    effect: () => {
      console.log('Pi Rat ability effect');
    },
  },
};
