import { GameEvent } from '@/data/events';
import { t } from '@/i18n/i18n';
import type { CrewMemberDef } from './Crew';

export const MyszCrewMember: CrewMemberDef = {
  type: 'mysz',
  name: t.f('crew.mysz.name'),
  textureName: 'avatars-new_tile_10#0',
  hiringCost: 10,
  activeAbility: {
    name: t.f('crew.mysz.active.name'),
    cost: 1,
    effect: (_runState, context) => {
      console.log('Mysz ability effect');
      context.events.emit(GameEvent.CREW_RECALL_BALLS);
    },
  },
  passiveAbility: {
    name: t.f('crew.mysz.passive.name'),
    mount: (runState) => {
      runState.crewBoons.mysz_smallerBoat.set(true);
    },
    unmount: (runState) => {
      runState.crewBoons.mysz_smallerBoat.set(false);
    },
  },
};
