/**
 * ENVIRONMENT: Fireflies / Bioluminescence
 *
 * 30 fireflies perform slow Brownian drift with independent pulsing.
 * The "alive" read comes from three details:
 * 1. Each fly has its own pulse frequency and phase — they never sync
 * 2. Speed changes during the pulse cycle (faster when dim, hovering when bright)
 * 3. Two tint groups: warm yellow (firefly) and cool cyan (bioluminescent fungus)
 *    — mixing both in one scene prevents the "uniform decoration" feeling
 *
 * The background silhouettes give the flies spatial context; without any
 * environmental anchoring, drifting dots just look like a screensaver.
 */
import { Container, Graphics, RenderTexture, Sprite, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';

interface Firefly {
  sprite: Sprite;
  glowSprite: Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  freq: number;       // pulse frequency (radians/sec)
  tint: number;
  glowTint: number;
}

function makeFireflyTexture(): RenderTexture {
  const g = new Graphics();
  g.circle(0, 0, 8).fill({ color: 0xffffff, alpha: 0.04 });
  g.circle(0, 0, 5).fill({ color: 0xffffff, alpha: 0.12 });
  g.circle(0, 0, 3).fill({ color: 0xffffff, alpha: 0.55 });
  g.circle(0, 0, 1.5).fill({ color: 0xffffff, alpha: 0.95 });
  const tex = app.renderer.generateTexture(g);
  g.destroy();
  return tex;
}

function makeGlowTexture(): RenderTexture {
  const g = new Graphics();
  g.circle(0, 0, 18).fill({ color: 0xffffff, alpha: 0.03 });
  g.circle(0, 0, 12).fill({ color: 0xffffff, alpha: 0.06 });
  g.circle(0, 0, 7).fill({ color: 0xffffff, alpha: 0.09 });
  const tex = app.renderer.generateTexture(g);
  g.destroy();
  return tex;
}

export function fireflies(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let time = 0;

  const flyTex  = makeFireflyTexture();
  const glowTex = makeGlowTexture();

  // ─── Background: sewer cavern silhouettes ────────────────────────────
  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x030508);
  root.addChild(bg);

  // Arch outlines along the top (architectural depth)
  const silhouette = new Graphics();
  const archW = w / 3;
  for (let i = 0; i < 3; i++) {
    const ax = i * archW + archW / 2;
    silhouette.arc(ax, 0, archW * 0.38, 0, Math.PI).fill(0x070a0f);
  }
  // Stalactites hanging from ceiling
  for (let x = 10; x < w; x += 18 + Math.floor(Math.random() * 10)) {
    const sh = 14 + Math.random() * 22;
    silhouette.poly([x, 0, x + 5, 0, x + 2.5, sh]).fill(0x060809);
  }
  // Floor with rubble suggestions
  silhouette.rect(0, h - 18, w, 18).fill(0x060809);
  for (let x = 0; x < w; x += 14 + Math.random() * 8) {
    silhouette.ellipse(x + 5, h - 18, 6 + Math.random() * 4, 3).fill(0x07090c);
  }
  root.addChild(silhouette);

  // ─── Fungal glow patches on walls ────────────────────────────────────
  const fungi = new Graphics();
  [[w * 0.08, h * 0.55], [w * 0.91, h * 0.42], [w * 0.45, h * 0.72]].forEach(([fx, fy]) => {
    fungi.circle(fx, fy, 14).fill({ color: 0x114433, alpha: 0.12 });
    fungi.circle(fx, fy, 6).fill({ color: 0x33aa66, alpha: 0.06 });
  });
  root.addChild(fungi);

  // ─── Fireflies ────────────────────────────────────────────────────────
  const flyCont = new Container();
  root.addChild(flyCont);

  const WARM  = [0xffee44, 0xffdd22, 0xffffaa];
  const COOL  = [0x44ffcc, 0x66ffee, 0x88ffdd];
  const flies: Firefly[] = [];

  for (let i = 0; i < 30; i++) {
    const isCool = i < 10;
    const tint      = isCool ? COOL[i % COOL.length] : WARM[(i - 10) % WARM.length];
    const glowTint  = tint;

    const sprite = new Sprite(flyTex);
    sprite.anchor.set(0.5);
    sprite.tint = tint;

    const glowSprite = new Sprite(glowTex);
    glowSprite.anchor.set(0.5);
    glowSprite.tint = glowTint;

    flyCont.addChild(glowSprite);
    flyCont.addChild(sprite);

    flies.push({
      sprite,
      glowSprite,
      x: 10 + Math.random() * (w - 20),
      y: h * 0.1 + Math.random() * (h * 0.75),
      vx: (Math.random() - 0.5) * 20,
      vy: (Math.random() - 0.5) * 20,
      phase: Math.random() * Math.PI * 2,
      freq: 0.6 + Math.random() * 1.4,
      tint,
      glowTint,
    });
  }

  const label = new Text({
    text: 'ENV: FIREFLIES — Brownian drift, independent pulse phase + freq, warm + cool mix',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x1a2a1a, letterSpacing: 1 },
  });
  label.x = 6;
  label.y = 6;
  root.addChild(label);

  const BOUNDS = { left: 4, right: w - 4, top: 18, bottom: h - 18 };
  const MAX_SPEED = 30;

  const tick = (dt: { deltaMS: number }) => {
    if (cancelled) return;
    const delta = dt.deltaMS / 1000;
    time += delta;

    for (const f of flies) {
      const pulse = (Math.sin(time * f.freq + f.phase) + 1) * 0.5; // 0..1

      // Faster when dim (darting), slower when bright (hovering)
      const speedMul = 0.3 + (1 - pulse) * 0.7;
      f.vx += (Math.random() - 0.5) * 22 * delta;
      f.vy += (Math.random() - 0.5) * 22 * delta;
      f.vx *= 0.94;
      f.vy *= 0.94;
      const speed = Math.sqrt(f.vx * f.vx + f.vy * f.vy);
      if (speed > MAX_SPEED) { f.vx *= MAX_SPEED / speed; f.vy *= MAX_SPEED / speed; }

      f.x += f.vx * speedMul * delta;
      f.y += f.vy * speedMul * delta;

      // Soft boundary repulsion
      if (f.x < BOUNDS.left)   { f.vx += 40 * delta; }
      if (f.x > BOUNDS.right)  { f.vx -= 40 * delta; }
      if (f.y < BOUNDS.top)    { f.vy += 40 * delta; }
      if (f.y > BOUNDS.bottom) { f.vy -= 40 * delta; }

      f.sprite.x = f.x;
      f.sprite.y = f.y;
      f.sprite.alpha = 0.3 + pulse * 0.7;

      f.glowSprite.x = f.x;
      f.glowSprite.y = f.y;
      f.glowSprite.alpha = pulse * 0.55;
    }
  };

  app.ticker.add(tick);

  return () => {
    cancelled = true;
    app.ticker.remove(tick);
    flyTex.destroy(true);
    glowTex.destroy(true);
    [bg, silhouette, fungi, flyCont, label].forEach((e) => e.destroy());
  };
}
