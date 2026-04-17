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

export interface Ability {
  readonly name: string;
  readonly description?: string;

  readonly effect: () => void;
}

export interface ActiveAbility extends Ability {
  readonly cost: number;
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
  readonly passiveAbility: Ability;

  readonly hiringCost: number;
}

export class CrewMemberInstance {
  constructor(
    public readonly defKey: CrewMemberDefKey,
    public readonly key: string,
  ) {}
}

export function pickRandomCrewMember(): CrewMemberDef {
  const crewMembers = Object.values(CREW_DEFS).filter((member) => member.type !== 'empty');
  return crewMembers[Math.floor(Math.random() * crewMembers.length)];
}
