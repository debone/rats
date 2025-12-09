/**
 * GID (Global Tile ID) utilities for Tiled maps.
 *
 * The most significant bits of a 32-bit tile GID contain flip flags.
 * @see https://doc.mapeditor.org/en/stable/reference/tmx-map-format/#tile-flipping
 */

export const FLIPPED_HORIZONTALLY_FLAG = 0x80000000;
export const FLIPPED_VERTICALLY_FLAG = 0x40000000;
export const FLIPPED_DIAGONALLY_FLAG = 0x20000000;

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
