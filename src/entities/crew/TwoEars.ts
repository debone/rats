import { GameEvent } from '@/data/events';
import { t } from '@/i18n/i18n';
import { type CrewMemberDef } from './Crew';
import { CREW_RARITIES } from './types';

export const TwoEarsCrewMember: CrewMemberDef = {
  type: 'twoears',
  name: t.dict['crew.twoears.name'],
  textureName: 'avatars-new_tile_3#0',
  hiringCost: 10,
  rarity: CREW_RARITIES.common,
  activeAbility: {
    name: t.dict['crew.twoears.active.name'],
    cost: 1,
    effect: (_runState, context) => {
      context.events.emit(GameEvent.CREW_SHOOT_CHEESE);
    },
  },
  passiveAbility: {
    name: t.dict['crew.twoears.passive.name'],
    mount: (runState) => {
      runState.crewBoons.twoears_doubleCheese.set(true);
    },
    unmount: (runState) => {
      runState.crewBoons.twoears_doubleCheese.set(false);
    },
  },
};
