import { BloomFilter } from 'pixi-filters';
import type { Filter } from 'pixi.js';
import { defineScreen } from '../../types';

/**
 * Soft bloom pass for ribbon trails and orb effects.
 * Enable on the demo container (or camera viewport in-game) to give
 * glow to any bright pixels in the layer beneath.
 *
 * In-game usage:
 *   const handle = vfx.screen(trailBloom);
 *   handle.enable();
 *   // ... later:
 *   handle.disable();
 */
export const trailBloom = defineScreen({
  kind: 'screen',
  id: 'trailBloom',
  target: 'viewport',
  create(): Filter {
    return new BloomFilter({ quality: 3, strength: 4, strengthX: 4, strengthY: 4 }) as unknown as Filter;
  },
});
