import { type AttachHandle, type EntityBase } from '@/core/entity/scope';
import { getGameContext } from '@/data/game-context';
import { VFXSystem } from './VFXSystem';
import type { BurstDef, ContinuousDef, EmitterBackedDef, PositionSource, ScreenDef, SequenceDef } from './types';

/**
 * Ambient accessor for the VFX system, mirroring `getGameContext()` / `sfx`.
 *
 * Call sites stay terse and type-safe: `vfx.play(brickBreak, { x, y })`. Passing
 * the imported effect (not a string id) gives parameter inference and
 * go-to-definition. Resolves to the `VFXSystem` instance on the live game
 * context, so it must only be used while the gameplay systems are mounted.
 */
interface VfxAccessor {
  /** Fire a one-shot burst effect. */
  play<P>(def: BurstDef<P>, params: P): void;
  /** Run a composed, timed sequence; resolves when it completes (awaitable / yield-able). */
  play<P>(def: SequenceDef<P>, params: P): Promise<void>;
  /** Pre-create + lock emitters so a later burst never allocates mid-fight. */
  pin(...defs: EmitterBackedDef[]): void;
  /** Pre-create emitters without locking, so first use has no allocation cost. */
  warm(...defs: EmitterBackedDef[]): void;
  /** Toggle a full-screen filter at runtime. */
  screen(def: ScreenDef): { enable(): void; disable(): void };
  /** Attach a continuous effect to a host entity, optionally following a position source. */
  attach<P, H extends EntityBase>(
    def: ContinuousDef<P, H>,
    host: H,
    params: P,
    position?: PositionSource,
  ): AttachHandle<void>;
}

export const vfx = {
  play<P>(def: BurstDef<P> | SequenceDef<P>, params: P): void | Promise<void> {
    return getGameContext().systems.get(VFXSystem).play(def as SequenceDef<P>, params);
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

  /**
   * Attach a continuous effect to a host entity. Returns a handle whose `detach()`
   * can be called early; the attachment is also torn down automatically when the
   * host entity is destroyed.
   *
   * Pass a `position` source (`followBody`/`followNode`/`followPoint`) to anchor
   * the effect to anything that moves — a body, a UI node, a fixed point.
   *
   * Call this after the entity is fully constructed (not from inside its factory scope).
   */
  attach<P, H extends EntityBase>(
    def: ContinuousDef<P, H>,
    host: H,
    params: P,
    position?: PositionSource,
  ): AttachHandle<void> {
    return getGameContext().systems.get(VFXSystem).attach(def, host, params, position);
  },
} as VfxAccessor;
