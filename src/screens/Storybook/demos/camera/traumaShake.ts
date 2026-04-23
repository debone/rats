import { shake } from '@/core/camera/effects/shake';
import { getGameContext } from '@/data/game-context';
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { LayoutContainer } from '@pixi/layout/components';
import { Button } from '@pixi/ui';

type ShakePreset = { label: string; intensity: number; duration: number; frequency: number; color: number };

const PRESETS: ShakePreset[] = [
  { label: 'SMALL HIT',   intensity: 3,  duration: 300, frequency: 12, color: 0x44bbff },
  { label: 'MEDIUM HIT',  intensity: 8,  duration: 500, frequency: 10, color: 0xffcc44 },
  { label: 'BIG IMPACT',  intensity: 18, duration: 700, frequency: 8,  color: 0xff6644 },
  { label: 'EARTHQUAKE',  intensity: 30, duration: 1200, frequency: 6, color: 0xff2222 },
];

export function traumaShake(root: Container, w: number, h: number): () => void {
  const ctx = getGameContext();

  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x0a0a18);
  root.addChild(bg);

  const title = new Text({
    text: 'CAMERA SHAKE',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 16, letterSpacing: 4 },
  });
  title.anchor.set(0.5);
  title.x = w / 2;
  title.y = h / 2 - 80;
  root.addChild(title);

  const sub = new Text({
    text: 'click a preset to trigger',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0x554477 },
  });
  sub.anchor.set(0.5);
  sub.x = w / 2;
  sub.y = h / 2 - 50;
  root.addChild(sub);

  const elements: Container[] = [bg, title, sub];

  PRESETS.forEach((preset, i) => {
    const bg = new LayoutContainer({
      layout: {
        width: w - 40, paddingTop: 10, paddingBottom: 10,
        backgroundColor: 0x11112a,
        borderColor: preset.color,
        borderWidth: 1,
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
      },
    });
    bg.addChild(
      new Text({
        text: `${preset.label}  (intensity ${preset.intensity}, ${preset.duration}ms)`,
        style: { ...TEXT_STYLE_DEFAULT, fontSize: 9, fill: preset.color },
        layout: true,
      })
    );

    const btn = new Button(bg);
    btn.view!.x = 20;
    btn.view!.y = h / 2 + i * 44;
    btn.onHover.connect(() => { bg.background.tint = preset.color; });
    btn.onOut.connect(() => { bg.background.tint = 0xffffff; });
    btn.onPress.connect(() => {
      shake(ctx.camera, {
        intensity: preset.intensity,
        duration: preset.duration,
        frequency: preset.frequency,
        decay: true,
      });
    });

    root.addChild(btn.view!);
    elements.push(btn.view!);
  });

  return () => {
    elements.forEach((el) => el.destroy({ children: true }));
  };
}
