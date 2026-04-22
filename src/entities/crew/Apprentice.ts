import { GameEvent } from '@/data/events';
import type { CrewMemberDef } from './Crew';
import { getGameContext } from '@/data/game-context';

export const ApprenticeCrewMember: CrewMemberDef = {
  type: 'apprentice',
  name: 'Apprentice',
  textureName: 'avatars-new_tile_7#0',
  hiringCost: 10,
  activeAbility: {
    name: 'Shoots new ball',
    cost: 1,
    effect: () => {
      getGameContext().events.emit(GameEvent.CREW_SHOOT_BALL);
    },
  },
  passiveAbility: {
    name: 'Slower balls',
    mount: (runState) => {
      runState.stats.ballSpeedRatio.update((v) => v * 0.75);
    },
    unmount: (runState) => {
      runState.stats.ballSpeedRatio.update((v) => v / 0.75);
    },
  },
};
