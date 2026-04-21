import type { CrewMemberDef } from './Crew';

export const LacfreeCrewMember: CrewMemberDef = {
  type: 'lacfree',
  name: 'Lacfree',
  textureName: 'avatars-new_tile_9#0',
  hiringCost: 12,
  activeAbility: {
    name: 'Next 5 bricks have cheese',
    cost: 1,
    effect: (runState) => {
      runState.crewBoons.lacfree_nextBricksHaveCheese.set(5);
    },
  },
  passiveAbility: {
    name: 'Abilities consume rubbles',
    mount: (runState) => {
      runState.crewBoons.lacfree_abilitiesConsumeRubbles.set(true);
    },
    unmount: (runState) => {
      runState.crewBoons.lacfree_abilitiesConsumeRubbles.set(false);
    },
  },
};
