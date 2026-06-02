import { ballTrail } from './effects/ballTrail';
import { bossEntrance } from './effects/bossEntrance';
import { brickBreak } from './effects/brickBreak';
import { doorOpen } from './effects/doorOpen';
import { explosionBurst } from './effects/explosion';
import { fireContinuous } from './effects/fireContinuous';
import { fountainContinuous } from './effects/fountainContinuous';
import { impactSpark } from './effects/impactSpark';
import { levelCompleted } from './effects/levelCompleted';
import { lightningStrike } from './effects/lightningStrike';
import { orbAura } from './effects/orbAura';
import { rainContinuous } from './effects/rainContinuous';
import { bloomEffect } from './effects/screen/bloom';
import { crtEffect } from './effects/screen/crt';
import { reflectionEffect } from './effects/screen/reflection';
import { trailBloom } from './effects/screen/trailBloom';
import { starAura } from './effects/starAura';
import { starCollect } from './effects/starCollect';
import { swordSwing } from './effects/swordSwing';
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
  // Gameplay effects
  brickBreak,
  ballTrail,
  bossEntrance,
  doorOpen,
  levelCompleted,
  // Particle bursts
  impactSpark,
  starCollect,
  explosionBurst,
  // Continuous particle attachees
  starAura,
  orbAura,
  fireContinuous,
  fountainContinuous,
  rainContinuous,
  // Sequences
  swordSwing,
  lightningStrike,
  // Screen filters
  crtEffect,
  reflectionEffect,
  bloomEffect,
  trailBloom,
];
