/**
 * Procedural particle textures baked via generateTexture.
 * All shapes are drawn in white so the emitter's tint config handles color.
 * Call these inside a setup function (not module scope) so the renderer is ready.
 */
import { Graphics, RenderTexture } from 'pixi.js';
import { app } from '@/main';

/** Teardrop — round head, tapered tip pointing down. Use for water drips, blood, sewage. */
export function makeDropletTexture(): RenderTexture {
  const g = new Graphics();
  g.circle(0, -3, 4).fill(0xffffff);
  g.poly([0, 5, -3, -1, 3, -1]).fill(0xffffff);
  const tex = app.renderer.generateTexture(g);
  g.destroy();
  return tex;
}

/**
 * Soft puff — concentric circles at decreasing alpha, hard centre.
 * Gives particles a cloud-like "feathered edge" look.
 * Use for fog, smoke, steam.
 */
export function makeSoftPuffTexture(): RenderTexture {
  const g = new Graphics();
  g.circle(0, 0, 12).fill({ color: 0xffffff, alpha: 0.06 });
  g.circle(0, 0, 9).fill({ color: 0xffffff, alpha: 0.12 });
  g.circle(0, 0, 6).fill({ color: 0xffffff, alpha: 0.28 });
  g.circle(0, 0, 4).fill({ color: 0xffffff, alpha: 0.55 });
  g.circle(0, 0, 2).fill({ color: 0xffffff, alpha: 0.9 });
  const tex = app.renderer.generateTexture(g);
  g.destroy();
  return tex;
}

/** Jagged polygon chip — irregular shard shape. Use for debris, concrete fragments, metal. */
export function makeShardTexture(): RenderTexture {
  const g = new Graphics();
  g.poly([0, -7, 4, -2, 6, 3, 2, 7, -2, 5, -5, 1, -4, -4]).fill(0xffffff);
  const tex = app.renderer.generateTexture(g);
  g.destroy();
  return tex;
}

/** Ring outline with small highlight. Use for rising bubbles, soap, underwater. */
export function makeBubbleTexture(): RenderTexture {
  const g = new Graphics();
  g.circle(0, 0, 7).stroke({ color: 0xffffff, width: 1.5, alpha: 0.8 });
  g.ellipse(-2, -2, 2, 1).fill({ color: 0xffffff, alpha: 0.35 });
  const tex = app.renderer.generateTexture(g);
  g.destroy();
  return tex;
}

/**
 * Central blob with radial micro-drops.
 * Use for spray paint, liquid splat, blood impact.
 */
export function makeSplatTexture(): RenderTexture {
  const g = new Graphics();
  g.circle(0, 0, 5).fill(0xffffff);
  const COUNT = 7;
  for (let i = 0; i < COUNT; i++) {
    const ang = (i / COUNT) * Math.PI * 2;
    const dist = 7 + (i % 3);
    g.circle(Math.cos(ang) * dist, Math.sin(ang) * dist, 1.5 + (i % 2) * 0.5).fill({
      color: 0xffffff,
      alpha: 0.65,
    });
  }
  const tex = app.renderer.generateTexture(g);
  g.destroy();
  return tex;
}

/** Thin elongated line — use for sparks, electrical arcs, high-pressure steam jets. */
export function makeSparkTexture(): RenderTexture {
  const g = new Graphics();
  g.rect(-1, -7, 2, 14).fill(0xffffff);
  g.rect(-0.5, -7, 1, 14).fill({ color: 0xffffff, alpha: 0.5 });
  const tex = app.renderer.generateTexture(g);
  g.destroy();
  return tex;
}

/** Four toe-pads + palm pad cluster. Use for rat trails and paw-print particles. */
export function makePawPrintTexture(): RenderTexture {
  const g = new Graphics();
  g.ellipse(0, 3, 4, 3).fill(0xffffff);
  g.circle(-3, -1, 1.8).fill(0xffffff);
  g.circle(-1, -4, 1.8).fill(0xffffff);
  g.circle(1, -4, 1.8).fill(0xffffff);
  g.circle(3, -1, 1.8).fill(0xffffff);
  const tex = app.renderer.generateTexture(g);
  g.destroy();
  return tex;
}
