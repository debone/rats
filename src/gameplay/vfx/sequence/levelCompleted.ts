import { GameEvent } from '@/data/events';
import { playTimeline } from '@/systems/vfx/timeline/load';
import { defineSequence } from '@/systems/vfx/types';
import { Container, Graphics, Text } from 'pixi.js';
import { brickBreak } from '../burst/brickBreak';
import { MIN_HEIGHT, MIN_WIDTH } from '@/consts';
import { vfx } from '@/systems/vfx/vfx';

const Z_INDEX = 2000;

const ACCENT = 0xffd23f;
const ACCENT_PINK = 0xff3864;

/** Radial "concentration lines": thin triangles pointing inward, clear oval in the middle. */
function drawConcentrationLines(
  g: Graphics,
  count: number,
  innerR: number,
  outerR: number,
  color: number,
  alpha: number,
) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const half = ((Math.PI * 2) / count) * 0.4;
    g.poly([
      Math.cos(a) * innerR,
      Math.sin(a) * innerR,
      Math.cos(a - half) * outerR,
      Math.sin(a - half) * outerR,
      Math.cos(a + half) * outerR,
      Math.sin(a + half) * outerR,
    ]);
    g.fill({ color, alpha });
  }
}

/** Alternating sunburst wedges radiating from the center. */
function drawSunburst(g: Graphics, count: number, radius: number, color: number, alpha: number) {
  for (let i = 0; i < count; i += 2) {
    const a0 = (i / count) * Math.PI * 2;
    const a1 = ((i + 1) / count) * Math.PI * 2;
    g.moveTo(0, 0);
    g.lineTo(Math.cos(a0) * radius, Math.sin(a0) * radius);
    g.lineTo(Math.cos(a1) * radius, Math.sin(a1) * radius);
    g.fill({ color, alpha });
  }
}

function makeHeading(text: string, fill: number, fontSize: number): Text {
  const t = new Text({
    text,
    style: {
      fontFamily: 'Georgia',
      fontSize,
      fontWeight: 'bold',
      fill,
      stroke: { color: 0x1a1a2e, width: Math.max(4, fontSize * 0.08) },
      letterSpacing: 2,
    },
  });
  t.anchor.set(0.5);
  return t;
}

export const levelCompleted = defineSequence({
  kind: 'sequence',
  id: 'levelCompleted',
  priority: 'critical',
  on: GameEvent.BALL_LOST,
  prewarm: [brickBreak],
  async build(_params, ctx) {
    const { size, stage } = ctx;
    const width = size.width;
    const height = size.height;
    const cx = width / 2;
    const cy = height / 2;
    const diag = Math.hypot(width, height);

    const root = new Container({ label: 'vfx-levelCompleted', zIndex: Z_INDEX });
    root.eventMode = 'none';
    stage.addChild(root);

    const lines = new Graphics();
    drawConcentrationLines(lines, 60, 200, diag, 0xffffff, 0.85);
    lines.position.set(cx, cy);
    lines.alpha = 0;
    root.addChild(lines);

    const burst = new Graphics();
    drawSunburst(burst, 16, diag * 0.6, ACCENT, 0.5);
    burst.position.set(cx, cy);
    burst.scale.set(0.5);
    root.addChild(burst);

    // --- Named fire-once beats (cues resolve hooks by name) ---
    const hooks = {
      burst1: () => vfx.play(brickBreak, { x: MIN_WIDTH / 2, y: MIN_HEIGHT / 2, count: 18, intensity: 0 }),
      burst2: () => vfx.play(brickBreak, { x: MIN_WIDTH / 2, y: MIN_HEIGHT / 2 + 4, count: 12, intensity: 0 }),
    };

    await playTimeline('levelCompleted', { stage: { burst, lines }, hooks, ctx });

    root.destroy({ children: true });
  },
});
