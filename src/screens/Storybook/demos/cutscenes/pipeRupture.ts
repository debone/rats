import { animate } from 'animejs';
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { shake } from '@/core/camera/effects/shake';
import { getGameContext } from '@/data/game-context';
import { makeDropletTexture, makeShardTexture, makeSoftPuffTexture, makeSparkTexture } from '../particleTextures';

export function pipeRupture(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const ctx = getGameContext();

  const cx = w / 2;
  const cy = h / 2 - 6;

  // Bake particle textures once — destroyed in cleanup
  const puffTex = makeSoftPuffTexture();
  const sparkTex = makeSparkTexture();
  const dropletTex = makeDropletTexture();
  const shardTex = makeShardTexture();

  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x060808);
  bg.alpha = 0;
  root.addChild(bg);

  // Horizontal pipe running across center
  const pipe = new Graphics();
  pipe
    .roundRect(0, cy - 8, w, 16, 4)
    .fill(0x4a3a28)
    .stroke({ color: 0x2a1a10, width: 1 });
  pipe.alpha = 0;
  root.addChild(pipe);

  // Pipe seam details
  const pipeSeams = new Graphics();
  for (let x = 24; x < w; x += 36) {
    pipeSeams
      .rect(x, cy - 8, 2, 16)
      .fill({ color: 0x1a1008, alpha: 0.6 });
  }
  pipeSeams.alpha = 0;
  root.addChild(pipeSeams);

  // Crack lines radiating from rupture point
  const cracks = new Graphics();
  root.addChild(cracks);

  // Rust stain spreading below rupture
  const rustStain = new Graphics();
  root.addChild(rustStain);

  /**
   * Steam puff layer: soft-gradient circles billow upward.
   * Feathered edges blend together into a convincing pressure cloud.
   */
  const steam = new ParticleEmitter({
    texture: puffTex,
    maxParticles: 80,
    emitting: false,
    lifespan: { min: 200, max: 500 },
    speed: { min: 40, max: 140 },
    angle: { min: 240, max: 300 },
    scale: { start: { min: 0.2, max: 0.6 }, end: 1.2 },
    tint: { start: 0xaabbaa, end: 0x606860 },
    alpha: { start: 0.55, end: 0 },
  });
  steam.x = cx;
  steam.y = cy - 8;
  root.addChild(steam.container);

  /**
   * Spark jets layered on top of steam: thin elongated lines shoot outward.
   * Two emitters (puff + spark) stacked = soft cloud base with hard-edge jets.
   * This "soft base + hard detail" pairing is standard VFX composition.
   */
  const steamJets = new ParticleEmitter({
    texture: sparkTex,
    maxParticles: 50,
    emitting: false,
    lifespan: { min: 100, max: 300 },
    speed: { min: 60, max: 200 },
    angle: { min: 245, max: 295 },
    scale: { start: { min: 0.1, max: 0.35 }, end: 0 },
    tint: { start: 0xddeedd, end: 0x8aaa8a },
    alpha: { start: 0.7, end: 0 },
    rotate: { min: -20, max: 20 },
  });
  steamJets.x = cx;
  steamJets.y = cy - 8;
  root.addChild(steamJets.container);

  /**
   * Droplet water spray: teardrop shapes fly sideways under gravity.
   * Each droplet elongates naturally as it decelerates — more physical than circles.
   */
  const waterSpray = new ParticleEmitter({
    texture: dropletTex,
    maxParticles: 60,
    emitting: false,
    lifespan: { min: 300, max: 700 },
    speed: { min: 60, max: 180 },
    angle: { min: 150, max: 210 },
    scale: { start: { min: 0.08, max: 0.2 }, end: 0 },
    tint: { start: 0x304848, end: 0x102828 },
    alpha: { start: 0.9, end: 0 },
    gravityY: 120,
  });
  waterSpray.x = cx;
  waterSpray.y = cy;
  root.addChild(waterSpray.container);

  /**
   * Shard debris: jagged polygon chips tumble outward under gravity.
   * Irregular silhouette reads as concrete/pipe fragments rather than pebbles.
   */
  const debris = new ParticleEmitter({
    texture: shardTex,
    maxParticles: 40,
    emitting: false,
    lifespan: { min: 400, max: 900 },
    speed: { min: 30, max: 120 },
    angle: { min: 220, max: 320 },
    scale: { start: { min: 0.12, max: 0.3 }, end: 0 },
    tint: { start: 0x6a5a40, end: 0x2a1a08 },
    alpha: { start: 1, end: 0 },
    rotate: { min: -300, max: 300 },
    gravityY: 180,
  });
  debris.x = cx;
  debris.y = cy;
  root.addChild(debris.container);

  const warningText = new Text({
    text: '⚠  PIPE FAILURE  ⚠',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 9, letterSpacing: 3, fill: 0x8a4a20, fontWeight: 'bold' },
  });
  warningText.anchor.set(0.5);
  warningText.x = cx;
  warningText.y = h - 20;
  warningText.alpha = 0;
  root.addChild(warningText);

  const CRACK_ANGLES = [20, 55, 120, 170, 200, 250, 310, 350];

  const drawCracks = (progress: number) => {
    cracks.clear();
    CRACK_ANGLES.forEach((deg, i) => {
      const rad = (deg * Math.PI) / 180;
      const len = (12 + i * 3) * progress;
      const branches = i % 3 === 0;
      cracks
        .moveTo(cx, cy)
        .lineTo(cx + Math.cos(rad) * len, cy + Math.sin(rad) * len)
        .stroke({ color: 0x1a0808, width: 1 + (i % 2), alpha: 0.8 });

      if (branches && progress > 0.6) {
        const bRad = rad + 0.4;
        const bLen = len * 0.4;
        cracks
          .moveTo(cx + Math.cos(rad) * len * 0.6, cy + Math.sin(rad) * len * 0.6)
          .lineTo(
            cx + Math.cos(rad) * len * 0.6 + Math.cos(bRad) * bLen,
            cy + Math.sin(rad) * len * 0.6 + Math.sin(bRad) * bLen,
          )
          .stroke({ color: 0x1a0808, width: 1, alpha: 0.5 });
      }
    });
  };

  let steamInterval: ReturnType<typeof setInterval> | undefined;
  let warningPulse: ReturnType<typeof animate> | null = null;

  const play = async () => {
    if (cancelled) return;

    bg.alpha = 0;
    pipe.alpha = 0;
    pipeSeams.alpha = 0;
    cracks.clear();
    rustStain.clear();
    warningText.alpha = 0;
    clearInterval(steamInterval);
    warningPulse?.cancel();

    await animate(bg, { alpha: 1, duration: 400 });
    if (cancelled) return;

    await Promise.all([
      animate(pipe, { alpha: 1, duration: 350 }),
      animate(pipeSeams, { alpha: 1, duration: 400 }),
    ]);
    if (cancelled) return;

    // Pressure building — pipe vibrates
    const vp = { x: 0 };
    await animate(vp, {
      x: [0, 1.5, -1.5, 1, -1, 0],
      duration: 600,
      ease: 'linear',
      onUpdate: () => {
        pipe.x = vp.x;
      },
    });
    if (cancelled) return;

    // RUPTURE
    shake(ctx.camera, { intensity: 9, duration: 450, frequency: 20 });

    // Cracks spread fast
    const cp = { p: 0 };
    await animate(cp, {
      p: 1,
      duration: 380,
      ease: 'outQuad',
      onUpdate: () => {
        drawCracks(cp.p);
      },
    });
    if (cancelled) return;

    // Burst — all four emitters fire simultaneously
    steam.explode(50);
    steamJets.explode(30);
    waterSpray.explode(40);
    debris.explode(30);

    // Rust stain spreads below
    const rp = { r: 0 };
    animate(rp, {
      r: 18,
      duration: 600,
      ease: 'outQuad',
      onUpdate: () => {
        rustStain
          .clear()
          .ellipse(cx, cy + 8, rp.r * 1.4, rp.r * 0.5)
          .fill({ color: 0x6a2a08, alpha: 0.4 });
      },
    });

    // Continuous steam spray
    steamInterval = setInterval(() => {
      if (cancelled) {
        clearInterval(steamInterval);
        return;
      }
      steam.explode(3);
      steamJets.explode(2);
      waterSpray.explode(2);
    }, 80);

    await animate(warningText, { alpha: 1, duration: 400 });
    if (cancelled) return;

    warningPulse = animate(warningText, { alpha: [1, 0.3, 1], duration: 700, loop: true });

    await new Promise<void>((res) => {
      timer = setTimeout(res, 2200);
    });
    if (cancelled) return;

    clearInterval(steamInterval);
    warningPulse.cancel();

    await Promise.all([
      animate(bg, { alpha: 0, duration: 500 }),
      animate(pipe, { alpha: 0, duration: 400 }),
      animate(pipeSeams, { alpha: 0, duration: 400 }),
      animate(warningText, { alpha: 0, duration: 350 }),
    ]);
    cracks.clear();
    rustStain.clear();
    pipe.x = 0;
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 600);
    });
    if (!cancelled) play();
  };

  play();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    clearInterval(steamInterval);
    warningPulse?.cancel();
    steam.destroy();
    steamJets.destroy();
    waterSpray.destroy();
    debris.destroy();
    puffTex.destroy(true);
    sparkTex.destroy(true);
    dropletTex.destroy(true);
    shardTex.destroy(true);
    [bg, pipe, pipeSeams, cracks, rustStain, warningText].forEach((e) => e.destroy());
  };
}
