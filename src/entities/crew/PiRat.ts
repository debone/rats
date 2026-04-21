import { addBallToRun } from '@/data/game-state';
import type { CrewMemberDef } from './Crew';

export const PiRatCrewMember: CrewMemberDef = {
  type: 'pirat',
  name: 'Pi Rat',
  textureName: 'avatars-new_tile_18#0',
  hiringCost: 10,
  activeAbility: {
    name: 'Adds ball',
    cost: 1,
    effect: () => {
      addBallToRun(1);
    },
  },
  passiveAbility: {
    name: 'Boat is immobilized',
    mount: (runState) => {
      runState.crewBoons.pirat_boatImmobilized.set(true);
    },
    unmount: (runState) => {
      runState.crewBoons.pirat_boatImmobilized.set(false);
    },
  },
};
