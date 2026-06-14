import { GameEvent } from '@/data/events';
import { t } from '@/i18n/i18n';
import { type CrewMemberDef } from './Crew';
import { CREW_RARITIES } from './types';
import { getGameContext } from '@/data/game-context';

export const ApprenticeCrewMember: CrewMemberDef = {
  type: 'apprentice',
  name: t.dict['crew.apprentice.name'],
  textureName: 'avatars-new_tile_7#0',
  hiringCost: 10,
  rarity: CREW_RARITIES.common,
  activeAbility: {
    name: t.dict['crew.apprentice.active.name'],
    cost: 1,
    effect: () => {
      getGameContext().events.emit(GameEvent.CREW_SHOOT_BALL);
    },
  },
  passiveAbility: {
    name: t.dict['crew.apprentice.passive.name'],
    mount: (runState) => {
      runState.stats.ballSpeedRatio.update((v) => v * 0.75);
    },
    unmount: (runState) => {
      runState.stats.ballSpeedRatio.update((v) => v / 0.75);
    },
  },
};
