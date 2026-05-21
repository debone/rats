import { GameEvent } from '@/data/events';
import type { CrewMemberDef } from './Crew';

export const MyszCrewMember: CrewMemberDef = {
  type: 'mysz',
  name: 'Mysz',
  textureName: 'avatars-new_tile_10#0',
  hiringCost: 10,
  activeAbility: {
    name: 'Recall balls',
    cost: 1,
    effect: (_runState, context) => {
      console.log('Mysz ability effect');
      context.events.emit(GameEvent.CREW_RECALL_BALLS);
    },
  },
  passiveAbility: {
    name: 'Balls stick to boat',
    mount: (runState) => {
      runState.crewBoons.mysz_smallerBoat.set(true);
    },
    unmount: (runState) => {
      runState.crewBoons.mysz_smallerBoat.set(false);
    },
  },
};
