import type { GameContext } from '@/data/game-context';
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
import { type CrewRarity, RARITY_WEIGHTS } from './types';
import { Assets, Texture } from 'pixi.js';
import { ASSETS } from '@/assets';

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
  readonly effect: (runState: RunState, gameContext: GameContext) => void;
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
  readonly rarity: CrewRarity;
  readonly activeAbility: ActiveAbility;
  readonly passiveAbility: PassiveAbility;

  readonly hiringCost: number;
}

export class CrewMemberInstance {
  constructor(
    public readonly defKey: CrewMemberDefKey,
    public readonly key: string,
  ) {}
}

export function getCrewTexture(defKey: CrewMemberDefKey): Texture {
  return Assets.get(ASSETS.prototype).textures[CREW_DEFS[defKey].textureName];
}

export function pickRandomCrewMember(): CrewMemberDef {
  const crewMembers = Object.values(CREW_DEFS).filter((member) => member.type !== 'empty');
  return crewMembers[Math.floor(Math.random() * crewMembers.length)];
}

export function pickRandomCrewMemberSet(count: number): CrewMemberDef[] {
  const crewMembers = Object.values(CREW_DEFS).filter((member) => member.type !== 'empty');
  const selectedCrewMembers: CrewMemberDef[] = [];

  for (let i = 0; i < count && crewMembers.length > 0; i++) {
    const totalWeight = crewMembers.reduce((sum, m) => sum + RARITY_WEIGHTS[m.rarity], 0);
    let roll = Math.random() * totalWeight;
    const pickedIndex = crewMembers.findIndex((m) => {
      roll -= RARITY_WEIGHTS[m.rarity];
      return roll <= 0;
    });

    const idx = pickedIndex === -1 ? crewMembers.length - 1 : pickedIndex;
    selectedCrewMembers.push(crewMembers[idx]);
    crewMembers.splice(idx, 1);
  }

  return selectedCrewMembers;
}
