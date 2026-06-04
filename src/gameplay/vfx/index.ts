import { registerEffects } from '@/systems/vfx/registry';
import type { EffectDef } from '@/systems/vfx/types';

/**
 * Auto-discovers every VFX effect defined in this folder (and `screen/`) and
 * registers it with the engine's `VFXSystem` — no manual catalog to maintain. Drop
 * a new `*.ts` exporting a `defineBurst/Sequence/Continuous/Screen` def here and
 * it's picked up. Importing this module once (from the composition root) performs
 * the registration as a side effect.
 */
const KINDS = new Set(['burst', 'continuous', 'sequence', 'screen']);

function isEffectDef(x: unknown): x is EffectDef {
  if (!x || typeof x !== 'object') return false;
  const def = x as { kind?: unknown; id?: unknown };
  return typeof def.id === 'string' && typeof def.kind === 'string' && KINDS.has(def.kind);
}

// Eagerly import sibling effect modules; the `isEffectDef` filter ignores this
// index's own exports (and any non-def helpers), so a self-match is harmless.
const modules = import.meta.glob(['./**/*.ts'], { eager: true }) as Record<string, Record<string, unknown>>;

const discovered: EffectDef[] = [];
for (const mod of Object.values(modules)) {
  for (const exported of Object.values(mod)) {
    if (isEffectDef(exported)) discovered.push(exported);
  }
}

registerEffects(...discovered);

/** The discovered effect defs (also registered with `VFXSystem` on import). */
export const GAMEPLAY_VFX_EFFECTS: readonly EffectDef[] = discovered;
