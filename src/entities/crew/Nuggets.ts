import { CREW_RARITIES, type CrewMemberDef } from './Crew';

export const NuggetsCrewMember: CrewMemberDef = {
  type: 'nuggets',
  name: 'Nuggets',
  textureName: 'avatars-new_tile_6#0',

  hiringCost: 6,
  rarity: CREW_RARITIES.common,

  activeAbility: {
    name: 'Next ability use is free',
    cost: 1,
    effect: (runState) => {
      runState.crewBoons.nuggets_nextAbilityFree.set(true);
    },
  },
  passiveAbility: {
    name: 'Slower boat',
    mount: (runState) => {
      runState.stats.boatVelocityRatio.update((current) => current * 0.8);
    },
    unmount: (runState) => {
      runState.stats.boatVelocityRatio.update((current) => current / 0.8);
    },
  },
};
