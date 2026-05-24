import { t } from '@/i18n/i18n';
import { ScheduleSystem } from '@/systems/app/ScheduleSystem';
import type { CrewMemberDef } from './Crew';

const LITTLEMI_EVERYTHING_FLOATS_DURATION = 15_000;

export const LittleMiCrewMember: CrewMemberDef = {
  type: 'littlemi',
  name: t.f('crew.littlemi.name'),
  textureName: 'avatars-new_tile_15#0',
  hiringCost: 10,
  activeAbility: {
    name: t.f('crew.littlemi.active.name'),
    cost: 1,
    effect: (runState, context) => {
      runState.crewBoons.littlemi_everythingFloats.set(true);

      context.systems.get(ScheduleSystem).trySchedule(
        () => {
          runState.crewBoons.littlemi_everythingFloats.set(false);
        },
        () => {
          runState.crewBoons.littlemi_everythingFloats.set(false);
        },
        LITTLEMI_EVERYTHING_FLOATS_DURATION,
      );
    },
  },
  passiveAbility: {
    name: t.f('crew.littlemi.passive.name'),
    mount: (runState) => {
      runState.crewBoons.littlemi_longerBoat.set(true);
    },
    unmount: (runState) => {
      runState.crewBoons.littlemi_longerBoat.set(false);
    },
  },
};
