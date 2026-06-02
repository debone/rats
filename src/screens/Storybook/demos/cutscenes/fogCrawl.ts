import { animate } from 'animejs';
import { createTimeline } from 'animejs';
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { makeDropletTexture } from '../particleTextures';
import { app } from '@/main';
import { defineSequence } from '@/core/vfx/types';
import type { SequenceContext } from '@/core/vfx/types';

/**
 * CUTSCENE: Fog Crawl  [sequence]
 *
 * Parallax fog layers scroll through a sewer. Red eyes materialize in the murk.
 * VFX type: defineSequence — complete choreographed moment with clear start/end.
 */

const NUM_FOG_LAYERS = 4;

const fogCrawlSequence = defineSequence<{ w: number; h: number }>({
  kind: 'sequence',
  id: 'fogCrawl',
  async build({ w, h }, { layer }) {
    const cx = w / 2;
    const cy = h / 2;

    // Bake particle textures once — destroyed in cleanup
    const dropletTex = makeDropletTexture();

    const bg = new Graphics();
    bg.rect(0, 0, w, h).fill(0x030406);
    bg.alpha = 0;
    layer.addChild(bg);

    // Faint floor line
    const floor = new Graphics();
    floor
      .moveTo(0, cy + 20)
      .lineTo(w, cy + 20)
      .stroke({ color: 0x1a1818, width: 1 });
    floor.alpha = 0;
    layer.addChild(floor);

    // Fog layers — each is a set of large soft ellipses scrolling at different speeds.
    interface FogLayer {
      container: Container;
      speed: number;
      offsetX: number;
    }
    const fogLayers: FogLayer[] = [];

    for (let l = 0; l < NUM_FOG_LAYERS; l++) {
      const fogContainer = new Container();
      fogContainer.alpha = 0;
      layer.addChild(fogContainer);

      const NUM_BLOBS = 5;
      const baseAlpha = 0.07 + l * 0.04;

      for (let b = 0; b < NUM_BLOBS; b++) {
        const blob = new Graphics();
        const bx = (b / NUM_BLOBS) * w * 1.4 - w * 0.2;
        const by = cy + 5 + (l - 1) * 6 + (b % 2) * 4;
        const rx = 30 + Math.random() * 20;
        const ry = 11 + Math.random() * 8;
        blob
          .ellipse(bx, by, rx, ry)
          .fill({ color: 0x1a2a1a, alpha: baseAlpha });
        fogContainer.addChild(blob);
      }

      fogLayers.push({
        container: fogContainer,
        speed: 8 + l * 5,
        offsetX: 0,
      });
    }

    const drips = new ParticleEmitter({
      texture: dropletTex,
      maxParticles: 20,
      emitting: false,
      lifespan: { min: 600, max: 1200 },
      speed: { min: 30, max: 60 },
      angle: { min: 88, max: 92 },
      scale: { start: { min: 0.18, max: 0.38 }, end: 0.04 },
      tint: { start: 0x304040, end: 0x101818 },
      alpha: { start: 0.7, end: 0 },
    });
    drips.y = 0;
    layer.addChild(drips.container);

    // Red eyes in the fog (appear later)
    const eyesContainer = new Container();
    eyesContainer.alpha = 0;
    layer.addChild(eyesContainer);

    const EYE_PAIRS = [
      { x: cx - 24, y: cy + 5 },
      { x: cx + 18, y: cy + 2 },
      { x: cx - 8, y: cy + 10 },
    ];

    EYE_PAIRS.forEach(({ x, y }) => {
      const leftEye = new Graphics();
      leftEye
        .ellipse(x - 3, y, 2.5, 1.5)
        .fill({ color: 0xcc1100, alpha: 0.9 });
      eyesContainer.addChild(leftEye);

      const rightEye = new Graphics();
      rightEye
        .ellipse(x + 3, y, 2.5, 1.5)
        .fill({ color: 0xcc1100, alpha: 0.9 });
      eyesContainer.addChild(rightEye);
    });

    const warningText = new Text({
      text: "you're not alone",
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, letterSpacing: 2, fill: 0x5a2a2a },
    });
    warningText.anchor.set(0.5);
    warningText.x = cx;
    warningText.y = cy - 28;
    warningText.alpha = 0;
    layer.addChild(warningText);

    let dripTimer = 0;

    const tick = (dt: { deltaMS: number }) => {
      const delta = dt.deltaMS / 1000;
      dripTimer += dt.deltaMS;

      fogLayers.forEach((fogLayer) => {
        fogLayer.offsetX = (fogLayer.offsetX + fogLayer.speed * delta) % (w * 1.4);
        fogLayer.container.x = -fogLayer.offsetX;
      });

      if (dripTimer > 250) {
        dripTimer = 0;
        drips.x = 10 + Math.random() * (w - 20);
        drips.explode(1);
      }
    };

    app.ticker.add(tick);

    await animate(bg, { alpha: 1, duration: 500 });

    await animate(floor, { alpha: 1, duration: 400 });

    // Fog layers drift in staggered
    await Promise.all(
      fogLayers.map((fogLayer, i) =>
        animate(fogLayer.container, {
          alpha: 1,
          duration: 700,
          delay: i * 200,
        }),
      ),
    );

    await new Promise<void>((res) => setTimeout(res, 1200));

    // Eyes materialize through fog
    const eyePulse1 = animate(eyesContainer, { alpha: [0, 1, 0.6, 1], duration: 800, ease: 'outQuad' });
    await eyePulse1;

    const eyePulse2 = animate(eyesContainer, { alpha: [1, 0.3, 1], duration: 700, loop: true });

    await animate(warningText, { alpha: 1, duration: 600 });

    await new Promise<void>((res) => setTimeout(res, 2000));

    eyePulse2.cancel();

    await Promise.all([
      animate(bg, { alpha: 0, duration: 600 }),
      animate(floor, { alpha: 0, duration: 400 }),
      animate(eyesContainer, { alpha: 0, duration: 500 }),
      animate(warningText, { alpha: 0, duration: 400 }),
      ...fogLayers.map((l) => animate(l.container, { alpha: 0, duration: 500 })),
    ]);

    // Cleanup
    app.ticker.remove(tick);
    drips.destroy();
    dropletTex.destroy(true);
    [bg, floor, eyesContainer, warningText, ...fogLayers.map((l) => l.container)].forEach((e) => e.destroy());
  },
});

export function fogCrawl(root: Container, w: number, h: number): () => void {
  let cancelled = false;

  const ctx: SequenceContext = {
    camera: null as any,
    layer: root,
    stage: root,
    size: { width: w, height: h },
    cutscene: () => Promise.resolve(),
    timeline: () => createTimeline(),
  };

  const loop = async () => {
    while (!cancelled) {
      await fogCrawlSequence.build({ w, h }, ctx);
      await new Promise<void>((res) => setTimeout(res, 600));
    }
  };
  loop();

  return () => {
    cancelled = true;
  };
}
