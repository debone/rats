import { animate } from 'animejs';
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';

const STATS = [
  { label: 'BRICKS', value: '48', pts: 240, color: 0xff8844 },
  { label: 'CHEESE', value: '12', pts: 360, color: 0xffee22 },
  { label: 'COMBO', value: '×8', pts: 180, color: 0xcc44ff },
  { label: 'TIME BONUS', value: '1:42', pts: 100, color: 0x44ccff },
];

export function scoreSummary(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const PW = w - 30;
  const PH = 128;
  const PX = 15;
  const PY = (h - PH) / 2 - 8;

  const panel = new Graphics();
  panel.roundRect(PX, PY, PW, PH, 6).fill(0x0d0d1e).stroke({ color: 0x441166, width: 1 });
  panel.alpha = 0;
  root.addChild(panel);

  const titleText = new Text({
    text: 'R E S U L T S',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 9, letterSpacing: 4, fill: 0x9944bb },
  });
  titleText.anchor.set(0.5);
  titleText.x = w / 2;
  titleText.y = PY + 13;
  titleText.alpha = 0;
  root.addChild(titleText);

  const ROW_H = 20;
  const rowsY0 = PY + 30;

  interface Row { label: Text; line: Graphics; pts: Text }
  const rows: Row[] = [];

  for (let i = 0; i < STATS.length; i++) {
    const s = STATS[i];
    const ry = rowsY0 + i * ROW_H;

    const label = new Text({
      text: `${s.label}   ${s.value}`,
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: s.color },
    });
    label.x = PX + 10;
    label.y = ry;
    label.alpha = 0;
    root.addChild(label);

    const line = new Graphics();
    root.addChild(line);

    const pts = new Text({
      text: `+${s.pts}`,
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0xddaaff },
    });
    pts.anchor.set(1, 0);
    pts.x = PX + PW - 10;
    pts.y = ry;
    pts.alpha = 0;
    root.addChild(pts);

    rows.push({ label, line, pts });
  }

  const divider = new Graphics();
  root.addChild(divider);

  const totalLabel = new Text({
    text: 'TOTAL',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 10, letterSpacing: 3, fontWeight: 'bold', fill: 0xffffff },
  });
  totalLabel.x = PX + 10;
  totalLabel.y = PY + PH - 22;
  totalLabel.alpha = 0;
  root.addChild(totalLabel);

  const totalNum = new Text({
    text: '0',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 12, fontWeight: 'bold', fill: 0xffee44 },
  });
  totalNum.anchor.set(1, 0);
  totalNum.x = PX + PW - 10;
  totalNum.y = PY + PH - 24;
  totalNum.alpha = 0;
  root.addChild(totalNum);

  const resetAll = () => {
    panel.alpha = 0;
    titleText.alpha = 0;
    rows.forEach((r) => { r.label.alpha = 0; r.pts.alpha = 0; r.line.clear(); });
    divider.clear();
    totalLabel.alpha = 0;
    totalNum.alpha = 0;
    totalNum.text = '0';
  };

  const play = async () => {
    if (cancelled) return;
    resetAll();

    // Panel slides up from slight below
    panel.y = 14;
    await animate(panel, { y: 0, alpha: 1, duration: 420, ease: 'outBack(1.2)' });
    if (cancelled) return;

    await animate(titleText, { alpha: 1, duration: 250 });
    if (cancelled) return;

    for (let i = 0; i < rows.length; i++) {
      if (cancelled) return;
      const { label, line, pts } = rows[i];
      const ry = rowsY0 + i * ROW_H;
      const s = STATS[i];

      await animate(label, { alpha: 1, duration: 180 });

      // Dotted line grows from label rightward
      const lp = { w: 0 };
      animate(lp, {
        w: PW - 130,
        duration: 200,
        ease: 'outQuad',
        onUpdate: () => {
          line.clear().rect(PX + 90, ry + 7, lp.w, 1).fill({ color: s.color, alpha: 0.25 });
        },
      });

      await new Promise<void>((res) => { timer = setTimeout(res, 160); });
      if (cancelled) return;

      await animate(pts, { alpha: 1, duration: 140 });

      await new Promise<void>((res) => { timer = setTimeout(res, 60); });
      if (cancelled) return;
    }

    // Divider grows
    const dp = { w: 0 };
    animate(dp, {
      w: PW - 20,
      duration: 300,
      ease: 'outQuad',
      onUpdate: () => {
        divider.clear().rect(PX + 10, PY + PH - 30, dp.w, 1).fill({ color: 0x441166, alpha: 0.9 });
      },
    });

    await new Promise<void>((res) => { timer = setTimeout(res, 300); });
    if (cancelled) return;

    await Promise.all([
      animate(totalLabel, { alpha: 1, duration: 200 }),
      animate(totalNum, { alpha: 1, duration: 200 }),
    ]);
    if (cancelled) return;

    const finalTotal = STATS.reduce((a, s) => a + s.pts, 0);
    const tp = { v: 0 };
    await animate(tp, {
      v: finalTotal,
      duration: 900,
      ease: 'outQuad',
      onUpdate: () => { totalNum.text = `${Math.floor(tp.v)}`; },
    });
    if (cancelled) return;

    animate(totalNum, { scaleX: [1.35, 1], scaleY: [1.35, 1], duration: 350, ease: 'outBack' });

    await new Promise<void>((res) => { timer = setTimeout(res, 2200); });
    if (cancelled) return;

    // Slide out
    await animate(panel, { y: 14, alpha: 0, duration: 350, ease: 'inBack(1.2)' });
    rows.forEach((r) => { animate(r.label, { alpha: 0, duration: 200 }); animate(r.pts, { alpha: 0, duration: 200 }); });
    animate(titleText, { alpha: 0, duration: 200 });
    animate(totalLabel, { alpha: 0, duration: 200 });
    animate(totalNum, { alpha: 0, duration: 200 });
    divider.clear();

    await new Promise<void>((res) => { timer = setTimeout(res, 600); });
    if (!cancelled) play();
  };

  play();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    [panel, titleText, divider, totalLabel, totalNum, ...rows.flatMap((r) => [r.label, r.line, r.pts])].forEach((e) => e.destroy());
  };
}
