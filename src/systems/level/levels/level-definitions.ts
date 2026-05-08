import { Level1 } from './Level1';
import type { BreakoutLevelEntity } from './BreakoutLevel';

export const LEVEL_DEFINITIONS: Record<string, () => BreakoutLevelEntity> = {
  'level-1': () => Level1(),
};
