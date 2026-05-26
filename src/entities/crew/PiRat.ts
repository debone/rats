import { addBallToRun } from '@/data/game-state';
import { t } from '@/i18n/i18n';
import type { CrewMemberDef } from './Crew';

export const PiRatCrewMember: CrewMemberDef = {
  type: 'pirat',
  name: t.dict['crew.pirat.name'],
  textureName: 'avatars-new_tile_18#0',
  hiringCost: 10,
  activeAbility: {
    name: t.dict['crew.pirat.active.name'],
    cost: 1,
    effect: () => {
      addBallToRun(1);
    },
  },
  passiveAbility: {
    name: t.dict['crew.pirat.passive.name'],
    mount: (runState) => {
      runState.crewBoons.pirat_ballsStickToBoat.set(true);
    },
    unmount: (runState) => {
      runState.crewBoons.pirat_ballsStickToBoat.set(false);
    },
  },
};
