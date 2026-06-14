import { GameEvent } from '@/data/events';
import { t } from '@/i18n/i18n';
import { type CrewMemberDef } from './Crew';
import { CREW_RARITIES } from './types';

export const NeonCrewMember: CrewMemberDef = {
  type: 'neon',
  name: t.dict['crew.neon.name'],
  textureName: 'avatars-new_tile_8#0',
  hiringCost: 15,
  rarity: CREW_RARITIES.rare,
  activeAbility: {
    name: t.dict['crew.neon.active.name'],
    cost: 2,
    effect: (_runState, context) => {
      context.events.emit(GameEvent.CREW_EXPLODE_BALLS);
    },
  },
  passiveAbility: {
    name: t.dict['crew.neon.passive.name'],
    mount: (runState) => {
      runState.stats.boatVelocityRatio.update((v) => v * 1.25);
    },
    unmount: (runState) => {
      runState.stats.boatVelocityRatio.update((v) => v / 1.25);
    },
  },
};
