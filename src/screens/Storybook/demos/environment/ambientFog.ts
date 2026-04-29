/**
 * ENVIRONMENT: Ambient Fog / Atmosphere
 *
 * Parallax fog: each layer scrolls at a different speed. The eye reads
 * different speeds as different Z-depths without any true 3D.
 *
 * Layer recipe:
 * - Far layer (slowest): very low alpha, large blobs, cold blue-grey tint
 * - Mid layer:           medium alpha, medium blobs
 * - Near layer (fastest): slightly higher alpha, smaller but visible
 *
 * Each blob position is updated per-frame. When it exits the right edge
 * it wraps back to the left — seamless because blobs are soft/transparent.
 *
 * Depth lighting: two faint "light sources" glow through the fog
 * as dim circles; the effect suggests lamps or bioluminescence.
 */
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';

interface FogBlob {
  x: number;
  y: number;
  baseY: number;
  rx: number;
  ry: number;
  phase: number;
  speed: number;
}

export function ambientFog(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let time = 0;

  // Background: deep underground black
  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x04050e);
  root.addChild(bg);

  // Distant "lights" (glow blobs that stay fixed — the fog passes in front)
  const lights = new Graphics();
  lights.circle(w * 0.25, h * 0.35, 30).fill({ color: 0x3344aa, alpha: 0.06 });
  lights.circle(w * 0.25, h * 0.35, 12).fill({ color: 0x6688ff, alpha: 0.04 });
  lights.circle(w * 0.72, h * 0.6, 22).fill({ color: 0x226633, alpha: 0.05 });
  lights.circle(w * 0.72, h * 0.6, 8).fill({ color: 0x44cc66, alpha: 0.04 });
  root.addChild(lights);

  // ─── Fog layer containers ─────────────────────────────────────────────
  // We draw blobs as individual Graphics per-frame into a shared Graphics
  const fogFar  = new Graphics(); root.addChild(fogFar);
  const fogMid  = new Graphics(); root.addChild(fogMid);
  const fogNear = new Graphics(); root.addChild(fogNear);

  // Build blob data per layer
  const makeBlobLayer = (count: number, speedMin: number, speedMax: number, rxMin: number, rxMax: number, yRange: [number, number]): FogBlob[] =>
    Array.from({ length: count }, (_, i) => {
      const x = Math.random() * (w + 80) - 40;
      const baseY = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
      return {
        x,
        y: baseY,
        baseY,
        rx: rxMin + Math.random() * (rxMax - rxMin),
        ry: (rxMin + Math.random() * (rxMax - rxMin)) * (0.4 + Math.random() * 0.25),
        phase: Math.random() * Math.PI * 2,
        speed: speedMin + Math.random() * (speedMax - speedMin),
      };
    });

  const blobsFar  = makeBlobLayer(8,  5,  12, 50, 80, [h * 0.1, h * 0.9]);
  const blobsMid  = makeBlobLayer(9,  14, 24, 36, 60, [h * 0.15, h * 0.85]);
  const blobsNear = makeBlobLayer(7,  30, 42, 22, 38, [h * 0.2, h * 0.8]);

  const drawLayer = (g: Graphics, blobs: FogBlob[], alpha: number, color: number) => {
    g.clear();
    for (const b of blobs) {
      const yOff = Math.sin(time * 0.4 + b.phase) * 6;
      g.ellipse(b.x, b.baseY + yOff, b.rx, b.ry).fill({ color, alpha });
    }
  };

  const label = new Text({
    text: 'ENV: AMBIENT FOG — parallax layers at 3 depths, seamless horizontal scroll',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x1a2a4a, letterSpacing: 1 },
  });
  label.x = 6;
  label.y = 6;
  root.addChild(label);

  const labelB = new Text({
    text: 'far (slow, cold) → mid → near (fast, warmer)  |  dim lights glow through',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 6, fill: 0x0e1828, letterSpacing: 1 },
  });
  labelB.x = 6;
  labelB.y = h - 12;
  root.addChild(labelB);

  const tick = (dt: { deltaMS: number }) => {
    if (cancelled) return;
    const delta = dt.deltaMS / 1000;
    time += delta;

    // Scroll blobs rightward, wrap when they exit the right edge
    for (const b of [...blobsFar, ...blobsMid, ...blobsNear]) {
      b.x += b.speed * delta;
      if (b.x - b.rx > w + 20) b.x = -b.rx - 20;
    }

    drawLayer(fogFar,  blobsFar,  0.055, 0x7788bb);
    drawLayer(fogMid,  blobsMid,  0.075, 0x8899aa);
    drawLayer(fogNear, blobsNear, 0.07,  0xaabbcc);
  };

  app.ticker.add(tick);

  return () => {
    cancelled = true;
    app.ticker.remove(tick);
    [bg, lights, fogFar, fogMid, fogNear, label, labelB].forEach((e) => e.destroy());
  };
}
