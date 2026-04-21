import { ASSETS } from '@/assets';
import { sfx } from '@/core/audio/audio';
import { changeCheese, removeBallFromRun } from '@/data/game-state';
import type { CrewMemberDef } from './Crew';

export const AresCapCrewMember: CrewMemberDef = {
  type: 'arescap',
  name: "Yer' Ares Cap",
  textureName: 'avatars-new_tile_19#0',
  hiringCost: 10,
  activeAbility: {
    name: 'Transforms 1 ball into 1 cheese',
    cost: 1,
    effect: (runState) => {
      if (runState.ballsRemaining.get() <= 0) return;
      sfx.play(ASSETS.sounds_Sell_Building_A, { volume: 0.5 });
      removeBallFromRun(1);
      changeCheese(1);
    },
  },
  passiveAbility: {
    name: 'Balls cause 2 damage',
    mount: (runState) => {
      runState.stats.brickDamage.update((v) => v + 1);
    },
    unmount: (runState) => {
      runState.stats.brickDamage.update((v) => v - 1);
    },
  },
};
