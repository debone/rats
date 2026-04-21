import { ASSETS } from '@/assets';
import { sfx } from '@/core/audio/audio';
import { getGameContext } from '@/data/game-context';
import { GameEvent } from '@/data/events';
import type { CrewMemberDef } from './Crew';

export const ApprenticeCrewMember: CrewMemberDef = {
  type: 'apprentice',
  name: 'Apprentice',
  textureName: 'avatars-new_tile_7#0',
  hiringCost: 10,
  activeAbility: {
    name: 'Shoots new ball',
    cost: 1,
    effect: () => {
      sfx.play(ASSETS.sounds_Rat_Squeak_A, { volume: 0.5 });
      getGameContext().events.emit(GameEvent.CREW_SPAWN_BALL);
    },
  },
  passiveAbility: {
    name: 'Slower balls',
    mount: (runState) => {
      runState.stats.ballSpeedRatio.update((v) => v * 0.75);
    },
    unmount: (runState) => {
      runState.stats.ballSpeedRatio.update((v) => v / 0.75);
    },
  },
};
