import { getGameContext } from '@/data/game-context';
import { GameEvent } from '@/data/events';
import type { CrewMemberDef } from './Crew';

export const FlubCrewMember: CrewMemberDef = {
  type: 'flub',
  name: 'Flub',
  textureName: 'avatars-new_tile_11#0',
  hiringCost: 10,
  activeAbility: {
    name: 'Haste balls',
    cost: 1,
    effect: () => {
      getGameContext().events.emit(GameEvent.CREW_HASTE_BALLS);
    },
  },
  passiveAbility: {
    name: 'Balls are attracted to the boat',
    mount: (runState) => {
      runState.crewBoons.flub_ballsAttractedToBoat.set(true);
    },
    unmount: (runState) => {
      runState.crewBoons.flub_ballsAttractedToBoat.set(false);
    },
  },
};
