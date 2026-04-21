import type { CrewMemberDef } from './Crew';

export const RatfatherCrewMember: CrewMemberDef = {
  type: 'ratfather',
  name: 'Ratfather',
  textureName: 'avatars-new_tile_4#0',
  hiringCost: 10,
  activeAbility: {
    name: 'Ghost balls (2s)',
    cost: 1,
    effect: () => {
      console.log('Ratfather ability effect');
    },
  },
  passiveAbility: {
    name: 'Bricks give more cheese',
    mount: (_runState) => {},
    unmount: (_runState) => {},
  },
};
