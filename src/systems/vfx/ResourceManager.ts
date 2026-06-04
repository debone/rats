/**
 * Budgeted, evicting pool of persistent VFX resources (one per effect `id`).
 *
 * - lazy create on first `acquire`
 * - reference counting for continuous effects (an attached effect pins its
 *   emitter alive while the host lives)
 * - idle eviction: a resource untouched for `idleTtlMs` and not retained/pinned
 *   is disposed on the next `sweep`
 * - a hard cap (`maxLive`) that forces LRU/priority eviction on `acquire`
 * - explicit `pin`/`warm` so critical effects are pre-created and never
 *   evicted mid-game
 *
 */

import type { EmitterBackedDef, VfxPriority } from './types';

const DEFAULT_MAX_LIVE = 24;
const DEFAULT_IDLE_TTL_MS = 10_000;

const PRIORITY_RANK: Record<VfxPriority, number> = {
  ambient: 0,
  normal: 1,
  critical: 2,
};

interface Lease<T> {
  def: EmitterBackedDef;
  resource: T;
  pinned: boolean;
  refCount: number;
  lastUsed: number;
}

export interface ResourcePoolOptions<T> {
  /**
   * Hard cap on simultaneously-live resources before eviction kicks in.
   */
  maxLive?: number;
  /**
   * Idle time before an unreferenced, unpinned resource is swept.
   */
  idleTtlMs?: number;
  /**
   * Build the backing resource for an effect (e.g. `new ParticleEmitter(def.emitter())`).
   */
  create: (def: EmitterBackedDef) => T;
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

  constructor(options: ResourcePoolOptions<T>) {
    this.maxLive = options.maxLive ?? DEFAULT_MAX_LIVE;
    this.idleTtlMs = options.idleTtlMs ?? DEFAULT_IDLE_TTL_MS;
    this.create = options.create;
    this.dispose = options.dispose;
    this.now = options.now ?? (() => performance.now());
  }

  get size() {
    return this.leases.size;
  }

  has(id: string) {
    return this.leases.has(id);
  }

  acquire(def: EmitterBackedDef) {
    const existing = this.leases.get(def.id);
    if (existing) {
      existing.lastUsed = this.now();
      return existing.resource;
    }

    if (this.leases.size >= this.maxLive) {
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

  /**
   * Acquire and add a reference.
   * The resource cannot be evicted while referenced.
   */
  retain(def: EmitterBackedDef): T {
    const resource = this.acquire(def);
    this.leases.get(def.id)!.refCount++;
    return resource;
  }

  /**
   * Drop a reference previously added by `retain`.
   */
  release(id: string): void {
    const lease = this.leases.get(id);
    if (!lease) return;
    if (lease.refCount > 0) lease.refCount--;
    lease.lastUsed = this.now();
  }

  /**
   * Pre-create a resource and lock it against eviction (boss prep).
   */
  pin(def: EmitterBackedDef): T {
    const resource = this.acquire(def);
    this.leases.get(def.id)!.pinned = true;
    return resource;
  }

  /**
   * Pre-create a resource without pinning, so the first real use has no allocation cost.
   */
  warm(def: EmitterBackedDef): T {
    return this.acquire(def);
  }

  /**
   * Dispose every resource idle longer than the TTL and not referenced/pinned.
   */
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

  /**
   * Dispose all resources. With `keepPinned`, pinned resources (ambient screen filters) survive.
   */
  disposeAll(disposePinned = true): void {
    for (const [id, lease] of this.leases) {
      if (!disposePinned && lease.pinned) continue;
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
