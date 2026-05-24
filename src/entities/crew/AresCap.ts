import { MAX_CHEESE } from '@/consts';
import { changeCheese, removeBallFromRun } from '@/data/game-state';
import { t } from '@/i18n/i18n';
import type { CrewMemberDef } from './Crew';

export const AresCapCrewMember: CrewMemberDef = {
  type: 'arescap',
  name: t.f('crew.arescap.name'),
  textureName: 'avatars-new_tile_19#0',
  hiringCost: 10,
  activeAbility: {
    name: t.f('crew.arescap.active.name'),
    cost: 1,
    effect: (runState) => {
      // lol it costs cheese to make it work?
      if (runState.ballsRemaining.get() === 0 || runState.cheeseCounter.get() === MAX_CHEESE) {
        return;
      }

      removeBallFromRun(1);
      changeCheese(1);
    },
  },
  passiveAbility: {
    name: t.f('crew.arescap.passive.name'),
    mount: (runState) => {
      runState.stats.ballDamage.update((v) => v + 1);
    },
    unmount: (runState) => {
      runState.stats.ballDamage.update((v) => v - 1);
    },
  },
};
