import { animate } from 'animejs';
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';

const OBJECTIVES = [
  { text: 'Destroy all brick walls', pts: '+200' },
  { text: 'Collect 10 cheese pieces', pts: '+150' },
  { text: 'Finish under 2 minutes', pts: '+100' },
  { text: 'No lives lost', pts: '+300' },
];

export function missionBriefing(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

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
  root.addChild(panel);

  // Top bar with title
  const topBar = new Graphics();
  topBar
    .roundRect(PX, PY, PW, 20, { tl: 5, tr: 5, bl: 0, br: 0 })
    .fill(0x112233);
  topBar.alpha = 0;
  topBar.x = w + 20;
  root.addChild(topBar);

  const titleText = new Text({
    text: 'M I S S I O N  B R I E F I N G',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, letterSpacing: 3, fill: 0x44aaff },
  });
  titleText.anchor.set(0.5, 0.5);
  titleText.x = w / 2;
  titleText.y = PY + 10;
  titleText.alpha = 0;
  root.addChild(titleText);

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
    root.addChild(line);

    const check = new Text({
      text: '□',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 9, fill: 0x44aaff },
    });
    check.x = PX + 10;
    check.y = ry;
    check.alpha = 0;
    root.addChild(check);

    const label = new Text({
      text: obj.text,
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0xaaccee },
    });
    label.x = PX + 26;
    label.y = ry;
    label.alpha = 0;
    root.addChild(label);

    const pts = new Text({
      text: obj.pts,
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0x44ff88 },
    });
    pts.anchor.set(1, 0);
    pts.x = PX + PW - 10;
    pts.y = ry;
    pts.alpha = 0;
    root.addChild(pts);

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
  root.addChild(footerText);

  const play = async () => {
    if (cancelled) return;

    // Reset
    panel.x = w + 20;
    panel.alpha = 0;
    topBar.x = w + 20;
    topBar.alpha = 0;
    titleText.alpha = 0;
    rows.forEach((r) => {
      r.line.clear();
      r.check.alpha = 0;
      r.check.text = '□';
      r.label.alpha = 0;
      r.pts.alpha = 0;
    });
    footerText.alpha = 0;

    // Panel slides in from right
    await Promise.all([
      animate(panel, { x: 0, alpha: 1, duration: 420, ease: 'outBack(1.1)' }),
      animate(topBar, { x: 0, alpha: 1, duration: 420, ease: 'outBack(1.1)' }),
    ]);
    if (cancelled) return;

    await animate(titleText, { alpha: 1, duration: 250 });
    if (cancelled) return;

    // Objectives appear one by one
    for (let i = 0; i < rows.length; i++) {
      if (cancelled) return;
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

      await new Promise<void>((res) => {
        timer = setTimeout(res, 80);
      });
      if (cancelled) return;

      await animate(check, { alpha: 1, duration: 160 });
      await animate(label, { alpha: 1, duration: 180 });
      await animate(pts, { alpha: 1, duration: 160 });

      await new Promise<void>((res) => {
        timer = setTimeout(res, 100);
      });
      if (cancelled) return;
    }

    await animate(footerText, { alpha: 1, duration: 300 });
    if (cancelled) return;

    // Check off objectives one by one
    await new Promise<void>((res) => {
      timer = setTimeout(res, 800);
    });
    if (cancelled) return;

    for (const row of rows) {
      if (cancelled) return;
      row.check.text = '✓';
      row.check.style.fill = 0x44ff88;
      animate(row.check, { scaleX: [1.4, 1], scaleY: [1.4, 1], duration: 200, ease: 'outBack' });
      await new Promise<void>((res) => {
        timer = setTimeout(res, 260);
      });
    }
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 900);
    });
    if (cancelled) return;

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
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 600);
    });
    if (!cancelled) play();
  };

  play();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    [panel, topBar, titleText, footerText, ...rows.flatMap((r) => [r.line, r.check, r.label, r.pts])].forEach(
      (e) => e.destroy(),
    );
  };
}
