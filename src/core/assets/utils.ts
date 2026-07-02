import type { Texture } from 'pixi.js';

export interface TextureMetadata {
  label: string;
  tile: number;
  frame: number;
}

export function getTextureMetadata(texture: Texture): TextureMetadata {
  const textureLabel = texture.label;
  if (!textureLabel) {
    return { label: '', tile: 0, frame: 0 };
  }
  const [labelTile, frame] = textureLabel.split('#');

  // Grab only the last number after _
  const tileNumber = labelTile.split('_').pop();

  // Grab everything before the last _
  const label = labelTile.split('_').slice(0, -1).join('_');

  return {
    label,
    tile: parseInt(tileNumber ?? '0'),
    frame: parseInt(frame),
  };
}

export function makeTextureLabel(meta: TextureMetadata): string;
export function makeTextureLabel(label: string, tile: number, frame?: number): string;
export function makeTextureLabel(arg1: string | TextureMetadata, arg2?: number, arg3?: number): string {
  if (typeof arg1 === 'object' && arg1 !== null) {
    return `${arg1.label}_${arg1.tile}#${arg1.frame}`;
  } else {
    return `${arg1}_${arg2}${typeof arg3 === 'number' ? `#${arg3}` : '#0'}`;
  }
}
