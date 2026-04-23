import { ReflectionFilter2 } from '@/lib/ReflectionFilter/ReflectionFilter';
import { app } from '@/main';
import { Assets, Container, Graphics, Text, TilingSprite } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';

export function reflectionControls(root: Container, w: number, h: number): () => void {
  const mirror = new ReflectionFilter2({
    alpha: [1.0, 0.0],
    amplitude: [20, 120],
    boundary: 0.5,
  });

  const grid = new TilingSprite({ texture: Assets.get('tiles').textures.grid, width: w, height: h / 2 });
  grid.tint = 0x112233;
  root.addChild(grid);

  const ball = new Text({
    text: '🔮',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 32 },
  });
  ball.anchor.set(0.5);
  ball.x = w / 2;
  ball.y = h / 4;
  root.addChild(ball);

  const label = new Text({
    text: 'REFLECTION FILTER',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 12, letterSpacing: 2 },
  });
  label.anchor.set(0.5);
  label.x = w / 2;
  label.y = h / 4 + 50;
  root.addChild(label);

  root.filters = [mirror];

  // Simple controls: boundary slider
  const sliderY = h - 60;
  const BAR_W = w - 60;
  const BAR_X = 30;

  const paramLabel = new Text({
    text: 'boundary',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0xaaaaaa },
  });
  paramLabel.x = 4;
  paramLabel.y = sliderY + 2;
  root.addChild(paramLabel);

  const track = new Graphics();
  track.rect(BAR_X, sliderY, BAR_W, 6).fill(0x223344);
  track.interactive = true;
  root.addChild(track);

  let norm = 0.5;
  const bar = new Graphics();
  const valText = new Text({
    text: '0.50',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0xddccff },
  });
  valText.x = BAR_X + BAR_W + 4;
  valText.y = sliderY + 1;
  root.addChild(valText);

  const redraw = () => {
    bar.clear().rect(BAR_X, sliderY, BAR_W * norm, 6).fill(0x4488cc);
    mirror.boundary = norm;
    valText.text = norm.toFixed(2);
  };
  root.addChild(bar);
  redraw();

  track.on('pointertap', (e) => {
    const local = root.toLocal({ x: e.global.x, y: 0 });
    norm = Math.max(0, Math.min(1, (local.x - BAR_X) / BAR_W));
    redraw();
  });

  const tick = (time: { deltaMS: number }) => {
    mirror.time += time.deltaMS / 200;
  };
  app.ticker.add(tick);

  return () => {
    app.ticker.remove(tick);
    root.filters = [];
    mirror.destroy();
    root.removeChildren().forEach((c) => c.destroy({ children: true }));
  };
}
