import { describe, expect, it } from 'vitest';
import { createRef } from './ref';

describe('Refs', () => {
  it('should handle basic ref updates', () => {
    const gameObject: { x: number; y: number } = {
      x: 10,
      y: 10,
    };

    const ref = createRef<typeof gameObject>();
    ref._current = gameObject;

    expect(gameObject.x).toBe(10);
    expect(ref.x.get()).toBe(10);
    expect(gameObject.x).toBe(10);

    ref.y.set(100);
    expect(gameObject.y).toBe(100);
  });
});
