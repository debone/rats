import { Level0 } from '@/gameplay/campaign/0-theDepths/Level0';
import { Level1 } from '@/gameplay/campaign/0-theDepths/Level1';
import { Level2 } from '@/gameplay/campaign/0-theDepths/Level2';
import { Level3 } from '@/gameplay/campaign/0-theDepths/Level3';
import { Level4 } from '@/gameplay/campaign/0-theDepths/Level4';
import type { BreakoutLevelEntity } from '../levels/BreakoutLevel';

export const CAMPAIGN_LEVELS = ['level-0', 'level-1', 'level-2', 'level-3', 'level-4'];

export const LEVEL_DEFINITIONS: Record<string, () => BreakoutLevelEntity> = {
  'level-0': () => Level0(),
  'level-1': () => Level1(),
  'level-2': () => Level2(),
  'level-3': () => Level3(),
  'level-4': () => Level4(),
};
