import { Level1 } from '@/gameplay/campaign/0-theDepths/Level1';
import type { BreakoutLevelEntity } from '../levels/BreakoutLevel';

export const CAMPAIGN_LEVELS = ['level-1'];

export const LEVEL_DEFINITIONS: Record<string, () => BreakoutLevelEntity> = {
  'level-1': () => Level1(),
};
