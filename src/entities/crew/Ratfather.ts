import { t } from '@/i18n/i18n';
import { ScheduleSystem } from '@/systems/app/ScheduleSystem';
import { type CrewMemberDef } from './Crew';
import { CREW_RARITIES } from './types';

const RATFATHER_GHOST_BALLS_DURATION = 2_000;

export const RatfatherCrewMember: CrewMemberDef = {
  type: 'ratfather',
  name: t.dict['crew.ratfather.name'],
  textureName: 'avatars-new_tile_4#0',
  hiringCost: 10,
  rarity: CREW_RARITIES.common,
  activeAbility: {
    name: t.dict['crew.ratfather.active.name'],
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
    name: t.dict['crew.ratfather.passive.name'],
    mount: (runState) => {
      runState.crewBoons.ratfather_bricksGiveMoreCheese.set(true);
    },
    unmount: (runState) => {
      runState.crewBoons.ratfather_bricksGiveMoreCheese.set(false);
    },
  },
};
