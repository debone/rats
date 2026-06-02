/**
 * TECHNIQUE: Trail / Ribbon Renderer — sword swing (via VFX sequence)
 *
 * Demonstrates the `defineSequence` VFX type: a timed, anime.js-driven
 * choreography that creates and destroys its own scene graph nodes.
 *
 * The swordSwing effect records blade tip positions each tween tick and
 * reconstructs a tapered polygon from the history — trail width = 0 at
 * the oldest point, MAX_WIDTH at the current tip (head).
 *
 * Three sequential swings share a single timeline; drag the debug panel
 * seek slider to scrub through any frame of the choreography.
 */
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { swordSwing } from '@/core/vfx/effects/swordSwing';
import { createTimeline } from 'animejs';
import type { SequenceContext } from '@/core/vfx/types';

export function swordTrail(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x080810);
  root.addChild(bg);

  const label = new Text({
    text: 'TRAIL RENDERER — polygon mesh from position history  [sequence]',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x3a3a6a, letterSpacing: 1 },
  });
  label.x = 6;
  label.y = 6;
  root.addChild(label);

  const labelB = new Text({
    text: 'swordSwing  ·  defineSequence  ·  ctx.timeline() drives the blade angle + trail fade',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 6, fill: 0x2a2a4a, letterSpacing: 1 },
  });
  labelB.x = 6;
  labelB.y = h - 12;
  root.addChild(labelB);

  // Minimal SequenceContext — no camera or game systems needed for this effect
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
      await swordSwing.build({ cx: w / 2, cy: h / 2 }, ctx);
      await new Promise<void>((res) => {
        timer = setTimeout(res, 500);
      });
    }
  };

  loop();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    [bg, label, labelB].forEach((e) => e.destroy());
  };
}
