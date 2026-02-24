import type { HoverIntent } from '@/core/reactivity/hover-intent';
import type { Signal } from '@/core/reactivity/signals/types';
import type { CrewMemberDef, CrewMemberInstance } from '@/entities/crew/Crew';

export type HoveredCrewMember = CrewMemberInstance | CrewMemberDef;

export interface CrewPickerCtx {
  hoveredMember: Signal<HoveredCrewMember | null>;
  hoverIntent: HoverIntent<HoveredCrewMember>;
}

export const CREW_PICKER_CTX = 'crew-picker';
