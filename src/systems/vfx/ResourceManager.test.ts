import { describe, expect, it } from 'vitest';
import { VfxResourcePool } from './ResourceManager';
import type { BurstDef, EmitterBackedDef } from './types';

/** Minimal fake "resource" — just a tag so we can assert identity and disposal. */
interface FakeResource {
  id: string;
  disposed: boolean;
}

/** Build a burst-shaped def; only `id`/`priority` matter to the pool. */
function def(id: string, priority?: EmitterBackedDef['priority']): BurstDef {
  return {
    kind: 'burst',
    id,
    priority,
    emitter: () => ({}) as never,
    play: () => {},
  };
}

/** A pool with a controllable clock and a record of created/disposed resources. */
function makePool(opts?: { maxLive?: number; idleTtlMs?: number }) {
  let clock = 0;
  const created: FakeResource[] = [];
  const pool = new VfxResourcePool<FakeResource>({
    maxLive: opts?.maxLive,
    idleTtlMs: opts?.idleTtlMs,
    now: () => clock,
    create: (d) => {
      const r: FakeResource = { id: d.id, disposed: false };
      created.push(r);
      return r;
    },
    dispose: (r) => {
      r.disposed = true;
    },
  });
  return {
    pool,
    created,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe('VfxResourcePool', () => {
  it('lazily creates one resource per id and reuses it', () => {
    const { pool, created } = makePool();
    const a1 = pool.acquire(def('a'));
    const a2 = pool.acquire(def('a'));
    expect(a1).toBe(a2);
    expect(created).toHaveLength(1);
    expect(pool.size).toBe(1);
  });

  it('sweeps resources idle beyond the TTL', () => {
    const { pool, created, advance } = makePool({ idleTtlMs: 1000 });
    pool.acquire(def('a'));
    advance(1500);
    pool.sweep();
    expect(created[0].disposed).toBe(true);
    expect(pool.has('a')).toBe(false);
  });

  it('does not sweep a resource that was used within the TTL', () => {
    const { pool, advance } = makePool({ idleTtlMs: 1000 });
    pool.acquire(def('a'));
    advance(500);
    pool.acquire(def('a')); // touch
    advance(700); // 700 since last use < 1000
    pool.sweep();
    expect(pool.has('a')).toBe(true);
  });

  it('never sweeps pinned or referenced resources', () => {
    const { pool, advance } = makePool({ idleTtlMs: 1000 });
    pool.pin(def('pinned'));
    pool.retain(def('retained'));
    advance(5000);
    pool.sweep();
    expect(pool.has('pinned')).toBe(true);
    expect(pool.has('retained')).toBe(true);
  });

  it('release lets a previously-retained resource be swept', () => {
    const { pool, advance } = makePool({ idleTtlMs: 1000 });
    pool.retain(def('a'));
    pool.release('a');
    advance(1500);
    pool.sweep();
    expect(pool.has('a')).toBe(false);
  });

  it('evicts the lowest-priority resource when over the live cap', () => {
    const { pool } = makePool({ maxLive: 2 });
    pool.acquire(def('normal', 'normal'));
    pool.acquire(def('ambient', 'ambient'));
    // Third acquire is over cap → ambient (lowest priority) is evicted.
    pool.acquire(def('critical', 'critical'));
    expect(pool.has('ambient')).toBe(false);
    expect(pool.has('normal')).toBe(true);
    expect(pool.has('critical')).toBe(true);
  });

  it('breaks eviction ties by oldest last-used', () => {
    const { pool, advance } = makePool({ maxLive: 2 });
    pool.acquire(def('old', 'normal'));
    advance(100);
    pool.acquire(def('new', 'normal'));
    advance(100);
    pool.acquire(def('third', 'normal')); // over cap → evict the oldest 'old'
    expect(pool.has('old')).toBe(false);
    expect(pool.has('new')).toBe(true);
    expect(pool.has('third')).toBe(true);
  });

  it('keeps pinned resources but disposes the rest on disposeAll({ keepPinned })', () => {
    const { pool } = makePool();
    pool.pin(def('pinned'));
    pool.acquire(def('transient'));
    pool.disposeAll(false);
    expect(pool.has('pinned')).toBe(true);
    expect(pool.has('transient')).toBe(false);
  });
});
