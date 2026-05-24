import { GameEvent } from '@/data/events';
import { t } from '@/i18n/i18n';
import type { CrewMemberDef } from './Crew';

export const RatoulieCrewMember: CrewMemberDef = {
  type: 'ratoulie',
  name: t.f('crew.ratoulie.name'),
  textureName: 'avatars-new_tile_17#0',
  hiringCost: 10,
  activeAbility: {
    name: t.f('crew.ratoulie.active.name'),
    cost: 1,
    effect: (_runState, context) => {
      context.events.emit(GameEvent.CREW_DROP_ALL_BOAT_CHEESE);
    },
  },
  passiveAbility: {
    name: t.f('crew.ratoulie.passive.name'),
    mount: (runState) => {
      runState.crewBoons.ratoulie_abilitiesConsumeBalls.set(true);
    },
    unmount: (runState) => {
      runState.crewBoons.ratoulie_abilitiesConsumeBalls.set(false);
    },
  },
};
