import type { LayoutStyles } from '@pixi/layout';

export const panelLayout: Partial<LayoutStyles> = {
  gap: 10,
  padding: 10,
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
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
