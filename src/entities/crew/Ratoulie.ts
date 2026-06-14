import { GameEvent } from '@/data/events';
import { t } from '@/i18n/i18n';
import { type CrewMemberDef } from './Crew';
import { CREW_RARITIES } from './types';

export const RatoulieCrewMember: CrewMemberDef = {
  type: 'ratoulie',
  name: t.dict['crew.ratoulie.name'],
  textureName: 'avatars-new_tile_17#0',
  hiringCost: 10,
  rarity: CREW_RARITIES.common,
  activeAbility: {
    name: t.dict['crew.ratoulie.active.name'],
    cost: 1,
    effect: (_runState, context) => {
      context.events.emit(GameEvent.CREW_DROP_ALL_BOAT_CHEESE);
    },
  },
  passiveAbility: {
    name: t.dict['crew.ratoulie.passive.name'],
    mount: (runState) => {
      runState.crewBoons.ratoulie_abilitiesConsumeBalls.set(true);
    },
    unmount: (runState) => {
      runState.crewBoons.ratoulie_abilitiesConsumeBalls.set(false);
    },
  },
};
