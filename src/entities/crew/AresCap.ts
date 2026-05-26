import { changeCheese, removeBallFromRun } from '@/data/game-state';
import { t } from '@/i18n/i18n';
import type { CrewMemberDef } from './Crew';

export const AresCapCrewMember: CrewMemberDef = {
  type: 'arescap',
  name: t.dict['crew.arescap.name'],
  textureName: 'avatars-new_tile_19#0',
  hiringCost: 10,
  activeAbility: {
    name: t.dict['crew.arescap.active.name'],
    cost: 1,
    effect: (runState) => {
      // lol it costs cheese to make it work?
      if (runState.ballsRemaining.get() === 0 || runState.cheeseCounter.get() === runState.maxCheeseStorage.get()) {
        return;
      }

      removeBallFromRun(1);
      changeCheese(1);
    },
  },
  passiveAbility: {
    name: t.dict['crew.arescap.passive.name'],
    mount: (runState) => {
      runState.stats.ballDamage.update((v) => v + 1);
    },
    unmount: (runState) => {
      runState.stats.ballDamage.update((v) => v - 1);
    },
  },
};
