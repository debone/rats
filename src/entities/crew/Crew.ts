import { CaptainCrewMember } from './Captain';
import { DoublerCrewMember } from './Doubler';
import { EmptyCrewMember } from './Empty';
import { FasterCrewMember } from './Faster';

export interface Ability {
  readonly name: string;
  readonly description: string;
  readonly cost: number;

  readonly effect: () => void;
}

export const CREW_DEFS = {
  captain: CaptainCrewMember,
  faster: FasterCrewMember,
  doubler: DoublerCrewMember,

  // EMPTY MUST BE THE LAST!
  empty: EmptyCrewMember,
} satisfies Record<string, CrewMemberDef>;

export type CrewMemberDefKey = keyof typeof CREW_DEFS;

export interface CrewMemberDef {
  readonly name: string;
  readonly description: string;
  readonly type: CrewMemberDefKey;
  readonly textureName: string;
  readonly ability: Ability;

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
