import { changeCheese, getRunState, removeBallFromRun } from '@/data/game-state';
import { CREW_RARITIES, type CrewMemberDef } from './Crew';
import { MAX_CHEESE } from '@/consts';

export const AresCapCrewMember: CrewMemberDef = {
  type: 'arescap',
  name: "Yer' Ares Cap",
  textureName: 'avatars-new_tile_19#0',
  hiringCost: 10,
  rarity: CREW_RARITIES.rare,
  activeAbility: {
    name: 'Transforms 1 ball into 1 cheese',
    cost: 1,
    effect: () => {
      // lol it costs cheese to make it work?
      if (getRunState().ballsRemaining.get() === 0 || getRunState().cheeseCounter.get() === MAX_CHEESE) {
        return;
      }

      removeBallFromRun(1);
      changeCheese(1);
    },
  },
  passiveAbility: {
    name: 'Balls deal additional 1 damage',
    mount: (runState) => {
      runState.stats.ballDamage.update((v) => v + 1);
    },
    unmount: (runState) => {
      runState.stats.ballDamage.update((v) => v - 1);
    },
  },
};
