import type { RunState } from '@/data/game-state';
import { ApprenticeCrewMember } from './Apprentice';
import { AresCapCrewMember } from './AresCap';
import { AuraCrewMember } from './Aura';
import { EmptyCrewMember } from './Empty';
import { FlubCrewMember } from './Flub';
import { LacfreeCrewMember } from './Lacfree';
import { LittleMiCrewMember } from './LittleMi';
import { MeedasCrewMember } from './Meedas';
import { MicesiveCrewMember } from './Micesive';
import { MrBluCrewMember } from './MrBlu';
import { MyszCrewMember } from './Mysz';
import { NeonCrewMember } from './Neon';
import { NuggetsCrewMember } from './Nuggets';
import { PanteratCrewMember } from './Panterat';
import { PiRatCrewMember } from './PiRat';
import { RatfatherCrewMember } from './Ratfather';
import { RatoulieCrewMember } from './Ratoulie';
import { SplitterCrewMember } from './Splitter';
import { TwoEarsCrewMember } from './TwoEars';

export const CREW_RARITIES = {
  common: 'common',
  uncommon: 'uncommon',
  rare: 'rare',
} as const;

export type CrewRarity = (typeof CREW_RARITIES)[keyof typeof CREW_RARITIES];

// Relative pick weights — tune these to balance how often each tier appears in the shop.
// Defaults: a common rat is picked ~5× more often than a rare rat per available slot.
export const RARITY_WEIGHTS: Record<CrewRarity, number> = {
  common: 5,
  uncommon: 2,
  rare: 1,
};

export const SHOP_SLOT_COUNT = 3;

export interface Ability {
  readonly name: string;
  readonly description?: string;
}

export interface PassiveAbility extends Ability {
  readonly mount: (runState: RunState) => void;
  readonly unmount: (runState: RunState) => void;
}

export interface ActiveAbility extends Ability {
  readonly cost: number;
  readonly effect: (runState: RunState) => void;
}

export const CREW_DEFS = {
  nuggets: NuggetsCrewMember,
  apprentice: ApprenticeCrewMember,
  neon: NeonCrewMember,
  lacfree: LacfreeCrewMember,
  twoears: TwoEarsCrewMember,
  ratfather: RatfatherCrewMember,
  splitter: SplitterCrewMember,
  mysz: MyszCrewMember,
  flub: FlubCrewMember,
  meedas: MeedasCrewMember,
  panterat: PanteratCrewMember,
  littlemi: LittleMiCrewMember,
  mrblu: MrBluCrewMember,
  micesive: MicesiveCrewMember,
  ratoulie: RatoulieCrewMember,
  pirat: PiRatCrewMember,
  arescap: AresCapCrewMember,
  aura: AuraCrewMember,

  // EMPTY MUST BE THE LAST!
  empty: EmptyCrewMember,
} satisfies Record<string, CrewMemberDef>;

export type CrewMemberDefKey = keyof typeof CREW_DEFS;

export interface CrewMemberDef {
  readonly name: string;
  readonly description?: string;
  readonly type: CrewMemberDefKey;
  readonly textureName: string;
  readonly activeAbility: ActiveAbility;
  readonly passiveAbility: PassiveAbility;
  readonly hiringCost: number;
  readonly rarity: CrewRarity;
}

export class CrewMemberInstance {
  constructor(
    public readonly defKey: CrewMemberDefKey,
    public readonly key: string,
  ) {}
}

export function pickShopSelection(count: number = SHOP_SLOT_COUNT): CrewMemberDef[] {
  const remaining = Object.values(CREW_DEFS).filter((m) => m.type !== 'empty');
  const selected: CrewMemberDef[] = [];

  for (let i = 0; i < count && remaining.length > 0; i++) {
    const totalWeight = remaining.reduce((sum, m) => sum + RARITY_WEIGHTS[m.rarity], 0);
    let roll = Math.random() * totalWeight;
    const pickedIndex = remaining.findIndex((m) => {
      roll -= RARITY_WEIGHTS[m.rarity];
      return roll <= 0;
    });
    const idx = pickedIndex === -1 ? remaining.length - 1 : pickedIndex;
    selected.push(remaining[idx]);
    remaining.splice(idx, 1);
  }

  return selected;
}
