import { defineEntity } from '@/core/entity/scope';

export const BreakoutLevel = defineEntity((_: object) => {
  return {};
});

export type BreakoutLevelEntity = ReturnType<typeof BreakoutLevel>;
