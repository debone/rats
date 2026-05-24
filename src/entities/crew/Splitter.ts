import { t } from '@/i18n/i18n';
import type { CrewMemberDef } from './Crew';

export const SplitterCrewMember: CrewMemberDef = {
  type: 'splitter',
  name: t.f('crew.splitter.name'),
  textureName: 'avatars-new_tile_5#0',
  hiringCost: 10,
  activeAbility: {
    name: t.f('crew.splitter.active.name'),
    cost: 1,
    effect: () => {
      console.log('Splitter ability effect');
    },
  },
  passiveAbility: {
    name: t.f('crew.splitter.passive.name'),
    effect: () => {
      console.log('Splitter ability effect');
    },
  },
};
