import { ScheduleSystem } from '@/systems/app/ScheduleSystem';
import type { CrewMemberDef } from './Crew';

const LITTLEMI_EVERYTHING_FLOATS_DURATION = 15_000;

export const LittleMiCrewMember: CrewMemberDef = {
  type: 'littlemi',
  name: 'Little Mi',
  textureName: 'avatars-new_tile_15#0',
  hiringCost: 10,
  activeAbility: {
    name: 'Everything floats (15s)',
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
    name: 'Longer boat',
    mount: (runState) => {
      console.log('Little Mi ability effect');
      runState.crewBoons.littlemi_longerBoat.set(true);
    },
    unmount: (runState) => {
      console.log('Little Mi ability effect');
      runState.crewBoons.littlemi_longerBoat.set(false);
    },
  },
};
