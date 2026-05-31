import { MIN_HEIGHT, MIN_WIDTH } from '@/consts';
import { addPunch, addShake } from '@/core/vfx/camera';
import { GameEvent } from '@/data/events';
import { Container, Graphics, Text } from 'pixi.js';
import { playTimeline } from '../timeline/load';
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
 * This is the first sequence ported to the hybrid model: the *actors* (procedural
 * Graphics/Text) and the in-code tweens that can't be data (parametric camera
 * helpers, the randomized shards loop) are built here; the *timing* — every
 * flash/wash/lines/burst/textGroup keyframe and the two burst cues — lives in
 * `assets/timelines/levelCompleted.json` and is compiled onto the same timeline.
 * Both halves share one `ctx.timeline()`, so `SequenceDebug`/the editor scrub the
 * whole thing as one playhead.
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

const SLAM = 150; // when the text lands

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
  async build({ text = 'LEVEL COMPLETED' }, ctx) {
    const { camera, size, stage } = ctx;
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

    // --- Build the actors (back to front) ---
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

    // --- The named stage map (data-driven tracks resolve actors by name) ---
    const actors = { wash, lines, burst, flash, textGroup, tR, tC };

    // --- Named fire-once beats (cues resolve hooks by name) ---
    const hooks = {
      burst1: () => vfx.play(brickBreak, { x: MIN_WIDTH / 2, y: MIN_HEIGHT / 2, count: 18, intensity: 0 }),
      burst2: () => vfx.play(brickBreak, { x: MIN_WIDTH / 2, y: MIN_HEIGHT / 2 + 4, count: 12, intensity: 0 }),
    };

    // Load the choreography, compile it onto a tracked timeline, and run it. The
    // in-code tweens below coexist with the JSON tracks on the same playhead.
    await playTimeline('levelCompleted', {
      stage: actors,
      hooks,
      ctx,
      decorate: (tl) => {
        // Camera punch + opening/slam shakes — parametric helpers, not keyframe
        // data, so they stay in code. They honor the speed slider and scrub.
        addPunch(tl, camera, { intensity: 1.18, duration: 220 }, 0);
        addShake(tl, camera, { intensity: 16, duration: 520 }, 0);
        addShake(tl, camera, { intensity: 11, duration: 360 }, SLAM + 10);

        // Confetti shards fly outward, staggered — an array tween with per-shard
        // randomness, so it stays in code rather than the doc.
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
      },
    });

    root.destroy({ children: true });
  },
});
