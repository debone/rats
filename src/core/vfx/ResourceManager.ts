import type { EmitterBackedDef, VfxPriority } from './types';

/**
 * Budgeted, evicting pool of persistent VFX resources (one per effect `id`).
 *
 * This is the heart of the VFX lifecycle. Naively, an effect's emitter would be
 * created on first use and only freed on screen teardown — which both lets the
 * set of live emitters grow unbounded across a level (no headroom left when a
 * boss enters) and never reclaims emitters that fired once at level start and
 * are never used again. This pool instead treats every resource as **leased,
 * budgeted, and reclaimable**:
 *
 * - lazy create on first `acquire`
 * - reference counting for continuous effects (an attached effect pins its
 *   emitter alive while the host lives)
 * - idle eviction: a resource untouched for `idleTtlMs` and not retained/pinned
 *   is disposed on the next `sweep`
 * - a hard cap (`maxLive`) that forces LRU/priority eviction on `acquire`
 * - explicit `pin`/`warm` so boss-critical effects are pre-created and never
 *   evicted mid-fight
 *
 * It is deliberately PixiJS-agnostic: creation/disposal/clock are injected, so
 * the policy is unit-testable without a renderer.
 */

const DEFAULT_MAX_LIVE = 24;
const DEFAULT_IDLE_TTL_MS = 10_000;

/** Eviction preference: lower number is shed first. */
const PRIORITY_RANK: Record<VfxPriority, number> = {
  ambient: 0,
  normal: 1,
  critical: 2,
};

interface Lease<T> {
  def: EmitterBackedDef;
  resource: T;
  pinned: boolean;
  /** Live attachments depending on this resource; > 0 blocks eviction. */
  refCount: number;
  lastUsed: number;
}

export interface ResourcePoolOptions<T> {
  /** Hard cap on simultaneously-live resources before eviction kicks in. */
  maxLive?: number;
  /** Idle time before an unreferenced, unpinned resource is swept. */
  idleTtlMs?: number;
  /** Build the backing resource for an effect (e.g. `new ParticleEmitter(def.emitter())`). */
  create: (def: EmitterBackedDef) => T;
  /** Tear the resource down (e.g. `emitter.destroy()`). */
  dispose: (resource: T) => void;
  /** Clock, injectable for tests. Defaults to `performance.now`. */
  now?: () => number;
}

export class VfxResourcePool<T> {
  private leases = new Map<string, Lease<T>>();
  private readonly maxLive: number;
  private readonly idleTtlMs: number;
  private readonly create: (def: EmitterBackedDef) => T;
  private readonly dispose: (resource: T) => void;
  private readonly now: () => number;

  constructor(opts: ResourcePoolOptions<T>) {
    this.maxLive = opts.maxLive ?? DEFAULT_MAX_LIVE;
    this.idleTtlMs = opts.idleTtlMs ?? DEFAULT_IDLE_TTL_MS;
    this.create = opts.create;
    this.dispose = opts.dispose;
    this.now = opts.now ?? (() => performance.now());
  }

  /** Number of live resources (mainly for tests/metrics). */
  get size(): number {
    return this.leases.size;
  }

  has(id: string): boolean {
    return this.leases.has(id);
  }

  /** Get-or-create the resource for `def`, marking it freshly used. */
  acquire(def: EmitterBackedDef): T {
    const existing = this.leases.get(def.id);
    if (existing) {
      existing.lastUsed = this.now();
      return existing.resource;
    }

    if (this.leases.size >= this.maxLive) {
      // Make room. If nothing is evictable we still create (correctness over
      // budget) — the sweep will catch up once something becomes idle.
      this.evictOne();
    }

    const resource = this.create(def);
    this.leases.set(def.id, {
      def,
      resource,
      pinned: false,
      refCount: 0,
      lastUsed: this.now(),
    });
    return resource;
  }

  /** Acquire and add a reference (continuous effects). The resource cannot be evicted while referenced. */
  retain(def: EmitterBackedDef): T {
    const resource = this.acquire(def);
    this.leases.get(def.id)!.refCount++;
    return resource;
  }

  /** Drop a reference previously added by `retain`. */
  release(id: string): void {
    const lease = this.leases.get(id);
    if (!lease) return;
    if (lease.refCount > 0) lease.refCount--;
    lease.lastUsed = this.now();
  }

  /** Pre-create a resource and lock it against eviction (boss prep). */
  pin(def: EmitterBackedDef): T {
    const resource = this.acquire(def);
    this.leases.get(def.id)!.pinned = true;
    return resource;
  }

  /** Pre-create a resource without pinning, so the first real use has no allocation cost. */
  warm(def: EmitterBackedDef): T {
    return this.acquire(def);
  }

  /** Dispose every resource idle longer than the TTL and not referenced/pinned. */
  sweep(): void {
    const cutoff = this.now() - this.idleTtlMs;
    for (const [id, lease] of this.leases) {
      if (lease.pinned || lease.refCount > 0) continue;
      if (lease.lastUsed <= cutoff) {
        this.dispose(lease.resource);
        this.leases.delete(id);
      }
    }
  }

  /** Dispose all resources. With `keepPinned`, pinned resources (ambient screen filters) survive. */
  disposeAll(opts: { keepPinned?: boolean } = {}): void {
    for (const [id, lease] of this.leases) {
      if (opts.keepPinned && lease.pinned) continue;
      this.dispose(lease.resource);
      this.leases.delete(id);
    }
  }

  /**
   * Evict a single resource to stay under `maxLive`. Picks the lowest-priority,
   * unreferenced, unpinned lease, breaking ties by oldest `lastUsed`. Returns
   * whether anything was evicted.
   */
  private evictOne(): boolean {
    let victim: { id: string; lease: Lease<T> } | null = null;
    for (const [id, lease] of this.leases) {
      if (lease.pinned || lease.refCount > 0) continue;
      if (!victim) {
        victim = { id, lease };
        continue;
      }
      const vRank = PRIORITY_RANK[victim.lease.def.priority ?? 'normal'];
      const cRank = PRIORITY_RANK[lease.def.priority ?? 'normal'];
      if (cRank < vRank || (cRank === vRank && lease.lastUsed < victim.lease.lastUsed)) {
        victim = { id, lease };
      }
    }
    if (!victim) return false;
    this.dispose(victim.lease.resource);
    this.leases.delete(victim.id);
    return true;
  }
}
