import { t } from '@/i18n/i18n';
import type { CrewMemberDef } from './Crew';

export const NuggetsCrewMember: CrewMemberDef = {
  type: 'nuggets',
  name: t.f('crew.nuggets.name'),
  textureName: 'avatars-new_tile_6#0',

  hiringCost: 6,

  activeAbility: {
    name: t.f('crew.nuggets.active.name'),
    cost: 1,
    effect: (runState) => {
      runState.crewBoons.nuggets_nextAbilityFree.set(true);
    },
  },
  passiveAbility: {
    name: t.f('crew.nuggets.passive.name'),
    mount: (runState) => {
      runState.stats.boatVelocityRatio.update((current) => current * 0.8);
    },
    unmount: (runState) => {
      runState.stats.boatVelocityRatio.update((current) => current / 0.8);
    },
  },
};
