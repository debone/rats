import { getGameContext } from '@/data/game-context';
import { GameEvent } from '@/data/events';
import type { CrewMemberDef } from './Crew';

export const PanteratCrewMember: CrewMemberDef = {
  type: 'panterat',
  name: 'Panterat',
  textureName: 'avatars-new_tile_13#0',
  hiringCost: 10,
  activeAbility: {
    name: 'Strengthen balls',
    cost: 1,
    effect: () => {
      // Strengthen = speed + explosive combo (haste + explode mode)
      getGameContext().events.emit(GameEvent.CREW_HASTE_BALLS);
      getGameContext().events.emit(GameEvent.CREW_EXPLODE_BALLS);
    },
  },
  passiveAbility: {
    name: 'Abilities cost 1 less',
    mount: (runState) => {
      runState.stats.abilityDiscount.update((v) => v + 1);
    },
    unmount: (runState) => {
      runState.stats.abilityDiscount.update((v) => v - 1);
    },
  },
};
