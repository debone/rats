import { defineEntity } from '@/core/entity/scope';

// Marker entity
export const BreakoutLevel = defineEntity(() => {
  return {};
});

export type BreakoutLevelEntity = ReturnType<typeof BreakoutLevel>;
