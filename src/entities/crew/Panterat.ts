import { ScheduleSystem } from '@/systems/app/ScheduleSystem';
import type { CrewMemberDef } from './Crew';

const PANTERAT_STRONG_BALL_DURATION = 7_000;

export const PanteratCrewMember: CrewMemberDef = {
  type: 'panterat',
  name: 'Panterat',
  textureName: 'avatars-new_tile_13#0',
  hiringCost: 10,
  activeAbility: {
    name: 'Strengthen balls',
    cost: 5,
    effect: (runState, context) => {
      runState.crewBoons.panterat_unstoppableBall.set(true);

      context.systems.get(ScheduleSystem).trySchedule(
        () => {
          runState.crewBoons.panterat_unstoppableBall.set(false);
        },
        () => {
          runState.crewBoons.panterat_unstoppableBall.set(false);
        },
        PANTERAT_STRONG_BALL_DURATION,
      );
    },
  },
  passiveAbility: {
    name: 'Abilities cost 1 less',
    mount: (runState) => {
      runState.crewBoons.panterat_cheaperAbilities.set(true);
    },
    unmount: (runState) => {
      runState.crewBoons.panterat_cheaperAbilities.set(false);
    },
  },
};
