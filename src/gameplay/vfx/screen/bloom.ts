import { BloomFilter } from 'pixi-filters';
import type { Filter } from 'pixi.js';
import { defineScreen } from '@/systems/vfx/types';

export const bloomEffect = defineScreen({
  kind: 'screen',
  id: 'bloom',
  target: 'viewport',
  create(): Filter {
    return new BloomFilter({ quality: 3, strength: 1 }) as unknown as Filter;
  },
});
