import { MIN_HEIGHT, MIN_WIDTH } from '@/consts';
import { punch } from '@/core/camera/effects/punch';
import { shake } from '@/core/camera/effects/shake';
import { GameEvent } from '@/data/events';
import { Container, Graphics, Text } from 'pixi.js';
import { defineSequence } from '../types';
import { vfx } from '../vfx';
import { brickBreak } from './brickBreak';

/**
 * "LEVEL COMPLETED" — a deliberately over-the-top, anime-esque burst built to
 * stress every part of the sequence kind at once: a full-screen impact-frame
 * flash, radial concentration lines, a rotating sunburst, chromatic-aberration
 * slam text, confetti shards, camera punch + escalating shakes, and cross-effect
 * composition firing `brickBreak` bursts.
 *
 * Notable lifecycle choice: it renders on `ctx.stage` (the persistent application
 * stage), not the per-screen `effects`/`overlay` layers. The natural trigger is
 * `CAMPAIGN_LEVEL_WON`, which kicks off a screen transition ~500ms later that
 * destroys those layers — far shorter than this ~1.6s cinematic. Rendering on the
 * stage lets the flourish outlive the teardown and visually cover the transition.
 */
const Z_INDEX = 9999; // above every game layer (debug sits at 25)
const ACCENT = 0xffd23f; // warm gold
const ACCENT_2 = 0xff3864; // hot pink

const TOTAL = 1600;
const SLAM = 150; // when the text lands
const EXIT = 1250;

export interface LevelCompletedParams {
  /** Heading copy. Defaults to "LEVEL COMPLETED". */
  text?: string;
}

/** Radial "concentration lines": thin triangles pointing inward, clear oval in the middle. */
function drawConcentrationLines(g: Graphics, count: number, innerR: number, outerR: number, color: number, alpha: number) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const half = ((Math.PI * 2) / count) * 0.4;
    g.poly([
      Math.cos(a) * innerR, Math.sin(a) * innerR,
      Math.cos(a - half) * outerR, Math.sin(a - half) * outerR,
      Math.cos(a + half) * outerR, Math.sin(a + half) * outerR,
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

export const levelCompleted = defineSequence<LevelCompletedParams>({
  kind: 'sequence',
  id: 'levelCompleted',
  priority: 'critical',
  on: GameEvent.CAMPAIGN_LEVEL_WON,
  prewarm: [brickBreak],
  async build({ text = 'LEVEL COMPLETED' }, { camera, size, stage, timeline }) {
    const w = size.width || MIN_WIDTH;
    const h = size.height || MIN_HEIGHT;
    const cx = w / 2;
    const cy = h / 2;
    const diag = Math.hypot(w, h);

    // Screen-fixed, top-most, non-interactive root that survives the screen swap.
    const root = new Container({ label: 'vfx-levelCompleted', zIndex: Z_INDEX });
    root.eventMode = 'none';
    stage.sortableChildren = true;
    stage.addChild(root);

    // --- Build the layers (back to front) ---
    const wash = new Graphics().rect(0, 0, w, h).fill({ color: ACCENT_2, alpha: 1 });
    wash.alpha = 0;

    const lines = new Graphics();
    drawConcentrationLines(lines, 60, 200, diag, 0xffffff, 0.85);
    lines.position.set(cx, cy);
    lines.alpha = 0;
    lines.scale.set(0.6);

    const burst = new Graphics();
    drawSunburst(burst, 16, diag * 0.6, ACCENT, 0.5);
    burst.position.set(cx, cy);
    burst.alpha = 0;
    burst.scale.set(0);

    const flash = new Graphics().rect(0, 0, w, h).fill(0xffffff);
    flash.alpha = 0;

    const fontSize = Math.min(96, Math.max(40, w / (text.length * 0.5)));
    const textGroup = new Container();
    textGroup.position.set(cx, cy);
    const tR = makeHeading(text, ACCENT_2, fontSize);
    const tC = makeHeading(text, 0x3ad0ff, fontSize);
    const tMain = makeHeading(text, 0xffffff, fontSize);
    textGroup.addChild(tR, tC, tMain);
    textGroup.alpha = 0;
    textGroup.scale.set(4);

    const SHARDS = 18;
    const shards: Graphics[] = [];
    for (let i = 0; i < SHARDS; i++) {
      const s = new Graphics().rect(-6, -2.5, 12, 5).fill({ color: i % 2 ? ACCENT : ACCENT_2 });
      s.position.set(cx, cy);
      s.alpha = 0;
      shards.push(s);
    }

    root.addChild(wash, lines, burst, flash, textGroup, ...shards);

    // --- Choreograph it on one timeline ---
    const tl = timeline();

    // Transient triggers: fire-once on real playback. These do NOT reverse or
    // re-fire when scrubbing — that's the line between a `tl.call` beat (a kick to
    // an external system: camera, particles, audio) and seekable tween state below.
    tl.call(() => {
      punch(camera, 1.18, 220);
      shake(camera, { intensity: 16, duration: 520 });
      vfx.play(brickBreak, { x: MIN_WIDTH / 2, y: MIN_HEIGHT / 2, count: 18, intensity: 0 });
    }, 0);

    // Impact frames as *seekable state*: instant tint sets (1ms) + quick alpha
    // falloffs. Authored as tweens so scrubbing the timeline shows every flash —
    // the held-frame staccato is preserved by the gaps between falloffs.
    tl.add(flash, { tint: 0xffffff, duration: 1 }, 0);
    tl.add(flash, { alpha: 1, duration: 1 }, 0);
    tl.add(flash, { alpha: 0, duration: 55, ease: 'in' }, 5);
    tl.add(flash, { tint: ACCENT, duration: 1 }, 110);
    tl.add(flash, { alpha: 0.9, duration: 1 }, 110);
    tl.add(flash, { alpha: 0, duration: 40, ease: 'in' }, 115);
    tl.add(flash, { tint: 0x1a1a2e, duration: 1 }, 200);
    tl.add(flash, { alpha: 0.85, duration: 1 }, 200);
    tl.add(flash, { alpha: 0, duration: 35, ease: 'in' }, 205);

    // Background wash holds a faint color tint.
    tl.add(wash, { alpha: 0.28, duration: 200, ease: 'out' }, 40);

    // Concentration lines whip in and spin slowly.
    tl.add(lines, { alpha: 0.9, duration: 120, ease: 'out' }, 30);
    tl.add(lines.scale, { x: 1, y: 1, duration: 380, ease: 'outBack' }, 30);
    tl.add(lines, { rotation: Math.PI * 0.5, duration: TOTAL, ease: 'linear' }, 30);

    // Sunburst pops and counter-rotates.
    tl.add(burst, { alpha: 1, duration: 120, ease: 'out' }, 90);
    tl.add(burst.scale, { x: 1, y: 1, duration: 420, ease: 'outBack' }, 90);
    tl.add(burst, { rotation: -Math.PI * 0.4, duration: TOTAL, ease: 'linear' }, 90);

    // Text slam: scale overshoot, rotation settle, second camera hit + burst.
    tl.add(textGroup, { alpha: 1, duration: 90, ease: 'out' }, SLAM);
    tl.add(textGroup.scale, { x: 1, y: 1, duration: 320, ease: 'outBack' }, SLAM);
    tl.add(textGroup, { rotation: [-0.08, 0.05, -0.02, 0], duration: 360, ease: 'out' }, SLAM);
    tl.call(() => {
      shake(camera, { intensity: 11, duration: 360 });
      vfx.play(brickBreak, { x: MIN_WIDTH / 2, y: MIN_HEIGHT / 2 + 4, count: 12, intensity: 0 });
    }, SLAM + 10);

    // Chromatic aberration: wide split on impact, settling to a thin offset.
    tl.add(tR, { x: [-26, 6, -3], duration: 420, ease: 'out' }, SLAM);
    tl.add(tC, { x: [26, -6, 3], duration: 420, ease: 'out' }, SLAM);

    // Confetti shards fly outward, staggered.
    shards.forEach((s, i) => {
      const a = (i / SHARDS) * Math.PI * 2 + Math.random() * 0.3;
      const dist = diag * (0.35 + Math.random() * 0.25);
      tl.add(
        s,
        {
          alpha: [1, 1, 0],
          x: cx + Math.cos(a) * dist,
          y: cy + Math.sin(a) * dist,
          rotation: (Math.random() - 0.5) * 12,
          duration: 700,
          ease: 'outQuad',
        },
        SLAM + (i % 6) * 12,
      );
    });

    // Hold, then blow everything out with one last white pop.
    tl.add(textGroup.scale, { x: 1.7, y: 1.7, duration: 320, ease: 'inOutQuad' }, EXIT);
    tl.add(textGroup, { alpha: 0, duration: 320, ease: 'in' }, EXIT);
    tl.add(lines, { alpha: 0, duration: 280 }, EXIT);
    tl.add(burst, { alpha: 0, duration: 280 }, EXIT);
    tl.add(wash, { alpha: 0, duration: 320 }, EXIT);
    // Final white pop — seekable: instant set then fade.
    tl.add(flash, { tint: 0xffffff, duration: 1 }, EXIT);
    tl.add(flash, { alpha: 0.6, duration: 1 }, EXIT);
    tl.add(flash, { alpha: 0, duration: 300, ease: 'out' }, EXIT + 20);

    await tl;
    root.destroy({ children: true });
  },
});
