import type { EffectDef } from './types';

/**
 * A content-agnostic registry the {@link VFXSystem} reads at init to wire effects
 * that self-trigger (`on:`), auto-enable pinned screen filters, and populate the
 * debug panel.
 *
 * It holds no hard-coded list and imports no effects — that would couple the engine
 * (`core/vfx`) to game content. Instead the content side (`gameplay/vfx`) discovers
 * its effects (via `import.meta.glob`) and calls {@link registerEffects}; the
 * composition root imports that module once at startup so registration happens
 * before any system init.
 */
const effects: EffectDef[] = [];

/** Register effect defs (deduped by id). Called by the gameplay-side discovery. */
export function registerEffects(...defs: EffectDef[]): void {
  for (const def of defs) {
    if (!effects.some((e) => e.id === def.id)) effects.push(def);
  }
}

/** The registered effects, in registration order. */
export function registeredEffects(): readonly EffectDef[] {
  return effects;
}
