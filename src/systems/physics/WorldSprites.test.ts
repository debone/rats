import { describe, expect, it, vi } from 'vitest';

// phaser-box2d isn't available in the unit-test environment (it loads WASM at
// import time and crashes node). We mock just the surface used by
// WorldSprites.ts — only b2Body_GetTransform is exercised by BodyToSprite.
vi.mock('phaser-box2d', () => ({
  b2Body_GetTransform: vi.fn(),
  b2Body_IsValid: vi.fn(() => true),
  b2DestroyBody: vi.fn(),
}));

import { b2Body_GetTransform } from 'phaser-box2d';
import { BodyToSprite } from './WorldSprites';
import { PXM } from '@/consts';

function setTransform(x: number, y: number, angle: number): void {
  vi.mocked(b2Body_GetTransform).mockReturnValueOnce({
    p: { x, y },
    q: { c: Math.cos(angle), s: Math.sin(angle) },
    // The real return type has more fields but BodyToSprite only reads p and q.
  } as unknown as ReturnType<typeof b2Body_GetTransform>);
}

const fakeBodyId = {} as Parameters<typeof BodyToSprite>[0];
const origin = { x: 0, y: 0 };

describe('BodyToSprite', () => {
  it('places a sprite at the body position when no offset', () => {
    setTransform(2, 3, 0);
    const sprite = { x: 0, y: 0, rotation: 0 };
    BodyToSprite(fakeBodyId, sprite, origin);
    expect(sprite.x).toBe(2 * PXM);
    expect(sprite.y).toBe(-3 * PXM);
    expect(sprite.rotation).toBe(0);
  });

  it('rotates the offset with the body angle', () => {
    // Body at origin rotated +π/2 (CCW) in Box2D space → screen rotation -π/2 (CW)
    // An offset of (PXM, 0) should rotate to (0, -PXM) in screen space.
    setTransform(0, 0, Math.PI / 2);
    const sprite = { x: 0, y: 0, rotation: 0 };
    BodyToSprite(fakeBodyId, sprite, origin, PXM, 0);
    expect(sprite.x).toBeCloseTo(0, 5);
    expect(sprite.y).toBeCloseTo(-PXM, 5);
  });

  it('adds localRotation on top of the body rotation', () => {
    setTransform(0, 0, Math.PI / 4); // Box2D rotation +π/4 ⇒ screen -π/4
    const sprite = { x: 0, y: 0, rotation: 0 };
    BodyToSprite(fakeBodyId, sprite, origin, 0, 0, Math.PI / 2);
    expect(sprite.rotation).toBeCloseTo(-Math.PI / 4 + Math.PI / 2, 5);
  });

  it('honors shouldRotate=false', () => {
    setTransform(0, 0, Math.PI / 3);
    const sprite = { x: 0, y: 0, rotation: 0, shouldRotate: false };
    BodyToSprite(fakeBodyId, sprite, origin);
    expect(sprite.rotation).toBe(0);
  });
});
