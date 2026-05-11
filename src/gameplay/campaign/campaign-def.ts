import { Level1 } from '@/gameplay/campaign/0-theDepths/Level1';
import type { BreakoutLevelEntity } from '../levels/BreakoutLevel';
import { Level0 } from './0-theDepths/Level0';

export const CAMPAIGN_LEVELS = ['level-0', 'level-1'];

export const LEVEL_DEFINITIONS: Record<string, () => BreakoutLevelEntity> = {
  'level-0': () => Level0(),
  'level-1': () => Level1(),
};
