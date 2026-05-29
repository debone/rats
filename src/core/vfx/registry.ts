import { ballTrail } from './effects/ballTrail';
import { bossEntrance } from './effects/bossEntrance';
import { brickBreak } from './effects/brickBreak';
import { bloomEffect } from './effects/screen/bloom';
import { crtEffect } from './effects/screen/crt';
import { reflectionEffect } from './effects/screen/reflection';
import type { EffectDef } from './types';

/**
 * The catalog of all VFX effects. The `VFXSystem` walks this at init to wire up
 * any effect that declares a self-trigger via `on:`. Effects without `on:` are
 * fired imperatively by reference (`vfx.play(def, params)`); listing them here
 * is still useful for warming/pinning and discoverability.
 *
 * Add new effects here as they are authored.
 */
export const VFX_EFFECTS: EffectDef[] = [
  brickBreak,
  ballTrail,
  bossEntrance,
  crtEffect,
  reflectionEffect,
  bloomEffect,
];
