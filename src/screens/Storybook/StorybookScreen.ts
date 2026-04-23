import { TEXT_STYLE_DEFAULT } from '@/consts';
import { LAYER_NAMES, type AppScreen } from '@/core/window/types';
import { getGameContext } from '@/data/game-context';
import { LayoutContainer } from '@pixi/layout/components';
import { Button } from '@pixi/ui';
import { Container, Graphics, Text } from 'pixi.js';
import type { DemoEntry } from './demoTypes';
import { REGISTRY } from './registry';

const SIDEBAR_W = 155;

export class StorybookScreen extends Container implements AppScreen {
  static readonly SCREEN_ID = 'storybook';
  static readonly assetBundles = ['preload', 'default'];

  private demoRoot!: Container;
  private infoText!: Text;
  private currentDemo?: DemoEntry;
  private currentCleanup?: () => void;
  private screenW = 480;
  private screenH = 640;
  private toDestroy: (Container | Graphics | Text)[] = [];

  prepare() {
    const ctx = getGameContext();

    // Dark full-screen background
    const bg = new Graphics();
    bg.rect(0, 0, this.screenW, this.screenH).fill(0x050510);
    ctx.navigation.addToLayer(bg, LAYER_NAMES.BACKGROUND);
    this.toDestroy.push(bg);

    // Sidebar background
    const sidebarBg = new Graphics();
    sidebarBg.rect(0, 0, SIDEBAR_W, this.screenH).fill(0x0b0b1a);
    ctx.navigation.addToLayer(sidebarBg, LAYER_NAMES.UI);
    this.toDestroy.push(sidebarBg);

    // Divider
    const div = new Graphics();
    div.rect(SIDEBAR_W, 0, 1, this.screenH).fill(0x1e0e3e);
    ctx.navigation.addToLayer(div, LAYER_NAMES.UI);
    this.toDestroy.push(div);

    // Preview area — clipped to right panel
    const previewW = this.screenW - SIDEBAR_W - 1;
    const previewContainer = new Container();
    previewContainer.x = SIDEBAR_W + 1;

    const mask = new Graphics();
    mask.rect(0, 0, previewW, this.screenH).fill(0xffffff);
    previewContainer.addChild(mask);
    previewContainer.mask = mask;
    ctx.navigation.addToLayer(previewContainer, LAYER_NAMES.GAME);
    this.toDestroy.push(previewContainer);

    // Info text at top of preview
    this.infoText = new Text({
      text: '← pick a demo',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0x443366 },
    });
    this.infoText.x = 6;
    this.infoText.y = 6;
    previewContainer.addChild(this.infoText);

    // Demo content container (cleared on each demo switch)
    this.demoRoot = new Container();
    this.demoRoot.y = 18; // below info text
    previewContainer.addChild(this.demoRoot);

    // --- Sidebar ---
    const sidebar = new LayoutContainer({
      layout: {
        width: SIDEBAR_W,
        height: this.screenH - 26,
        flexDirection: 'column',
        gap: 1,
        paddingLeft: 4,
        paddingRight: 4,
        paddingTop: 4,
        overflow: 'hidden',
      },
    });
    ctx.navigation.addToLayer(sidebar, LAYER_NAMES.UI);
    this.toDestroy.push(sidebar);

    // Header
    const header = new Text({
      text: 'STORYBOOK',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, letterSpacing: 2, fill: 0x7733aa, fontWeight: 'bold' },
      layout: { marginBottom: 3 },
    });
    sidebar.addChild(header);

    // Demo list
    let lastCategory = '';
    for (const demo of REGISTRY) {
      if (demo.category !== lastCategory) {
        lastCategory = demo.category;
        const cat = new Text({
          text: demo.category.toUpperCase(),
          style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x5533aa, letterSpacing: 1 },
          layout: { marginTop: 5, marginBottom: 1 },
        });
        sidebar.addChild(cat);
      }

      const itemBg = new LayoutContainer({
        layout: {
          width: SIDEBAR_W - 8,
          paddingLeft: 7,
          paddingTop: 2,
          paddingBottom: 2,
          backgroundColor: 0x111120,
          borderRadius: 2,
        },
      });
      itemBg.addChild(
        new Text({
          text: demo.name,
          style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0xccbbee },
          layout: true,
        }),
      );

      const btn = new Button(itemBg);
      const d = demo;
      btn.onHover.connect(() => { itemBg.background.tint = 0x9944bb; });
      btn.onOut.connect(() => { itemBg.background.tint = 0xffffff; });
      btn.onPress.connect(() => this.runDemo(d));
      sidebar.addChild(btn.view!);
    }

    // Replay button at bottom of sidebar
    const replayBg = new LayoutContainer({
      layout: {
        width: SIDEBAR_W - 8,
        paddingTop: 4,
        paddingBottom: 4,
        backgroundColor: 0x110a1e,
        borderColor: 0x441166,
        borderWidth: 1,
        borderRadius: 2,
        alignItems: 'center',
        justifyContent: 'center',
      },
    });
    replayBg.addChild(
      new Text({ text: '↺  REPLAY', style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0x9966cc }, layout: true }),
    );
    const replayBtn = new Button(replayBg);
    replayBtn.view!.x = 4;
    replayBtn.view!.y = this.screenH - 22;
    replayBtn.onHover.connect(() => { replayBg.background.tint = 0x9944bb; });
    replayBtn.onOut.connect(() => { replayBg.background.tint = 0xffffff; });
    replayBtn.onPress.connect(() => { if (this.currentDemo) this.runDemo(this.currentDemo); });
    ctx.navigation.addToLayer(replayBtn.view!, LAYER_NAMES.UI);
    this.toDestroy.push(replayBtn.view!);

    // Auto-start first demo
    if (REGISTRY.length > 0) {
      this.runDemo(REGISTRY[0]);
    }
  }

  private runDemo(demo: DemoEntry) {
    this.currentCleanup?.();
    this.currentCleanup = undefined;
    this.demoRoot.removeChildren();

    this.infoText.text = `${demo.category} / ${demo.name}`;
    this.currentDemo = demo;

    const previewW = this.screenW - SIDEBAR_W - 1;
    const previewH = this.screenH - 18;

    try {
      this.currentCleanup = demo.setup(this.demoRoot, previewW, previewH);
    } catch (err) {
      console.error(`[Storybook] Demo "${demo.name}" threw during setup:`, err);
    }
  }

  async show() {}

  resize(w: number, h: number) {
    this.screenW = w;
    this.screenH = h;
  }

  reset() {
    this.currentCleanup?.();
    this.currentCleanup = undefined;
    this.toDestroy.forEach((c) => {
      if (!c.destroyed) c.destroy({ children: true });
    });
    this.toDestroy = [];
  }
}
