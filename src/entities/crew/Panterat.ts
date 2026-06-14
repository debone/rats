import { t } from '@/i18n/i18n';
import { ScheduleSystem } from '@/systems/app/ScheduleSystem';
import { type CrewMemberDef } from './Crew';
import { CREW_RARITIES } from './types';

const PANTERAT_STRONG_BALL_DURATION = 7_000;

export const PanteratCrewMember: CrewMemberDef = {
  type: 'panterat',
  name: t.dict['crew.panterat.name'],
  textureName: 'avatars-new_tile_13#0',
  hiringCost: 10,
  rarity: CREW_RARITIES.uncommon,
  activeAbility: {
    name: t.dict['crew.panterat.active.name'],
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
    name: t.dict['crew.panterat.passive.name'],
    mount: (runState) => {
      runState.crewBoons.panterat_cheaperAbilities.set(true);
    },
    unmount: (runState) => {
      runState.crewBoons.panterat_cheaperAbilities.set(false);
    },
  },
};
