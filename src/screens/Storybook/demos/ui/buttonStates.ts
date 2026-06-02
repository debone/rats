import { Container, Text } from 'pixi.js';
import { LayoutContainer } from '@pixi/layout/components';
import { Button } from '@pixi/ui';
import { TEXT_STYLE_DEFAULT } from '@/consts';

export function buttonStates(root: Container, w: number, h: number): () => void {
  const BTN_W = 160;
  const GAP = 20;
  const startY = h / 2 - 100;

  type BtnStyle = { label: string; bg: number; border: number; hoverTint: number; pressTint: number; disabled?: boolean };

  const configs: BtnStyle[] = [
    { label: 'PRIMARY',  bg: 0x1a0d2e, border: 0x9944bb, hoverTint: 0xcc88ff, pressTint: 0x6622aa },
    { label: 'SUCCESS',  bg: 0x0d2e1a, border: 0x44bb66, hoverTint: 0x88ffaa, pressTint: 0x226644 },
    { label: 'DANGER',   bg: 0x2e0d0d, border: 0xbb4444, hoverTint: 0xff8888, pressTint: 0xaa2222 },
    { label: 'DISABLED', bg: 0x1a1a1a, border: 0x333333, hoverTint: 0x333333, pressTint: 0x333333, disabled: true },
  ];

  const elements: Container[] = [];

  configs.forEach((cfg, i) => {
    const bg = new LayoutContainer({
      layout: {
        width: BTN_W,
        paddingTop: 12, paddingBottom: 12,
        backgroundColor: cfg.bg,
        borderColor: cfg.border,
        borderWidth: 2,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
      },
    });
    bg.addChild(
      new Text({
        text: cfg.label,
        style: { ...TEXT_STYLE_DEFAULT, fontSize: 11, letterSpacing: 2, fill: cfg.disabled ? 0x555555 : 0xffffff },
        layout: true,
      })
    );

    const btn = new Button(bg);
    if (!cfg.disabled) {
      btn.onHover.connect(() => { bg.background.tint = cfg.hoverTint; });
      btn.onOut.connect(() => { bg.background.tint = 0xffffff; });
      btn.onDown.connect(() => { bg.background.tint = cfg.pressTint; bg.scale.set(0.96); });
      btn.onUp.connect(() => { bg.background.tint = cfg.hoverTint; bg.scale.set(1); });
      btn.onPress.connect(() => {
        // sfx.play(ASSETS.sounds_Rat_Squeak_A, { volume: 0.3 });
      });
    }
    btn.enabled = !cfg.disabled;

    btn.view!.x = w / 2 - BTN_W / 2;
    btn.view!.y = startY + i * (40 + GAP);
    root.addChild(btn.view!);
    elements.push(btn.view!);

    // State label
    const stateLbl = new Text({
      text: cfg.disabled ? 'disabled' : 'hover / press / click',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x664488 },
    });
    stateLbl.x = w / 2 + BTN_W / 2 + 8;
    stateLbl.y = startY + i * (40 + GAP) + 12;
    root.addChild(stateLbl);
    elements.push(stateLbl);
  });

  return () => {
    elements.forEach((el) => el.destroy({ children: true }));
  };
}
