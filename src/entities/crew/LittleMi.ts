import { t } from '@/i18n/i18n';
import { ScheduleSystem } from '@/systems/app/ScheduleSystem';
import { type CrewMemberDef } from './Crew';
import { CREW_RARITIES } from './types';

const LITTLEMI_EVERYTHING_FLOATS_DURATION = 15_000;

export const LittleMiCrewMember: CrewMemberDef = {
  type: 'littlemi',
  name: t.dict['crew.littlemi.name'],
  textureName: 'avatars-new_tile_15#0',
  hiringCost: 10,
  rarity: CREW_RARITIES.uncommon,
  activeAbility: {
    name: t.dict['crew.littlemi.active.name'],
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
    name: t.dict['crew.littlemi.passive.name'],
    mount: (runState) => {
      runState.crewBoons.littlemi_longerBoat.set(true);
    },
    unmount: (runState) => {
      runState.crewBoons.littlemi_longerBoat.set(false);
    },
  },
};
