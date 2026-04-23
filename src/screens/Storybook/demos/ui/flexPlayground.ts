import { Container, Text } from 'pixi.js';
import { LayoutContainer } from '@pixi/layout/components';
import { Button } from '@pixi/ui';
import { TEXT_STYLE_DEFAULT } from '@/consts';

type FlexDir = 'row' | 'column';
type Justify = 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
type Align = 'flex-start' | 'center' | 'flex-end' | 'stretch';

const JUSTIFY: Justify[] = ['flex-start', 'center', 'flex-end', 'space-between', 'space-around'];
const ALIGN: Align[] = ['flex-start', 'center', 'flex-end', 'stretch'];
const BOX_COLORS = [0xff6644, 0xffee22, 0x44ff88, 0x4488ff, 0xcc44ff];

export function flexPlayground(root: Container, w: number, h: number): () => void {
  let dir: FlexDir = 'row';
  let justify: Justify = 'center';
  let align: Align = 'center';

  const PREVIEW_H = h - 180;

  let preview: LayoutContainer | null = null;

  const rebuild = () => {
    if (preview) {
      root.removeChild(preview);
      preview.destroy({ children: true });
    }

    preview = new LayoutContainer({
      layout: {
        width: w,
        height: PREVIEW_H,
        flexDirection: dir,
        justifyContent: justify,
        alignItems: align,
        gap: 8,
        padding: 12,
        backgroundColor: 0x0d0d1e,
        borderColor: 0x221133,
        borderWidth: 1,
      },
    });

    BOX_COLORS.forEach((color) => {
      const box = new LayoutContainer({
        layout: { width: 36, height: 36, backgroundColor: color, borderRadius: 4 },
      });
      preview!.addChild(box);
    });

    root.addChild(preview);
  };

  rebuild();

  // Config label
  const configText = new Text({
    text: '',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0x886699 },
  });
  configText.x = 4;
  configText.y = PREVIEW_H + 4;
  root.addChild(configText);

  const updateLabel = () => {
    configText.text = `flexDirection: '${dir}'  justifyContent: '${justify}'  alignItems: '${align}'`;
  };
  updateLabel();

  // Direction toggle
  const makeToggle = (options: string[], getVal: () => string, setVal: (v: string) => void, label: string, y: number) => {
    const lbl = new Text({ text: label, style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0x8866aa } });
    lbl.x = 4;
    lbl.y = y;
    root.addChild(lbl);

    const btns = options.map((opt, i) => {
      const bg = new LayoutContainer({
        layout: {
          paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3,
          backgroundColor: getVal() === opt ? 0x441166 : 0x111122,
          borderColor: 0x442266,
          borderWidth: 1,
          borderRadius: 3,
        },
      });
      bg.addChild(new Text({ text: opt, style: { ...TEXT_STYLE_DEFAULT, fontSize: 7 }, layout: true }));

      const btn = new Button(bg);
      btn.view!.x = 60 + i * (Math.floor((w - 68) / options.length));
      btn.view!.y = y;
      btn.onPress.connect(() => {
        setVal(opt);
        btns.forEach((b, j) => {
          (b.view!.children[0] as LayoutContainer).background.tint = j === i ? 0x9944bb : 0xffffff;
        });
        rebuild();
        updateLabel();
      });

      root.addChild(btn.view!);
      return btn;
    });

    return btns;
  };

  const dirBtns = makeToggle(
    ['row', 'column'],
    () => dir,
    (v) => { dir = v as FlexDir; },
    'direction:',
    PREVIEW_H + 22,
  );

  const justifyBtns = makeToggle(
    JUSTIFY,
    () => justify,
    (v) => { justify = v as Justify; },
    'justify:',
    PREVIEW_H + 50,
  );

  const alignBtns = makeToggle(
    ALIGN,
    () => align,
    (v) => { align = v as Align; },
    'align:',
    PREVIEW_H + 78,
  );

  return () => {
    preview?.destroy({ children: true });
    configText.destroy();
    [...dirBtns, ...justifyBtns, ...alignBtns].forEach((b) => b.view?.destroy({ children: true }));
    root.removeChildren();
  };
}
