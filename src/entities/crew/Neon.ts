import { ASSETS } from '@/assets';
import { sfx } from '@/core/audio/audio';
import { getGameContext } from '@/data/game-context';
import { GameEvent } from '@/data/events';
import type { CrewMemberDef } from './Crew';

export const NeonCrewMember: CrewMemberDef = {
  type: 'neon',
  name: 'Neon',
  textureName: 'avatars-new_tile_8#0',
  hiringCost: 15,
  activeAbility: {
    name: 'Explode balls',
    cost: 2,
    effect: () => {
      sfx.playPitched(ASSETS.sounds_Rock_Impact_07, { volume: 0.5 });
      getGameContext().events.emit(GameEvent.CREW_EXPLODE_BALLS);
    },
  },
  passiveAbility: {
    name: 'Faster boat',
    mount: (runState) => {
      runState.stats.boatVelocityRatio.update((v) => v * 1.2);
    },
    unmount: (runState) => {
      runState.stats.boatVelocityRatio.update((v) => v / 1.2);
    },
  },
};
