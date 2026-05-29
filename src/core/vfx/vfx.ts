import { getGameContext } from '@/data/game-context';
import { VFXSystem } from './VFXSystem';
import type { BurstDef, EmitterBackedDef, ScreenDef } from './types';

/**
 * Ambient accessor for the VFX system, mirroring `getGameContext()` / `sfx`.
 *
 * Call sites stay terse and type-safe: `vfx.play(brickBreak, { x, y })`. Passing
 * the imported effect (not a string id) gives parameter inference and
 * go-to-definition. Resolves to the `VFXSystem` instance on the live game
 * context, so it must only be used while the gameplay systems are mounted.
 */
export const vfx = {
  /** Fire a one-shot burst effect. */
  play<P>(def: BurstDef<P>, params: P): void {
    getGameContext().systems.get(VFXSystem).play(def, params);
  },

  /** Pre-create + lock emitters so a later burst never allocates mid-fight. */
  pin(...defs: EmitterBackedDef[]): void {
    getGameContext().systems.get(VFXSystem).pin(...defs);
  },

  /** Pre-create emitters without locking, so first use has no allocation cost. */
  warm(...defs: EmitterBackedDef[]): void {
    getGameContext().systems.get(VFXSystem).warm(...defs);
  },

  /** Toggle a full-screen filter at runtime. */
  screen(def: ScreenDef): { enable(): void; disable(): void } {
    return getGameContext().systems.get(VFXSystem).screen(def);
  },
};
