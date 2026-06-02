/**
 * ENVIRONMENT: Ambient Fog — soft parallax layers
 *
 * The fix vs. the previous version: blobs are now Sprites using the
 * soft-puff texture (concentric circles at decreasing alpha) instead of
 * filled Graphics ellipses. A hard-edged ellipse at 5% alpha looks like
 * a faint smudge; a feathered-edge sprite at 30% alpha looks like fog.
 *
 * Three layers at different speeds = parallax depth cue.
 * Two faint "depth lights" stay fixed while fog drifts past them.
 */
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';
import { makeSoftPuffTexture } from '../particleTextures';

interface FogBlob {
  sprite: Sprite;
  baseY: number;
  phase: number;
  speed: number;
  halfW: number; // sprite half-width in world space (for wrap detection)
}

export function ambientFog(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let time = 0;

  const puffTex = makeSoftPuffTexture();

  // ─── Background ───────────────────────────────────────────────────────
  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x04050e);
  // Subtle vertical gradient suggestion: darker floor, slightly lighter ceiling
  bg.rect(0, 0, w, h * 0.4).fill({ color: 0x06080f, alpha: 0.4 });
  root.addChild(bg);

  // Fixed depth lights — fog passes IN FRONT of these
  const lightsG = new Graphics();
  // Left glow: cold blue (distant lamp)
  lightsG.circle(w * 0.18, h * 0.38, 40).fill({ color: 0x1133aa, alpha: 0.08 });
  lightsG.circle(w * 0.18, h * 0.38, 16).fill({ color: 0x4466ff, alpha: 0.06 });
  // Right glow: sickly green (bioluminescent fungus)
  lightsG.circle(w * 0.78, h * 0.55, 30).fill({ color: 0x114422, alpha: 0.10 });
  lightsG.circle(w * 0.78, h * 0.55, 10).fill({ color: 0x33aa55, alpha: 0.07 });
  root.addChild(lightsG);

  // ─── Build fog layers ─────────────────────────────────────────────────
  const allBlobs: FogBlob[] = [];
  const containers = [new Container(), new Container(), new Container()];
  containers.forEach((c) => root.addChild(c));

  const layerDefs = [
    // far: large, slow, cold blue-grey, behind everything
    { container: containers[0], count: 8,  scaleMin: 3.8, scaleMax: 5.5, alpha: 0.28, tint: 0x7788bb, speedMin: 5,  speedMax: 11, yMin: 0.05, yMax: 0.92 },
    // mid
    { container: containers[1], count: 9,  scaleMin: 2.5, scaleMax: 4.0, alpha: 0.30, tint: 0x8899aa, speedMin: 14, speedMax: 22, yMin: 0.10, yMax: 0.88 },
    // near: smaller, faster, slightly warmer
    { container: containers[2], count: 7,  scaleMin: 1.8, scaleMax: 3.0, alpha: 0.22, tint: 0xaab8cc, speedMin: 28, speedMax: 40, yMin: 0.15, yMax: 0.82 },
  ];

  for (const def of layerDefs) {
    for (let i = 0; i < def.count; i++) {
      const scale = def.scaleMin + Math.random() * (def.scaleMax - def.scaleMin);
      const sprite = new Sprite(puffTex);
      sprite.anchor.set(0.5);
      sprite.scale.set(scale);
      sprite.tint = def.tint;
      sprite.alpha = def.alpha * (0.7 + Math.random() * 0.5);
      sprite.x = Math.random() * (w + 80) - 40;
      const baseY = h * (def.yMin + Math.random() * (def.yMax - def.yMin));
      sprite.y = baseY;
      def.container.addChild(sprite);

      allBlobs.push({
        sprite,
        baseY,
        phase: Math.random() * Math.PI * 2,
        speed: def.speedMin + Math.random() * (def.speedMax - def.speedMin),
        halfW: (puffTex.width / 2) * scale,
      });
    }
  }

  const label = new Text({
    text: 'ENV: AMBIENT FOG — feathered sprite blobs at 3 parallax depths',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x1a2a4a, letterSpacing: 1 },
  });
  label.x = 6;
  label.y = 6;
  root.addChild(label);

  const tick = (dt: { deltaMS: number }) => {
    if (cancelled) return;
    const delta = dt.deltaMS / 1000;
    time += delta;

    for (const b of allBlobs) {
      b.sprite.x += b.speed * delta;
      // Gentle vertical float
      b.sprite.y = b.baseY + Math.sin(time * 0.3 + b.phase) * 8;
      // Seamless horizontal wrap
      if (b.sprite.x - b.halfW > w + 10) {
        b.sprite.x = -b.halfW - 10;
      }
    }
  };

  app.ticker.add(tick);

  return () => {
    cancelled = true;
    app.ticker.remove(tick);
    puffTex.destroy(true);
    [bg, lightsG, ...containers, label].forEach((e) => e.destroy());
  };
}
