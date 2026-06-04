import { MIN_HEIGHT } from '@/consts';
import { ReflectionFilter2 } from '@/lib/ReflectionFilter/ReflectionFilter';
import type { Filter } from 'pixi.js';
import { defineScreen } from '@/systems/vfx/types';

export const reflectionEffect = defineScreen({
  kind: 'screen',
  id: 'reflection',
  pin: true,
  target: 'viewport',
  create(): Filter {
    return new ReflectionFilter2({
      alpha: [1.0, 0.0],
      amplitude: [20, 200],
    });
  },
  update(filter: Filter, delta: number): void {
    (filter as ReflectionFilter2).time += delta / 200;
  },
  resize(filter: Filter, _w: number, h: number): void {
    // The game world is MIN_HEIGHT tall. When the renderer is larger, the world
    // sits centered with equal empty space above and below. border/amplitude
    // describe that geometry in [0..1] normalized space (same as the shader).
    const border = (h - MIN_HEIGHT) / 2 / h;
    const amplitude = MIN_HEIGHT / h;
    (filter as ReflectionFilter2).boundary = border + amplitude * 0.938;
  },
});
