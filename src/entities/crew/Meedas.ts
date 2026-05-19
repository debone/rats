import { GameEvent } from '@/data/events';
import type { CrewMemberDef } from './Crew';

export const MeedasCrewMember: CrewMemberDef = {
  type: 'meedas',
  name: 'Meedas',
  textureName: 'avatars-new_tile_12#0',
  hiringCost: 10,
  activeAbility: {
    name: 'Rubble becomes cheese',
    cost: 1,
    effect: (_runState, context) => {
      context.events.emit(GameEvent.CREW_RUBBLE_BECOMES_CHEESE);
    },
  },
  passiveAbility: {
    name: 'Balls float',
    mount: (runState) => {
      runState.crewBoons.meedas_ballsFloat.set(true);
    },
    unmount: (runState) => {
      runState.crewBoons.meedas_ballsFloat.set(false);
    },
  },
};
