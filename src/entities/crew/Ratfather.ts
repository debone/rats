import { getGameContext } from '@/data/game-context';
import { GameEvent } from '@/data/events';
import type { CrewMemberDef } from './Crew';

export const RatfatherCrewMember: CrewMemberDef = {
  type: 'ratfather',
  name: 'Ratfather',
  textureName: 'avatars-new_tile_4#0',
  hiringCost: 10,
  activeAbility: {
    name: 'Ghost balls (2s)',
    cost: 1,
    effect: () => {
      getGameContext().events.emit(GameEvent.CREW_GHOST_BALLS);
    },
  },
  passiveAbility: {
    name: 'Bricks give more cheese',
    mount: (runState) => {
      runState.crewBoons.ratfather_bricksGiveMoreCheese.set(true);
    },
    unmount: (runState) => {
      runState.crewBoons.ratfather_bricksGiveMoreCheese.set(false);
    },
  },
};
