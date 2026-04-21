import { ASSETS } from '@/assets';
import { sfx } from '@/core/audio/audio';
import { getGameContext } from '@/data/game-context';
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
    effect: () => {
      sfx.play(ASSETS.sounds_Rat_Squeak_A, { volume: 0.5 });
      getGameContext().events.emit(GameEvent.CREW_RECALL_BALLS);
    },
  },
  passiveAbility: {
    name: 'Balls stick to boat',
    mount: (runState) => {
      runState.crewBoons.mysz_ballsStickToBoat.set(true);
    },
    unmount: (runState) => {
      runState.crewBoons.mysz_ballsStickToBoat.set(false);
    },
  },
};
