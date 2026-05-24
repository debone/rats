import { ScheduleSystem } from '@/systems/app/ScheduleSystem';
import type { CrewMemberDef } from './Crew';

const RATFATHER_GHOST_BALLS_DURATION = 2_000;

export const RatfatherCrewMember: CrewMemberDef = {
  type: 'ratfather',
  name: 'Ratfather',
  textureName: 'avatars-new_tile_4#0',
  hiringCost: 10,
  activeAbility: {
    name: 'Ghost balls (2s)',
    cost: 5,
    effect: (runState, context) => {
      runState.crewBoons.ratfather_ghostBalls.set(true);

      context.systems.get(ScheduleSystem).trySchedule(
        () => {
          runState.crewBoons.ratfather_ghostBalls.set(false);
        },
        () => {
          runState.crewBoons.ratfather_ghostBalls.set(false);
        },
        RATFATHER_GHOST_BALLS_DURATION,
      );
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
