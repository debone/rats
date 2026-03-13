export type CheeseType = 'yellow' | 'blue' | 'green';

export interface CheeseDef {
  texture: string;
}

export const CHEESE_DEFS = {
  yellow: {
    texture: 'cheese_tile_2#0',
  },
  green: {
    texture: 'cheese_tile_3#0',
  },
  blue: {
    texture: 'cheese_tile_4#0',
  },
} satisfies Record<CheeseType, CheeseDef>;
