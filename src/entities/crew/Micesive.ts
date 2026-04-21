import type { CrewMemberDef } from './Crew';

export const MicesiveCrewMember: CrewMemberDef = {
  type: 'micesive',
  name: 'Micesive',
  textureName: 'avatars-new_tile_16#0',
  hiringCost: 10,
  activeAbility: {
    name: 'Next 5 bricks have 5 rubbles',
    cost: 1,
    effect: (runState) => {
      runState.crewBoons.micesive_nextBricksHaveRubbles.set(5);
    },
  },
  passiveAbility: {
    name: 'Cheese gives +1 ball',
    mount: (runState) => {
      runState.crewBoons.micesive_cheeseGivesBall.set(true);
    },
    unmount: (runState) => {
      runState.crewBoons.micesive_cheeseGivesBall.set(false);
    },
  },
};
