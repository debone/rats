import { animate } from 'animejs';
import { createTimeline } from 'animejs';
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { defineSequence } from '@/core/vfx/types';
import type { SequenceContext } from '@/core/vfx/types';

/**
 * CUTSCENE: Mission Briefing  [sequence]
 *
 * A mission panel slides in with objectives that tick off one by one.
 * VFX type: defineSequence — complete choreographed moment with clear start/end.
 */

const OBJECTIVES = [
  { text: 'Destroy all brick walls', pts: '+200' },
  { text: 'Collect 10 cheese pieces', pts: '+150' },
  { text: 'Finish under 2 minutes', pts: '+100' },
  { text: 'No lives lost', pts: '+300' },
];

const missionBriefingSequence = defineSequence<{ w: number; h: number }>({
  kind: 'sequence',
  id: 'missionBriefing',
  async build({ w, h }, { layer }) {
    const PW = w - 24;
    const PH = 140;
    const PX = 12;
    const PY = (h - PH) / 2 - 6;

    const panel = new Graphics();
    panel
      .roundRect(PX, PY, PW, PH, 5)
      .fill(0x050a14)
      .stroke({ color: 0x224466, width: 1 });
    panel.alpha = 0;
    panel.x = w + 20;
    layer.addChild(panel);

    // Top bar with title
    const topBar = new Graphics();
    topBar
      .roundRect(PX, PY, PW, 20, { tl: 5, tr: 5, bl: 0, br: 0 })
      .fill(0x112233);
    topBar.alpha = 0;
    topBar.x = w + 20;
    layer.addChild(topBar);

    const titleText = new Text({
      text: 'M I S S I O N  B R I E F I N G',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, letterSpacing: 3, fill: 0x44aaff },
    });
    titleText.anchor.set(0.5, 0.5);
    titleText.x = w / 2;
    titleText.y = PY + 10;
    titleText.alpha = 0;
    layer.addChild(titleText);

    // Objective rows
    const ROW_H = 22;
    const rowsY0 = PY + 28;

    interface ObjRow {
      line: Graphics;
      check: Text;
      label: Text;
      pts: Text;
    }
    const rows: ObjRow[] = [];

    for (let i = 0; i < OBJECTIVES.length; i++) {
      const ry = rowsY0 + i * ROW_H;
      const obj = OBJECTIVES[i];

      const line = new Graphics();
      layer.addChild(line);

      const check = new Text({
        text: '□',
        style: { ...TEXT_STYLE_DEFAULT, fontSize: 9, fill: 0x44aaff },
      });
      check.x = PX + 10;
      check.y = ry;
      check.alpha = 0;
      layer.addChild(check);

      const label = new Text({
        text: obj.text,
        style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0xaaccee },
      });
      label.x = PX + 26;
      label.y = ry;
      label.alpha = 0;
      layer.addChild(label);

      const pts = new Text({
        text: obj.pts,
        style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0x44ff88 },
      });
      pts.anchor.set(1, 0);
      pts.x = PX + PW - 10;
      pts.y = ry;
      pts.alpha = 0;
      layer.addChild(pts);

      rows.push({ line, check, label, pts });
    }

    const footerText = new Text({
      text: 'GOOD LUCK, RAT.',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, letterSpacing: 3, fill: 0x446688 },
    });
    footerText.anchor.set(0.5);
    footerText.x = w / 2;
    footerText.y = PY + PH - 10;
    footerText.alpha = 0;
    layer.addChild(footerText);

    // Panel slides in from right
    await Promise.all([
      animate(panel, { x: 0, alpha: 1, duration: 420, ease: 'outBack(1.1)' }),
      animate(topBar, { x: 0, alpha: 1, duration: 420, ease: 'outBack(1.1)' }),
    ]);

    await animate(titleText, { alpha: 1, duration: 250 });

    // Objectives appear one by one
    for (let i = 0; i < rows.length; i++) {
      const { line, check, label, pts } = rows[i];
      const ry = rowsY0 + i * ROW_H;

      // Line grows from left
      const lp = { w: 0 };
      animate(lp, {
        w: PW - 20,
        duration: 220,
        ease: 'outQuad',
        onUpdate: () => {
          line
            .clear()
            .rect(PX + 10, ry - 2, lp.w, 1)
            .fill({ color: 0x224466, alpha: 0.6 });
        },
      });

      await new Promise<void>((res) => setTimeout(res, 80));

      await animate(check, { alpha: 1, duration: 160 });
      await animate(label, { alpha: 1, duration: 180 });
      await animate(pts, { alpha: 1, duration: 160 });

      await new Promise<void>((res) => setTimeout(res, 100));
    }

    await animate(footerText, { alpha: 1, duration: 300 });

    // Check off objectives one by one
    await new Promise<void>((res) => setTimeout(res, 800));

    for (const row of rows) {
      row.check.text = '✓';
      row.check.style.fill = 0x44ff88;
      animate(row.check, { scaleX: [1.4, 1], scaleY: [1.4, 1], duration: 200, ease: 'outBack' });
      await new Promise<void>((res) => setTimeout(res, 260));
    }

    await new Promise<void>((res) => setTimeout(res, 900));

    // Slide out to left
    await Promise.all([
      animate(panel, { x: -(w + 20), alpha: 0, duration: 380, ease: 'inBack(1.1)' }),
      animate(topBar, { x: -(w + 20), alpha: 0, duration: 380, ease: 'inBack(1.1)' }),
      animate(titleText, { alpha: 0, duration: 260 }),
      animate(footerText, { alpha: 0, duration: 260 }),
      ...rows.flatMap((r) => [
        animate(r.check, { alpha: 0, duration: 220 }),
        animate(r.label, { alpha: 0, duration: 220 }),
        animate(r.pts, { alpha: 0, duration: 220 }),
      ]),
    ]);
    rows.forEach((r) => r.line.clear());

    await new Promise<void>((res) => setTimeout(res, 600));

    // Cleanup
    [panel, topBar, titleText, footerText, ...rows.flatMap((r) => [r.line, r.check, r.label, r.pts])].forEach(
      (e) => e.destroy(),
    );
  },
});

export function missionBriefing(root: Container, w: number, h: number): () => void {
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
      await missionBriefingSequence.build({ w, h }, ctx);
      await new Promise<void>((res) => setTimeout(res, 400));
    }
  };
  loop();

  return () => {
    cancelled = true;
  };
}
