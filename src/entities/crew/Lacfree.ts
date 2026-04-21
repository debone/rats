import type { CrewMemberDef } from './Crew';

export const LacfreeCrewMember: CrewMemberDef = {
  type: 'lacfree',
  name: 'Lacfree',
  textureName: 'avatars-new_tile_9#0',
  hiringCost: 12,
  activeAbility: {
    name: 'Next 5 bricks have cheese',
    cost: 1,
    effect: () => {
      console.log('Lacfree ability effect');
    },
  },
  passiveAbility: {
    name: 'Abilities consume rubbles',
    mount: (_runState) => {},
    unmount: (_runState) => {},
  },
};
