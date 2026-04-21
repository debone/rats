import { getGameContext } from '@/data/game-context';
import { GameEvent } from '@/data/events';
import type { CrewMemberDef } from './Crew';

export const AuraCrewMember: CrewMemberDef = {
  type: 'aura',
  name: 'Aura',
  textureName: 'avatars-new_tile_2#0',
  hiringCost: 10,
  activeAbility: {
    name: 'Doubles all balls',
    cost: 1,
    effect: () => {
      getGameContext().events.emit(GameEvent.CREW_DOUBLE_BALLS);
    },
  },
  passiveAbility: {
    name: 'Cheese can break bricks',
    mount: (runState) => {
      runState.crewBoons.aura_cheeseBreaksBricks.set(true);
    },
    unmount: (runState) => {
      runState.crewBoons.aura_cheeseBreaksBricks.set(false);
    },
  },
};
