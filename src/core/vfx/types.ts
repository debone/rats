import type { Camera } from '@/core/camera/camera';
import type { EntityBase } from '@/core/entity/scope';
import type { EmitterConfig, ParticleEmitter } from '@/core/particles/ParticleEmitter';
import type { GameEventName } from '@/data/events';
import type { Container, Filter } from 'pixi.js';

/**
 * VFX system — shared types.
 *
 * Every visual effect is a self-contained module exporting an `EffectDef`
 * discriminated by `kind`. The `VFXSystem` reads `kind` to know how to manage
 * the effect's GPU resources (pooled emitter, full-screen filter, …) and the
 * runtime budget.
 *
 * The four kinds map onto the four ways VFX shows up in the game:
 * - `burst`      localized one-shot (brick debris, hit spark)
 * - `continuous` lifetime-bound, attached to a host entity (trail, aura)
 * - `screen`     full-screen post-processing filter (CRT, reflection, bloom)
 * - `sequence`   composed, timed, multi-step (boss entrance)
 *
 * NOTE: Phase 1 implements `burst` end-to-end. `continuous`, `screen` and
 * `sequence` are defined here so effect authors and the system share one shape,
 * but their runtime handling lands in later phases.
 */

/** Under resource/CPU pressure the budget sheds `ambient` first, then `normal`; `critical` is never dropped. */
export type VfxPriority = 'critical' | 'normal' | 'ambient';

interface BaseDef {
  /** Stable, unique id — also the key for the effect's pooled resource. */
  id: string;
  /** Defaults to `normal`. Drives eviction order and the per-frame play cap. */
  priority?: VfxPriority;
  /**
   * Optional self-declared global trigger. When set, the system subscribes this
   * effect to the given `GameEvent` at init — keeping the binding in the effect's
   * own file rather than a central table. Local entity emitters (e.g. a brick's
   * `broken`) are not global events; those fire the effect by reference via
   * `vfx.play(def, params)`.
   */
  on?: GameEventName;
}

/** Context handed to a burst effect's `play` — the pooled emitter plus the scene it draws into. */
export interface BurstContext {
  emitter: ParticleEmitter;
  camera: Camera;
  layer: Container;
}

/** Localized one-shot effect. Reuses a single persistent, budgeted emitter via `explode`. */
export interface BurstDef<P = void> extends BaseDef {
  kind: 'burst';
  /** Config for the persistent emitter the system lazily creates once and reuses. */
  emitter: () => EmitterConfig;
  play(params: P, ctx: BurstContext): void;
  /** Coalesce repeat triggers: skip if this effect fired less than `cooldownMs` ago. */
  cooldownMs?: number;
}

/** Context handed to a continuous effect's `attach`. */
export interface ContinuousContext {
  emitter?: ParticleEmitter;
  camera: Camera;
  layer: Container;
}

/** Lifetime-bound effect, attached to a host entity (Phase 3). */
export interface ContinuousDef<P = void, H extends EntityBase = EntityBase> extends BaseDef {
  kind: 'continuous';
  emitter?: () => EmitterConfig;
  attach(host: H, params: P, ctx: ContinuousContext): void;
}

/** Full-screen post-processing filter (Phase 2). */
export interface ScreenDef extends BaseDef {
  kind: 'screen';
  create(): Filter;
  /** Where the filter attaches. Defaults to the camera viewport. */
  target?: 'viewport' | 'stage';
  /** Per-frame uniform animation (replaces the inline `filter.time += dt/…` in main.ts). */
  update?(filter: Filter, dtMs: number): void;
  /** Long-lived ambient filters stay resident across screens. */
  pin?: boolean;
}

/** Context handed to a sequence effect's `build`. */
export interface SequenceContext {
  camera: Camera;
  layer: Container;
}

/** Composed, timed, multi-step effect — delegates to the cutscene timeline (Phase 4). */
export interface SequenceDef<P = void> extends BaseDef {
  kind: 'sequence';
  build(params: P, ctx: SequenceContext): Promise<void> | void;
}

export type EffectDef<P = any> = BurstDef<P> | ContinuousDef<P> | ScreenDef | SequenceDef<P>;

/** Effects that own a pooled `ParticleEmitter` resource keyed by `id`. */
export type EmitterBackedDef = BurstDef<any> | ContinuousDef<any>;

/** Identity helper that preserves the precise `BurstDef<P>` type for call-site inference. */
export function defineBurst<P = void>(def: BurstDef<P>): BurstDef<P> {
  return def;
}

/** Identity helper for any effect kind. */
export function defineEffect<D extends EffectDef>(def: D): D {
  return def;
}
