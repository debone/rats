/**
 * ENVIRONMENT: Neon Sign
 *
 * Neon glow with Text + BlurFilter stacked in 3 passes:
 * 1. Wide blur (strength=20) at low alpha  → outer diffuse haze
 * 2. Tight blur (strength=6)  at mid alpha → tube body glow
 * 3. No blur, full alpha, white tint       → hot bright core
 *
 * Using Text (not hand-drawn paths) means letters are always correct
 * and scale cleanly to any preview size.
 *
 * Flicker state machine: each sign tube has its own timer so they
 * stutter independently — synchronized flicker looks fake.
 */
import { BlurFilter, Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';

interface NeonLine {
  glow1: Text;
  glow2: Text;
  core: Text;
  isFlickering: boolean;
  flickerTime: number;
  flickerDuration: number;
  nextFlicker: number;
  rapidOn: boolean;
  rapidTimer: number;
}

function makeNeonLine(
  root: Container,
  text: string,
  color: number,
  x: number,
  y: number,
  fontSize: number,
): NeonLine {
  const style = { ...TEXT_STYLE_DEFAULT, fontSize, fontWeight: 'bold' as const };

  const glow1 = new Text({ text, style: { ...style, fill: color } });
  glow1.anchor.set(0.5);
  glow1.x = x; glow1.y = y;
  glow1.filters = [new BlurFilter({ strength: 22, quality: 3 })];
  glow1.alpha = 0.28;
  root.addChild(glow1);

  const glow2 = new Text({ text, style: { ...style, fill: color } });
  glow2.anchor.set(0.5);
  glow2.x = x; glow2.y = y;
  glow2.filters = [new BlurFilter({ strength: 6, quality: 3 })];
  glow2.alpha = 0.55;
  root.addChild(glow2);

  const core = new Text({ text, style: { ...style, fill: 0xffffff } });
  core.anchor.set(0.5);
  core.x = x; core.y = y;
  root.addChild(core);

  return {
    glow1, glow2, core,
    isFlickering: false,
    flickerTime: 0,
    flickerDuration: 0,
    nextFlicker: 1800 + Math.random() * 3500,
    rapidOn: true,
    rapidTimer: 0,
  };
}

function setNeonAlpha(line: NeonLine, t: number) {
  line.glow1.alpha = 0.28 * t;
  line.glow2.alpha = 0.55 * t;
  line.core.alpha  = t;
}

function destroyNeonLine(line: NeonLine) {
  [line.glow1, line.glow2, line.core].forEach((t) => t.destroy());
}

export function neonSign(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let time = 0;

  // ─── Brick wall ───────────────────────────────────────────────────────
  const wall = new Graphics();
  wall.rect(0, 0, w, h).fill(0x100a08);
  const brickH = 13, brickW = 30;
  for (let row = 0; row * brickH < h; row++) {
    const offset = (row % 2) * (brickW / 2);
    for (let col = -1; col * brickW < w + brickW; col++) {
      const bx = col * brickW + offset;
      const by = row * brickH;
      wall.roundRect(bx + 1, by + 1, brickW - 2, brickH - 2, 1)
          .fill({ color: 0x1c0e08 + (Math.random() > 0.8 ? 0x020202 : 0), alpha: 0.9 });
    }
  }
  root.addChild(wall);

  // Sign board
  const board = new Graphics();
  const margin = w * 0.06;
  board.roundRect(margin, h * 0.15, w - margin * 2, h * 0.7, 4)
       .fill({ color: 0x04020a, alpha: 0.9 });
  board.roundRect(margin, h * 0.15, w - margin * 2, h * 0.7, 4)
       .stroke({ color: 0x220a22, width: 1 });
  root.addChild(board);

  // Corner bolts
  const bolts = new Graphics();
  [[margin + 8, h * 0.15 + 8], [w - margin - 8, h * 0.15 + 8],
   [margin + 8, h * 0.85 - 8], [w - margin - 8, h * 0.85 - 8]].forEach(([bx, by]) => {
    bolts.circle(bx, by, 3).fill(0x1a1010);
    bolts.circle(bx, by, 3).stroke({ color: 0x331122, width: 0.5 });
  });
  root.addChild(bolts);

  // ─── Neon lines ───────────────────────────────────────────────────────
  const cx = w / 2;
  const fontSize = Math.max(22, Math.floor(w / 13));
  const smallSize = Math.max(14, Math.floor(w / 20));

  const lines: NeonLine[] = [
    makeNeonLine(root, 'RATS',      0xff33cc, cx, h * 0.38, fontSize),
    makeNeonLine(root, 'SEWER CO.', 0x33ccff, cx, h * 0.56, smallSize),
    makeNeonLine(root, '— EST. \'89 —', 0x44ff88, cx, h * 0.70, Math.floor(smallSize * 0.75)),
  ];

  // Stagger initial flicker timers
  lines[0].nextFlicker = 2200 + Math.random() * 2000;
  lines[1].nextFlicker = 4000 + Math.random() * 2000;
  lines[2].nextFlicker = 1000 + Math.random() * 1500;

  const label = new Text({
    text: 'ENV: NEON SIGN — 3-layer blur glow (Text + BlurFilter) + flicker state machine',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x2a1a3a, letterSpacing: 1 },
  });
  label.x = 6;
  label.y = 6;
  root.addChild(label);

  const tick = (dt: { deltaMS: number }) => {
    if (cancelled) return;
    time += dt.deltaMS;

    for (const line of lines) {
      if (line.isFlickering) {
        line.flickerTime += dt.deltaMS;
        line.rapidTimer  += dt.deltaMS;
        // Snap on/off every 35-75ms
        if (line.rapidTimer > 35 + Math.random() * 40) {
          line.rapidOn = !line.rapidOn;
          line.rapidTimer = 0;
        }
        setNeonAlpha(line, line.rapidOn ? 1 : 0);
        if (line.flickerTime >= line.flickerDuration) {
          line.isFlickering = false;
          setNeonAlpha(line, 1);
          line.nextFlicker = 2500 + Math.random() * 6000;
        }
      } else {
        line.nextFlicker -= dt.deltaMS;
        // Gentle breathing glow
        const breathe = 0.88 + Math.sin(time * 0.0016 + lines.indexOf(line) * 1.4) * 0.1;
        setNeonAlpha(line, breathe);
        if (line.nextFlicker <= 0) {
          line.isFlickering  = true;
          line.flickerTime   = 0;
          line.flickerDuration = 100 + Math.random() * 250;
          line.rapidOn = false;
        }
      }
    }
  };

  app.ticker.add(tick);

  return () => {
    cancelled = true;
    app.ticker.remove(tick);
    lines.forEach(destroyNeonLine);
    [wall, board, bolts, label].forEach((e) => e.destroy());
  };
}
