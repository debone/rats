/**
 * MESH: Electric Plasma Arcs
 *
 * A plasma ball with MeshRope lightning arcs. Each arc is a MeshRope whose
 * points are displaced from the straight center→anchor line using smoothed
 * random jitter — regenerated rapidly to mimic electrical discharge.
 *
 * The glow cross-section texture (bright white core → cyan halo → transparent)
 * gives each arc its characteristic neon-tube appearance without any shaders.
 *
 * One arc tracks the mouse, pulling electrical energy toward the cursor.
 * The rest arc toward fixed anchors and update their jitter independently,
 * so each bolt looks different every frame.
 *
 * Cannot be done with Graphics: Graphics lines have no UV cross-section glow
 * and would require manual polygon math per bolt without smooth width.
 */
import { BlurFilter, Container, Graphics, MeshRope, Point, Texture, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { demoMouse } from '../demoMouse';
import { app } from '@/main';

const N_ARCS    = 5;
const N_SEGS    = 28;
const JITTER_HZ = 18;   // how often bolts regenerate their path

function makeArcTex(): Texture {
  // Cross-section of the arc: bright white core, cyan mid, transparent edges
  // Rendered as a 1×32 gradient (height=32 → rope is 32px thick)
  const g = new Graphics();
  const H = 32;
  for (let y = 0; y < H; y++) {
    const v = Math.abs(y / H * 2 - 1);  // 0 at center, 1 at edges
    const alpha = Math.pow(1 - v, 2.2);
    const t = Math.max(0, 1 - v * 1.8);
    const r = Math.round(lerp(0x44, 0xff, t));
    const gg = Math.round(lerp(0x88, 0xff, t));
    const b = 0xff;
    g.rect(0, y, 4, 1).fill({ color: (r << 16) | (gg << 8) | b, alpha });
  }
  const tex = app.renderer.generateTexture(g);
  g.destroy();
  return tex;
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function smoothJitter(N: number, amp: number): Float32Array {
  const raw = new Float32Array(N);
  for (let i = 0; i < N; i++) raw[i] = (Math.random() - 0.5) * 2;
  // Two-pass box smooth
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 1; i < N - 1; i++) raw[i] = (raw[i - 1] + raw[i] * 2 + raw[i + 1]) / 4;
  }
  raw[0] = 0; raw[N - 1] = 0;
  const envelope = (i: number) => Math.sin((i / (N - 1)) * Math.PI);
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) out[i] = raw[i] * amp * envelope(i);
  return out;
}

export function electricArcs(root: Container, w: number, h: number): () => void {
  const cx = w / 2, cy = h / 2;

  const label = new Text({
    text: 'MESH: Electric plasma arcs — MeshRope bolts with jitter-regenerated paths. Move mouse near orb.',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x88ddff, letterSpacing: 1 },
  });
  label.x = 6; label.y = 6;
  root.addChild(label);

  const bg = new Graphics().rect(0, 16, w, h - 16).fill(0x040810);
  root.addChild(bg);

  const arcTex = makeArcTex();

  // Fixed anchor positions for arcs 1-4
  const anchors = [
    { x: w * 0.12, y: h * 0.3  },
    { x: w * 0.88, y: h * 0.28 },
    { x: w * 0.18, y: h * 0.75 },
    { x: w * 0.82, y: h * 0.72 },
  ];

  // Create N_ARCS ropes (last one tracks mouse)
  const allPoints: Point[][] = [];
  const ropes: MeshRope[] = [];
  const jitters: Float32Array[] = [];
  const jitterTimers: number[] = [];

  for (let a = 0; a < N_ARCS; a++) {
    const pts = Array.from({ length: N_SEGS }, () => new Point(cx, cy));
    const rope = new MeshRope({ texture: arcTex, points: pts });
    rope.tint = a === N_ARCS - 1 ? 0xffffff : 0xaaddff;
    rope.alpha = 0.85;
    root.addChild(rope);
    allPoints.push(pts);
    ropes.push(rope);
    jitters.push(smoothJitter(N_SEGS, 18));
    jitterTimers.push(Math.random());
  }

  // Dim anchor halos
  const anchorGlows: Graphics[] = [];
  for (const anc of anchors) {
    const g = new Graphics().circle(0, 0, 6).fill({ color: 0x4499ff, alpha: 0.4 });
    g.x = anc.x; g.y = anc.y;
    root.addChild(g);
    anchorGlows.push(g);
  }

  // Central orb (layered glow)
  const orb = new Container();
  const orbBase = new Graphics().circle(0, 0, 22).fill({ color: 0x88ccff, alpha: 0.15 });
  const orbMid  = new Graphics().circle(0, 0, 14).fill({ color: 0xaaddff, alpha: 0.35 });
  const orbCore = new Graphics().circle(0, 0, 7).fill(0xffffff);
  orb.addChild(orbBase, orbMid, orbCore);
  orb.x = cx; orb.y = cy;
  root.addChild(orb);

  // Glow blur on orb
  const blurredOrb = new Graphics().circle(0, 0, 14).fill({ color: 0x66bbff, alpha: 0.6 });
  blurredOrb.filters = [new BlurFilter({ strength: 12 })];
  blurredOrb.x = cx; blurredOrb.y = cy;
  root.addChild(blurredOrb);

  let mouseX = cx, mouseY = cy;
  const onMove = (e: MouseEvent) => { const m = demoMouse(e); mouseX = m.x; mouseY = m.y; };
  window.addEventListener('mousemove', onMove);

  let t = 0;

  const tick = (dt: { deltaMS: number }) => {
    const s = dt.deltaMS / 1000;
    t += s;

    // Pulse orb
    const pulse = 0.85 + 0.15 * Math.sin(t * 7.3);
    orbCore.scale.set(pulse);
    orbBase.alpha = 0.10 + 0.10 * Math.sin(t * 3.1);

    for (let a = 0; a < N_ARCS; a++) {
      // Determine anchor
      const anchor = a < N_ARCS - 1
        ? anchors[a]
        : { x: mouseX, y: mouseY };

      // Regenerate jitter at JITTER_HZ
      jitterTimers[a] += s;
      if (jitterTimers[a] > 1 / JITTER_HZ) {
        jitterTimers[a] = 0;
        const dist = Math.hypot(anchor.x - cx, anchor.y - cy);
        jitters[a] = smoothJitter(N_SEGS, Math.min(dist * 0.18, 30));
      }

      const pts = allPoints[a];
      const ax = anchor.x, ay = anchor.y;
      const dx = ax - cx, dy = ay - cy;
      const len = Math.hypot(dx, dy) || 1;
      // Perpendicular direction
      const px = -dy / len, py = dx / len;

      for (let i = 0; i < N_SEGS; i++) {
        const frac = i / (N_SEGS - 1);
        pts[i].x = cx + dx * frac + px * jitters[a][i];
        pts[i].y = cy + dy * frac + py * jitters[a][i];
      }

      // Flicker alpha
      ropes[a].alpha = 0.6 + 0.4 * Math.random();
    }
  };

  app.ticker.add(tick);

  return () => {
    window.removeEventListener('mousemove', onMove);
    app.ticker.remove(tick);
    arcTex.destroy(true);
    [label, bg, orb, blurredOrb, ...anchorGlows, ...ropes].forEach(e => e.destroy({ children: true }));
  };
}
