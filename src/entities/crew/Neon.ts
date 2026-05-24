import { GameEvent } from '@/data/events';
import { t } from '@/i18n/i18n';
import type { CrewMemberDef } from './Crew';

export const NeonCrewMember: CrewMemberDef = {
  type: 'neon',
  name: t.f('crew.neon.name'),
  textureName: 'avatars-new_tile_8#0',
  hiringCost: 15,
  activeAbility: {
    name: t.f('crew.neon.active.name'),
    cost: 2,
    effect: (_runState, context) => {
      context.events.emit(GameEvent.CREW_EXPLODE_BALLS);
    },
  },
  passiveAbility: {
    name: t.f('crew.neon.passive.name'),
    mount: (runState) => {
      runState.stats.boatVelocityRatio.update((v) => v * 1.25);
    },
    unmount: (runState) => {
      runState.stats.boatVelocityRatio.update((v) => v / 1.25);
    },
  },
};
