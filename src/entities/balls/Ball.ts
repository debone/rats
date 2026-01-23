import type { b2BodyId } from 'phaser-box2d';
import type { Sprite } from 'pixi.js';

export interface Ball {
  bodyId: b2BodyId;
  sprite: Sprite;

  powerUp(): void;
  powerDown(): void;

  update(delta: number): void;
  destroy(): void;
}
