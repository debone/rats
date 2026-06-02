import { animate } from 'animejs';
import { createTimeline } from 'animejs';
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { defineSequence } from '@/core/vfx/types';
import type { SequenceContext } from '@/core/vfx/types';

/**
 * CUTSCENE: Level Intro  [sequence]
 *
 * Dark overlay fades, level number and name scale in with expanding lines.
 * VFX type: defineSequence — complete choreographed moment with clear start/end.
 */

const levelIntroSequence = defineSequence<{ w: number; h: number }>({
  kind: 'sequence',
  id: 'levelIntro',
  async build({ w, h }, { layer }) {
    const overlay = new Graphics();
    overlay.rect(0, 0, w, h).fill(0x000000);
    overlay.alpha = 1;
    layer.addChild(overlay);

    const levelNum = new Text({
      text: 'LEVEL 1',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 28, letterSpacing: 8, fontWeight: 'bold' },
    });
    levelNum.anchor.set(0.5);
    levelNum.x = w / 2;
    levelNum.y = h / 2 - 20;
    levelNum.alpha = 0;
    levelNum.scale.set(0.5);
    layer.addChild(levelNum);

    const levelName = new Text({
      text: 'THE CHEESE VAULT',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 10, letterSpacing: 4, fill: 0x9944bb },
    });
    levelName.anchor.set(0.5);
    levelName.x = w / 2;
    levelName.y = h / 2 + 18;
    levelName.alpha = 0;
    layer.addChild(levelName);

    // Decorative lines
    const lineL = new Graphics();
    lineL.rect(w / 2, h / 2 - 1, 0, 2).fill(0x9944bb);
    layer.addChild(lineL);

    const lineR = new Graphics();
    lineR.rect(w / 2, h / 2 - 1, 0, 2).fill(0x9944bb);
    layer.addChild(lineR);

    // Fade overlay to semi-dark
    await animate(overlay, { alpha: 0.75, duration: 300 });

    // Lines expand outward
    const lineProxy = { width: 0 };
    const lineAnim = animate(lineProxy, {
      width: w / 2,
      duration: 400,
      ease: 'outQuad',
      onUpdate: () => {
        const { width } = lineProxy;
        lineL.clear().rect(w / 2 - width, h / 2 - 1, width, 2).fill(0x9944bb);
        lineR.clear().rect(w / 2, h / 2 - 1, width, 2).fill(0x9944bb);
      },
    });

    // Level number pops in
    const numAnim = animate(levelNum, {
      alpha: 1, scaleX: 1, scaleY: 1,
      duration: 500, ease: 'outBack(1.8)',
    });

    await Promise.all([lineAnim, numAnim]);

    await animate(levelName, { alpha: 1, duration: 400, delay: 100 });

    await new Promise<void>((res) => setTimeout(res, 1200));

    // Fade everything out
    await Promise.all([
      animate(overlay, { alpha: 0, duration: 500 }),
      animate(levelNum, { alpha: 0, duration: 400 }),
      animate(levelName, { alpha: 0, duration: 400 }),
    ]);

    await new Promise<void>((res) => setTimeout(res, 600));

    // Cleanup
    overlay.destroy();
    levelNum.destroy();
    levelName.destroy();
    lineL.destroy();
    lineR.destroy();
  },
});

export function levelIntro(root: Container, w: number, h: number): () => void {
  let cancelled = false;

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
      await levelIntroSequence.build({ w, h }, ctx);
      await new Promise<void>((res) => setTimeout(res, 400));
    }
  };
  loop();

  return () => {
    cancelled = true;
  };
}
