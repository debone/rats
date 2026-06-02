import { CRT2Filter } from '@/lib/CRT/CRT';
import type { Filter } from 'pixi.js';
import { defineScreen } from '@/core/vfx/types';

export const crtEffect = defineScreen({
  kind: 'screen',
  id: 'crt',
  pin: true,
  target: 'viewport',
  create(): Filter {
    return new CRT2Filter({
      curvature: 0,
      lineWidth: 0,
      lineContrast: 0,
      noise: 0.12,
      vignetting: 0,
    });
  },
  update(filter: Filter, dtMs: number): void {
    (filter as CRT2Filter).time += dtMs / 500;
  },
});
