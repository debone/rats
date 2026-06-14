import { Level1 } from '@/gameplay/campaign/0-theDepths/Level1';
import type { BreakoutLevelEntity } from '../levels/BreakoutLevel';
import { Level0 } from './0-theDepths/Level0';
import { Level2 } from './0-theDepths/Level2';
import { Level3 } from './0-theDepths/Level3';
import { Level4 } from './0-theDepths/Level4';
import { ShopLevel0 } from './shops/ShopLevel0';

export const CAMPAIGN_LEVELS = ['level-0', 'level-1', 'level-2', 'level-3', 'level-4'];

export const LEVEL_DEFINITIONS: Record<string, () => BreakoutLevelEntity> = {
  'level-0': () => Level0(),
  'level-1': () => Level1(),
  'level-2': () => Level2(),
  'level-3': () => Level3(),
  'level-4': () => Level4(),

  'shop-level-0': () => ShopLevel0(),
};
