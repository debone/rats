/**
 * GID (Global Tile ID) utilities for Tiled maps.
 *
 * The most significant bits of a 32-bit tile GID contain flip flags.
 * @see https://doc.mapeditor.org/en/stable/reference/tmx-map-format/#tile-flipping
 */

export const FLIPPED_HORIZONTALLY_FLAG = 0x80000000;
export const FLIPPED_VERTICALLY_FLAG = 0x40000000;
export const FLIPPED_DIAGONALLY_FLAG = 0x20000000;

// Calculate transform for flipped tiles
// pixi.js supports texture rotation
// 0b0000 up
// 0b0010 left
// 0b0100 down
// 0b0110 right
// 0b1000 up mirrored
// 0b1010 left mirrored
// 0b1100 down mirrored
// 0b1110 right mirrored

export const FLIP_FLAGS = FLIPPED_HORIZONTALLY_FLAG | FLIPPED_VERTICALLY_FLAG | FLIPPED_DIAGONALLY_FLAG;

const mappingTiledToPixi = {
  [0b000]: 0b0000,
  [0b011]: 0b0010,
  [0b110]: 0b0100,
  [0b101]: 0b0110,
  [0b010]: 0b1000,
  [0b111]: 0b1010,
  [0b100]: 0b1100,
  [0b001]: 0b1110,
};

export function getPixiRotationFromGid(gid: number): number {
  const flipFlags = getFlipFlags(gid);
  //@ts-ignore
  return mappingTiledToPixi[flipFlags] || 0;
}

export function getFlipFlags(gid: number): number {
  return (gid >> 29) & 0b111;
}

/** Check if tile is flipped horizontally */
export function isFlippedHorizontally(gid: number): boolean {
  return !!(gid & FLIPPED_HORIZONTALLY_FLAG);
}

/** Check if tile is flipped vertically */
export function isFlippedVertically(gid: number): boolean {
  return !!(gid & FLIPPED_VERTICALLY_FLAG);
}

/** Check if tile is flipped diagonally (enables rotation) */
export function isFlippedDiagonally(gid: number): boolean {
  return !!(gid & FLIPPED_DIAGONALLY_FLAG);
}

/** Extract the actual tile ID by removing flip flags */
export function getCanonicalGid(gid: number): number {
  return gid & ~(FLIPPED_HORIZONTALLY_FLAG | FLIPPED_VERTICALLY_FLAG | FLIPPED_DIAGONALLY_FLAG);
}
