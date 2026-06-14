import { GameEvent } from '@/data/events';
import { t } from '@/i18n/i18n';
import { type CrewMemberDef } from './Crew';
import { CREW_RARITIES } from './types';

export const SplitterCrewMember: CrewMemberDef = {
  type: 'splitter',
  name: t.dict['crew.splitter.name'],
  textureName: 'avatars-new_tile_5#0',
  hiringCost: 10,
  rarity: CREW_RARITIES.rare,
  activeAbility: {
    name: t.dict['crew.splitter.active.name'],
    cost: 3,
    effect: (_runState, context) => {
      context.events.emit(GameEvent.CREW_DOUBLE_BALLS);
    },
  },
  passiveAbility: {
    name: t.dict['crew.splitter.passive.name'],
    mount: (runState) => {
      runState.crewBoons.splitter_additionalCheeseStorage.set(true);
      runState.maxCheeseStorage.update((current) => current + 2);
    },
    unmount: (runState) => {
      runState.crewBoons.splitter_additionalCheeseStorage.set(false);
      runState.maxCheeseStorage.update((current) => current - 2);
      runState.cheeseCounter.update((current) => Math.min(current, runState.maxCheeseStorage.get()));
    },
  },
};
