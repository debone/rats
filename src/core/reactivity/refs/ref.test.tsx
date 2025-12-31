import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRef } from "./ref";

describe("Refs", () => {
  // Mock window.currentScene
  beforeEach(() => {
    (window as any).currentScene = {
      tweens: {
        add: vi.fn(),
      },
    };
  });

  it("should handle basic ref updates", () => {
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
