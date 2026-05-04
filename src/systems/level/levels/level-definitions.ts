import type { BreakoutLevelEntity } from './BreakoutLevel';
import { Level0 } from './Level0';
import { Level1 } from './Level1';
import { Level2 } from './Level2';
import { Level3 } from './Level3';
import { Level4 } from './Level4';

/** Each value is a factory so every level load starts with fresh closure state. */
export const LEVEL_DEFINITIONS: Record<string, () => BreakoutLevelEntity> = {
  'level-0': () => Level0({}),
  'level-1': () => Level1({}),
  'level-2': () => Level2({}),
  'level-3': () => Level3({}),
  'level-4': () => Level4({}),
};
