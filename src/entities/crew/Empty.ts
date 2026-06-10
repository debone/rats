import { t } from '@/i18n/i18n';
import type { CrewMemberDef } from './Crew';

export const EmptyCrewMember: CrewMemberDef = {
  type: 'empty',
  name: t.dict['crew.empty.name'],
  description: 'no ability',
  textureName: 'avatars-new_tile_1#0',

  hiringCost: 0,

  activeAbility: {
    name: t.dict['crew.empty.active.name'],
    cost: 0,
    effect: () => {
      console.log('Empty ability effect');
    },
  },

  passiveAbility: {
    name: t.dict['crew.empty.passive.name'],
    mount: () => {
      console.log('Empty passive ability effect');
    },
    unmount: () => {
      console.log('Empty passive ability unmount');
    },
  },
};
