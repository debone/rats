import { t } from '@/i18n/i18n';
import { ScheduleSystem } from '@/systems/app/ScheduleSystem';
import type { CrewMemberDef } from './Crew';

const RATFATHER_GHOST_BALLS_DURATION = 2_000;

export const RatfatherCrewMember: CrewMemberDef = {
  type: 'ratfather',
  name: t.f('crew.ratfather.name'),
  textureName: 'avatars-new_tile_4#0',
  hiringCost: 10,
  activeAbility: {
    name: t.f('crew.ratfather.active.name'),
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
    name: t.f('crew.ratfather.passive.name'),
    mount: (runState) => {
      runState.crewBoons.ratfather_bricksGiveMoreCheese.set(true);
    },
    unmount: (runState) => {
      runState.crewBoons.ratfather_bricksGiveMoreCheese.set(false);
    },
  },
};
