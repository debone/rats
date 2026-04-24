import type { LayoutStyles } from '@pixi/layout';
import type { CrewRarity } from '@/entities/crew/Crew';

export const RARITY_BORDER_COLOR: Record<CrewRarity, number> = {
  common: 0x57294b,
  uncommon: 0x4488ff,
  rare: 0xffcc00,
};

export const panelLayout: Partial<LayoutStyles> = {
  gap: 10,
  padding: 10,
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
};

export const panelLayoutBordered: Partial<LayoutStyles> = {
  ...panelLayout,
  backgroundColor: 0x272736,
  borderColor: 0x57294b,
  borderWidth: 1,
  borderRadius: 5,
};

export const buttonLayout: Partial<LayoutStyles> = {
  gap: 10,
  padding: 10,
  backgroundColor: 0x272736,
  borderColor: 0x57294b,
  borderWidth: 1,
  borderRadius: 3,
  alignItems: 'center',
  justifyContent: 'center',
};
