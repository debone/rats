import { GameEvent } from '@/data/events';
import { t } from '@/i18n/i18n';
import type { CrewMemberDef } from './Crew';

export const MeedasCrewMember: CrewMemberDef = {
  type: 'meedas',
  name: t.dict['crew.meedas.name'],
  textureName: 'avatars-new_tile_12#0',
  hiringCost: 10,
  activeAbility: {
    name: t.dict['crew.meedas.active.name'],
    cost: 1,
    effect: (_runState, context) => {
      context.events.emit(GameEvent.CREW_RUBBLE_BECOMES_CHEESE);
    },
  },
  passiveAbility: {
    name: t.dict['crew.meedas.passive.name'],
    mount: (runState) => {
      runState.crewBoons.meedas_ballsBounceWater.set(true);
    },
    unmount: (runState) => {
      runState.crewBoons.meedas_ballsBounceWater.set(false);
    },
  },
};
