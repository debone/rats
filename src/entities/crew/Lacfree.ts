import { t } from '@/i18n/i18n';
import type { CrewMemberDef } from './Crew';

export const LacfreeCrewMember: CrewMemberDef = {
  type: 'lacfree',
  name: t.f('crew.lacfree.name'),
  textureName: 'avatars-new_tile_9#0',
  hiringCost: 12,
  activeAbility: {
    name: t.f('crew.lacfree.active.name'),
    cost: 1,
    effect: (runState) => {
      runState.crewBoons.lacfree_nextBricksHaveCheese.set(5);
    },
  },
  passiveAbility: {
    name: t.f('crew.lacfree.passive.name'),
    mount: (runState) => {
      runState.crewBoons.lacfree_abilitiesConsumeRubbles.set(true);
    },
    unmount: (runState) => {
      runState.crewBoons.lacfree_abilitiesConsumeRubbles.set(false);
    },
  },
};
