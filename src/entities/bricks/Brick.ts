export type BrickPowerUps = 'yellow' | 'blue' | 'green';

export interface BrickPowerUpDef {
  texture: string;
}

export const BRICK_POWER_UP_DEFS = {
  yellow: {
    texture: 'badges_tile_7#0',
  },
  blue: {
    texture: 'badges_tile_8#0',
  },
  green: {
    texture: 'badges_tile_9#0',
  },
} satisfies Record<BrickPowerUps, BrickPowerUpDef>;

export type BrickType = 'normal' | 'strong';

export interface BrickDef {
  texture: string;
}

export const BRICK_DEFS = {
  normal: {
    texture: 'bricks_tile_1#0',
  },
  strong: {
    texture: 'bricks_tile_3#0',
  },
} satisfies Record<BrickType, BrickDef>;
