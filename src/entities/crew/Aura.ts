import { GameEvent } from '@/data/events';
import { getGameContext } from '@/data/game-context';
import { addBallToRun } from '@/data/game-state';
import { t } from '@/i18n/i18n';
import type { CrewMemberDef } from './Crew';

export const AuraCrewMember: CrewMemberDef = {
  type: 'aura',
  name: t.f('crew.aura.name'),
  textureName: 'avatars-new_tile_2#0',
  hiringCost: 10,
  activeAbility: {
    name: t.f('crew.aura.active.name'),
    cost: 1,
    effect: (runState) => {
      addBallToRun(runState.ballsRemaining.get());
      getGameContext().events.emit(GameEvent.CREW_DOUBLE_BALLS);
    },
  },
  passiveAbility: {
    name: t.f('crew.aura.passive.name'),
    mount: (runState) => {
      runState.crewBoons.aura_cheeseBreaksBricks.set(true);
    },
    unmount: (runState) => {
      runState.crewBoons.aura_cheeseBreaksBricks.set(false);
    },
  },
};
