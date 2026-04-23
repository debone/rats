import { CRT2Filter } from '@/lib/CRT/CRT';
import { app } from '@/main';
import { Assets, Container, Graphics, Text, TilingSprite } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';

type Param = { label: string; key: keyof CRT2Filter; min: number; max: number; step: number };

const PARAMS: Param[] = [
  { label: 'curvature', key: 'curvature', min: 0, max: 10, step: 0.1 },
  { label: 'noise', key: 'noise', min: 0, max: 1, step: 0.01 },
  { label: 'vignetting', key: 'vignetting', min: 0, max: 1, step: 0.01 },
  { label: 'lineContrast', key: 'lineContrast', min: 0, max: 1, step: 0.01 },
  { label: 'lineWidth', key: 'lineWidth', min: 0, max: 5, step: 0.05 },
];

export function crtControls(root: Container, w: number, h: number): () => void {
  const crt = new CRT2Filter({ curvature: 2, noise: 0.3, vignetting: 0.4, lineContrast: 0.25, lineWidth: 1 });

  // Preview target — the grid background
  const grid = new TilingSprite({ texture: Assets.get('tiles').textures.grid, width: w, height: h });
  grid.tint = 0x330055;
  root.addChild(grid);

  const label = new Text({
    text: 'CRT MONITOR EFFECT',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 14, letterSpacing: 3 },
  });
  label.anchor.set(0.5);
  label.x = w / 2;
  label.y = h / 2;
  root.addChild(label);

  // Apply filter to preview root
  root.filters = [crt];

  // Controls panel (on top of filter, so we draw them in a sibling container)
  // We need to render controls OUTSIDE the filtered area, but since root is filtered,
  // we just render controls inside and accept they're also CRT'd (looks cool)
  const sliderY0 = h - PARAMS.length * 28 - 10;

  const sliders: { bar: Graphics; valText: Text; isDragging: boolean; param: Param }[] = [];

  PARAMS.forEach((param, i) => {
    const y = sliderY0 + i * 28;
    const BAR_W = w - 100;
    const BAR_X = 80;

    const paramLabel = new Text({
      text: param.label,
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0xaaaaaa },
    });
    paramLabel.x = 4;
    paramLabel.y = y + 3;
    root.addChild(paramLabel);

    const track = new Graphics();
    track.rect(BAR_X, y, BAR_W, 6).fill(0x333355);
    root.addChild(track);

    const bar = new Graphics();
    const norm = ((crt[param.key] as number) - param.min) / (param.max - param.min);
    bar.rect(BAR_X, y, BAR_W * norm, 6).fill(0x9944bb);
    root.addChild(bar);

    const thumb = new Graphics();
    thumb.circle(0, 0, 5).fill(0xffffff);
    thumb.x = BAR_X + BAR_W * norm;
    thumb.y = y + 3;
    thumb.interactive = true;
    thumb.cursor = 'ew-resize';
    root.addChild(thumb);

    const valText = new Text({
      text: (crt[param.key] as number).toFixed(2),
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0xddccff },
    });
    valText.x = BAR_X + BAR_W + 4;
    valText.y = y + 1;
    root.addChild(valText);

    let dragging = false;

    const updateFromX = (gx: number) => {
      const local = root.toLocal({ x: gx, y: 0 });
      const norm = Math.max(0, Math.min(1, (local.x - BAR_X) / BAR_W));
      const val = param.min + norm * (param.max - param.min);
      const snapped = Math.round(val / param.step) * param.step;
      (crt as any)[param.key] = snapped;
      bar.clear().rect(BAR_X, y, BAR_W * norm, 6).fill(0x9944bb);
      thumb.x = BAR_X + BAR_W * norm;
      valText.text = snapped.toFixed(2);
    };

    thumb.on('pointerdown', (e) => { dragging = true; e.stopPropagation(); });
    thumb.on('pointermove', (e) => { if (dragging) updateFromX(e.global.x); });
    thumb.on('pointerup', () => { dragging = false; });
    thumb.on('pointerupoutside', () => { dragging = false; });

    track.interactive = true;
    track.on('pointertap', (e) => updateFromX(e.global.x));

    sliders.push({ bar, valText, isDragging: false, param });
  });

  const tick = (time: { deltaMS: number }) => {
    crt.time += time.deltaMS / 500;
  };
  app.ticker.add(tick);

  return () => {
    app.ticker.remove(tick);
    root.filters = [];
    crt.destroy();
    root.removeChildren().forEach((c) => c.destroy({ children: true }));
  };
}
