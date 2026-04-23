import { zoom } from '@/core/camera/effects/zoom';
import { shake } from '@/core/camera/effects/shake';
import { fade } from '@/core/camera/effects/fade';
import { getGameContext } from '@/data/game-context';
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { delay } from '@/core/game/Coroutine';
import { LayoutContainer } from '@pixi/layout/components';
import { Button } from '@pixi/ui';

export function punchShakeFade(root: Container, w: number, h: number): () => void {
  const ctx = getGameContext();

  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x08080f);
  root.addChild(bg);

  const label = new Text({
    text: 'COMBO EFFECT',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 18, letterSpacing: 4 },
  });
  label.anchor.set(0.5);
  label.x = w / 2;
  label.y = h / 2 - 80;
  root.addChild(label);

  const sub = new Text({
    text: 'punch zoom → shake → fade → return',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0x554477 },
  });
  sub.anchor.set(0.5);
  sub.x = w / 2;
  sub.y = h / 2 - 50;
  root.addChild(sub);

  let running = false;
  let cancelled = false;

  const trigger = async () => {
    if (running) return;
    running = true;

    // Punch zoom in fast
    await zoom(ctx.camera, { scale: 1.25, duration: 80, easing: 'outSine' });
    if (cancelled) return;

    // Shake while zoomed
    shake(ctx.camera, { intensity: 12, duration: 600, frequency: 16, decay: true });
    await delay(200);
    if (cancelled) return;

    // Zoom back out
    await zoom(ctx.camera, { scale: 1, duration: 400, easing: 'outSine' });
    if (cancelled) return;

    await delay(300);
    if (cancelled) return;

    // Fade to black and back
    await fade(ctx.camera, { to: 0, duration: 300 });
    if (cancelled) return;
    await delay(100);
    await fade(ctx.camera, { to: 1, duration: 400 });

    running = false;
  };

  const btnBg = new LayoutContainer({
    layout: {
      width: 200, paddingTop: 14, paddingBottom: 14,
      backgroundColor: 0x1a0d2e,
      borderColor: 0xcc2244,
      borderWidth: 2,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
  btnBg.addChild(
    new Text({ text: '⚡ TRIGGER', style: { ...TEXT_STYLE_DEFAULT, fontSize: 12, fill: 0xff4466 }, layout: true })
  );
  const btn = new Button(btnBg);
  btn.view!.x = w / 2 - 100;
  btn.view!.y = h / 2 + 20;
  btn.onHover.connect(() => { btnBg.background.tint = 0xff4466; });
  btn.onOut.connect(() => { btnBg.background.tint = 0xffffff; });
  btn.onDown.connect(() => { btnBg.scale.set(0.96); });
  btn.onUp.connect(() => { btnBg.scale.set(1); });
  btn.onPress.connect(trigger);
  root.addChild(btn.view!);

  return () => {
    cancelled = true;
    running = false;
    zoom(ctx.camera, { scale: 1, duration: 0 });
    fade(ctx.camera, { to: 1, duration: 0 });
    bg.destroy();
    label.destroy();
    sub.destroy();
    btn.view?.destroy({ children: true });
  };
}
