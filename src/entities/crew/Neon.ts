import type { CrewMemberDef } from './Crew';

export const NeonCrewMember: CrewMemberDef = {
  type: 'neon',
  name: 'Neon',
  textureName: 'avatars-new_tile_8#0',
  hiringCost: 15,
  activeAbility: {
    name: 'Explode balls',
    cost: 2,
    effect: () => {
      console.log('Neon ability effect');
    },
  },
  passiveAbility: {
    name: 'Faster boat',
    mount: (runState) => {
      runState.stats.boatVelocityRatio.update((current) => current * 1.2);
    },
    unmount: (runState) => {
      runState.stats.boatVelocityRatio.update((current) => current / 1.2);
    },
  },
};
