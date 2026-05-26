export type CheeseType = 'yellow' | 'blue' | 'green' | 'gruyere';

export interface CheeseDef {
  texture: string;
}

export const CHEESE_DEFS = {
  yellow: {
    texture: 'cheese_tile_1#0',
  },
  green: {
    texture: 'cheese_tile_3#0',
  },
  blue: {
    texture: 'cheese_tile_4#0',
  },
  gruyere: {
    texture: 'cheese_tile_5#0',
  },
} satisfies Record<CheeseType, CheeseDef>;
