import { Assets, ColorMatrixFilter, Container, Graphics, Sprite, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { LayoutContainer } from '@pixi/layout/components';
import { Button } from '@pixi/ui';
import { ASSETS } from '@/assets';

const PRESETS: { label: string; apply: (f: ColorMatrixFilter) => void }[] = [
  { label: 'NORMAL', apply: (f) => f.reset() },
  {
    label: 'SEPIA',
    apply: (f) => {
      f.reset();
      f.sepia(true);
    },
  },
  {
    label: 'GRAYSCALE',
    apply: (f) => {
      f.reset();
      f.greyscale(1, true);
    },
  },
  {
    label: 'INVERT',
    apply: (f) => {
      f.reset();
      f.negative(true);
    },
  },
  {
    label: 'SATURATE',
    apply: (f) => {
      f.reset();
      f.saturate(2, true);
    },
  },
  {
    label: 'HUE +90',
    apply: (f) => {
      f.reset();
      f.hue(90, true);
    },
  },
  {
    label: 'NIGHT',
    apply: (f) => {
      f.reset();
      f.night(0.5, true);
    },
  },
  {
    label: 'VINTAGE',
    apply: (f) => {
      f.reset();
      f.vintage(true);
    },
  },
];

export function colorMatrix(root: Container, w: number, h: number): () => void {
  const filter = new ColorMatrixFilter();

  const subject = new Container();
  root.addChild(subject);
  subject.filters = [filter];

  // Cheese icon as subject
  const cheeseTexture = Assets.get(ASSETS.prototype).textures['cheese_tile_1#0'];
  const icon = new Sprite(cheeseTexture);
  icon.anchor.set(0.5);
  icon.scale.set(3);
  icon.x = w / 2;
  icon.y = h / 2 - 40;
  subject.addChild(icon);

  const bg = new Graphics();
  bg.roundRect(w / 2 - 60, h / 2 - 90, 120, 120, 8).fill(0x1a1a2e);
  subject.addChildAt(bg, 0);

  const filterLabel = new Text({
    text: 'NORMAL',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 11, letterSpacing: 1, fill: 0xddccff },
  });
  filterLabel.anchor.set(0.5);
  filterLabel.x = w / 2;
  filterLabel.y = h / 2 + 20;
  root.addChild(filterLabel);

  // Preset buttons
  const btnContainer = new Container();
  root.addChild(btnContainer);

  const COLS = 4;
  const btnW = (w - 8) / COLS;

  const btns: (Container | null)[] = [];

  PRESETS.forEach((preset, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);

    const bg = new LayoutContainer({
      layout: {
        width: btnW - 4,
        paddingTop: 5,
        paddingBottom: 5,
        backgroundColor: 0x15152a,
        borderColor: 0x442266,
        borderWidth: 1,
        borderRadius: 3,
        alignItems: 'center',
        justifyContent: 'center',
      },
    });
    bg.addChild(new Text({ text: preset.label, style: { ...TEXT_STYLE_DEFAULT, fontSize: 7 }, layout: true }));

    const btn = new Button(bg);
    btn.view!.x = 4 + col * btnW;
    btn.view!.y = h - 80 + row * 36;
    btn.onHover.connect(() => {
      bg.background.tint = 0x9944bb;
    });
    btn.onOut.connect(() => {
      bg.background.tint = 0xffffff;
    });
    btn.onPress.connect(() => {
      preset.apply(filter);
      filterLabel.text = preset.label;
    });

    btnContainer.addChild(btn.view!);
    btns.push(btn.view);
  });

  return () => {
    filter.destroy();
    subject.destroy({ children: true });
    filterLabel.destroy();
    btnContainer.destroy({ children: true });
  };
}
