/**
 * ENVIRONMENT: Procedural Spiderweb
 *
 * Construction:
 * 1. N radial spokes from center out to radius R
 * 2. M concentric rings — each ring connects adjacent spoke-intersection points
 *    with a small random inward displacement (organic, not perfectly circular)
 * 3. Sway: a "wind" float oscillates slowly; each node's rest position is nudged
 *    proportional to (distance from anchor / R) × wind — tips sway more than root
 *
 * The web is anchored in the upper-left corner so it reads as "spanning an arch."
 *
 * Dew drops: at 15% of ring-spoke intersections, draw a small luminous dot.
 * Spider: a tiny circle that crawls toward the center on a path following the spoke.
 */
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';

const SPOKE_COUNT = 9;
const RING_COUNT  = 7;
const WEB_R       = 0; // filled in from w/h

interface WebNode {
  baseX: number;
  baseY: number;
  ring: number;   // 0 = center
  spoke: number;
}

export function spiderweb(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let time = 0;

  const anchorX = w * 0.08;
  const anchorY = h * 0.05;
  const webR = Math.min(w, h) * 0.72;

  // ─── Dungeon corner background ────────────────────────────────────────
  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x080608);
  // Stone wall texture (left wall + top ceiling)
  for (let y = 0; y < h; y += 14) {
    bg.rect(0, y, w * 0.22, 1).fill({ color: 0x060406, alpha: 0.7 });
  }
  for (let x = 0; x < w * 0.22; x += 28) {
    bg.rect(x, 0, 1, h).fill({ color: 0x060406, alpha: 0.5 });
  }
  bg.rect(0, 0, 1, h).fill(0x100c10);        // left wall edge
  bg.rect(0, 0, w * 0.22, 1).fill(0x100c10); // ceiling edge
  root.addChild(bg);

  // Crack decoration near anchor
  const cracks = new Graphics();
  cracks.moveTo(anchorX, anchorY + 4).lineTo(anchorX + 8, anchorY + 16).stroke({ color: 0x1a101a, width: 0.8 });
  cracks.moveTo(anchorX + 8, anchorY + 16).lineTo(anchorX + 5, anchorY + 28).stroke({ color: 0x1a101a, width: 0.6 });
  root.addChild(cracks);

  // ─── Build web node grid ──────────────────────────────────────────────
  // Fan of spokes spanning ~100° (upper-left quadrant, roughly 180°→280° from right)
  const ANGLE_START = Math.PI * 0.05;  // just below horizontal-right
  const ANGLE_SPAN  = Math.PI * 0.95;  // 170° fan

  const nodes: WebNode[][] = []; // nodes[ring][spoke]

  // Ring 0 = center (one node shared by all spokes)
  for (let ring = 0; ring <= RING_COUNT; ring++) {
    const row: WebNode[] = [];
    for (let s = 0; s < SPOKE_COUNT; s++) {
      const angle = ANGLE_START + (s / (SPOKE_COUNT - 1)) * ANGLE_SPAN;
      const dist = (ring / RING_COUNT) * webR;
      // Small irregular displacement for organic look (seeded by ring+spoke)
      const disp = ring > 0 ? (Math.sin(ring * 7.3 + s * 2.9) * 0.04 + Math.cos(ring * 3.1 + s * 5.7) * 0.03) * webR : 0;
      row.push({
        baseX: anchorX + Math.cos(angle) * (dist + disp),
        baseY: anchorY + Math.sin(angle) * (dist + disp),
        ring,
        spoke: s,
      });
    }
    nodes.push(row);
  }

  // ─── Dew drop positions ───────────────────────────────────────────────
  const dewDrops: { ring: number; spoke: number }[] = [];
  for (let ring = 1; ring <= RING_COUNT; ring++) {
    for (let s = 0; s < SPOKE_COUNT; s++) {
      if (Math.random() < 0.18) dewDrops.push({ ring, spoke: s });
    }
  }

  // ─── Spider position ──────────────────────────────────────────────────
  let spiderSpoke = 0;
  let spiderRing  = RING_COUNT;  // starts at outer edge, walks inward
  let spiderRingF = RING_COUNT;  // fractional for smooth movement

  // ─── Drawing container ────────────────────────────────────────────────
  const webG = new Graphics();
  root.addChild(webG);

  const label = new Text({
    text: 'ENV: SPIDERWEB — procedural spokes + rings with sway + dew drops',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x2a1a2a, letterSpacing: 1 },
  });
  label.x = 6;
  label.y = 6;
  root.addChild(label);

  const getNodePos = (ring: number, spoke: number, wind: number): { x: number; y: number } => {
    if (ring < 0 || ring > RING_COUNT) return { x: anchorX, y: anchorY };
    const n = nodes[ring][spoke];
    const sway = (n.ring / RING_COUNT) * wind * 4;
    return {
      x: n.baseX + sway,
      y: n.baseY + sway * 0.3,
    };
  };

  const tick = (dt: { deltaMS: number }) => {
    if (cancelled) return;
    const delta = dt.deltaMS / 1000;
    time += delta;

    const wind = Math.sin(time * 0.4) * 1.0 + Math.sin(time * 1.1) * 0.4;

    webG.clear();

    // Draw spokes
    for (let s = 0; s < SPOKE_COUNT; s++) {
      webG.moveTo(anchorX, anchorY);
      for (let ring = 1; ring <= RING_COUNT; ring++) {
        const p = getNodePos(ring, s, wind);
        webG.lineTo(p.x, p.y);
      }
      webG.stroke({ color: 0x888899, width: 0.5, alpha: 0.35 });
    }

    // Draw rings (connect adjacent spokes at each ring distance)
    for (let ring = 1; ring <= RING_COUNT; ring++) {
      for (let s = 0; s < SPOKE_COUNT - 1; s++) {
        const pA = getNodePos(ring, s, wind);
        const pB = getNodePos(ring, s + 1, wind);
        webG.moveTo(pA.x, pA.y).lineTo(pB.x, pB.y).stroke({ color: 0xaaaacc, width: 0.4, alpha: 0.28 });
      }
    }

    // Dew drops
    for (const d of dewDrops) {
      const p = getNodePos(d.ring, d.spoke, wind);
      const twinkle = 0.5 + Math.sin(time * 1.8 + d.ring * 3.1 + d.spoke * 1.7) * 0.45;
      webG.circle(p.x, p.y, 1.5).fill({ color: 0xbbddff, alpha: 0.55 * twinkle });
      webG.circle(p.x, p.y, 0.7).fill({ color: 0xffffff, alpha: 0.7 * twinkle });
    }

    // Spider walks inward over 6s, then resets
    spiderRingF -= delta * (RING_COUNT / 6);
    if (spiderRingF < 0) {
      spiderRingF = RING_COUNT;
      spiderSpoke = Math.floor(Math.random() * SPOKE_COUNT);
    }
    const sp = getNodePos(Math.round(spiderRingF), spiderSpoke, wind);
    webG.circle(sp.x, sp.y, 3).fill({ color: 0x1a0a1a, alpha: 0.9 });
    webG.circle(sp.x, sp.y, 3).stroke({ color: 0x443344, width: 0.6 });
    // Legs suggestion (4 lines per side)
    for (let leg = 0; leg < 4; leg++) {
      const la = (leg / 4) * Math.PI + time * 3 * (leg % 2 === 0 ? 1 : -1) * 0.2;
      const len = 4 + Math.sin(time * 6 + leg) * 1.5;
      webG.moveTo(sp.x, sp.y).lineTo(sp.x + Math.cos(la) * len, sp.y + Math.sin(la) * len)
          .stroke({ color: 0x443344, width: 0.5, alpha: 0.6 });
      webG.moveTo(sp.x, sp.y).lineTo(sp.x + Math.cos(la + Math.PI) * len, sp.y + Math.sin(la + Math.PI) * len)
          .stroke({ color: 0x443344, width: 0.5, alpha: 0.6 });
    }
  };

  app.ticker.add(tick);

  return () => {
    cancelled = true;
    app.ticker.remove(tick);
    [bg, cracks, webG, label].forEach((e) => e.destroy());
  };
}
