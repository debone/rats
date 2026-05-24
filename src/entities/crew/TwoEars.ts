import { t } from '@/i18n/i18n';
import type { CrewMemberDef } from './Crew';

export const TwoEarsCrewMember: CrewMemberDef = {
  type: 'twoears',
  name: t.f('crew.twoears.name'),
  textureName: 'avatars-new_tile_3#0',
  hiringCost: 10,
  activeAbility: {
    name: t.f('crew.twoears.active.name'),
    cost: 1,
    effect: () => {
      console.log('Two Ears ability effect');
    },
  },
  passiveAbility: {
    name: t.f('crew.twoears.passive.name'),
    effect: () => {
      console.log('Two Ears ability effect');
    },
  },
};
