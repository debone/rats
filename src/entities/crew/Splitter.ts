import { ASSETS } from '@/assets';
import { sfx } from '@/core/audio/audio';
import { getGameContext } from '@/data/game-context';
import { GameEvent } from '@/data/events';
import type { CrewMemberDef } from './Crew';

export const SplitterCrewMember: CrewMemberDef = {
  type: 'splitter',
  name: 'Splitter',
  textureName: 'avatars-new_tile_5#0',
  hiringCost: 10,
  activeAbility: {
    name: 'Double balls',
    cost: 1,
    effect: () => {
      sfx.play(ASSETS.sounds_Rat_Squeak_A, { volume: 0.5 });
      getGameContext().events.emit(GameEvent.CREW_DOUBLE_BALLS);
    },
  },
  passiveAbility: {
    name: '+2 cheese storage',
    mount: (runState) => {
      runState.stats.cheeseStorageBonus.update((v) => v + 2);
    },
    unmount: (runState) => {
      runState.stats.cheeseStorageBonus.update((v) => v - 2);
    },
  },
};
