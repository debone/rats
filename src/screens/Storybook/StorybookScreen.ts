import { TEXT_STYLE_DEFAULT } from '@/consts';
import { LAYER_NAMES, type AppScreen } from '@/core/window/types';
import { getGameContext } from '@/data/game-context';
import { Button } from '@pixi/ui';
import { Container, Graphics, Text } from 'pixi.js';
import type { DemoEntry } from './demoTypes';
import { REGISTRY } from './registry';
import { app } from '@/main';

const SIDEBAR_W = 170;
const ITEM_H = 14;
const CAT_H  = 15;
const HEADER_H = 22;

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
  private wheelCleanup?: () => void;
  private activeRowBg?: Graphics;

  prepare() {
    const ctx = getGameContext();

    // Full-screen background
    const bg = new Graphics();
    bg.rect(0, 0, this.screenW, this.screenH).fill(0x050510);
    app.stage.addChild(bg);
    this.toDestroy.push(bg);

    // Sidebar background
    const sidebarBg = new Graphics();
    sidebarBg.rect(0, 0, SIDEBAR_W, this.screenH).fill(0x0b0b1a);
    app.stage.addChild(sidebarBg);
    this.toDestroy.push(sidebarBg);

    // Divider
    const div = new Graphics();
    div.rect(SIDEBAR_W, 0, 1, this.screenH).fill(0x1e0e3e);
    app.stage.addChild(div);
    this.toDestroy.push(div);

    // Header
    const header = new Text({
      text: 'STORYBOOK',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, letterSpacing: 2, fill: 0x7733aa, fontWeight: 'bold' },
    });
    header.x = 6;
    header.y = 6;
    app.stage.addChild(header);
    this.toDestroy.push(header);

    // ─── Scrollable list ──────────────────────────────────────────────────
    const listContainer = new Container();
    app.stage.addChild(listContainer);
    this.toDestroy.push(listContainer);

    // Mask clips list to the area below the header
    const listMask = new Graphics();
    listMask.rect(0, HEADER_H, SIDEBAR_W, this.screenH - HEADER_H - 24).fill(0xffffff);
    app.stage.addChild(listMask);
    listContainer.mask = listMask;
    this.toDestroy.push(listMask);

    let curY = 0;
    let lastCat = '';
    let totalListH = 0;

    for (const demo of REGISTRY) {
      if (demo.category !== lastCat) {
        lastCat = demo.category;
        const catLabel = new Text({
          text: demo.category.toUpperCase(),
          style: { ...TEXT_STYLE_DEFAULT, fontSize: 6, fill: 0x4422aa, letterSpacing: 1 },
        });
        catLabel.x = 6;
        catLabel.y = curY + 4;
        listContainer.addChild(catLabel);
        curY += CAT_H;
      }

      const rowY = curY;
      const rowBg = new Graphics();
      rowBg.rect(4, rowY, SIDEBAR_W - 8, ITEM_H).fill(0x111120);
      listContainer.addChild(rowBg);

      const rowLabel = new Text({
        text: demo.name,
        style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0xbbaadd },
      });
      rowLabel.x = 9;
      rowLabel.y = rowY + 3;
      listContainer.addChild(rowLabel);

      rowBg.eventMode = 'static';
      rowBg.cursor = 'pointer';
      const d = demo;
      const rBg = rowBg;
      const rY = rowY;

      rowBg.on('pointerover', () => {
        if (rBg !== this.activeRowBg) {
          rBg.clear();
          rBg.rect(4, rY, SIDEBAR_W - 8, ITEM_H).fill(0x221144);
        }
      });
      rowBg.on('pointerout', () => {
        if (rBg !== this.activeRowBg) {
          rBg.clear();
          rBg.rect(4, rY, SIDEBAR_W - 8, ITEM_H).fill(0x111120);
        }
      });
      rowBg.on('pointerdown', () => {
        if (this.activeRowBg && this.activeRowBg !== rBg) {
          // Deactivate previous
          const prev = this.activeRowBg;
          prev.tint = 0xffffff;
        }
        this.activeRowBg = rBg;
        rBg.tint = 0xffffff;
        rBg.clear();
        rBg.rect(4, rY, SIDEBAR_W - 8, ITEM_H).fill(0x441188);
        this.runDemo(d);
      });

      curY += ITEM_H + 1;
    }
    totalListH = curY;

    // Position list below header
    listContainer.y = HEADER_H;

    // Scroll on wheel
    let scrollY = 0;
    const maxScroll = Math.max(0, totalListH - (this.screenH - HEADER_H - 28));
    const onWheel = (e: WheelEvent) => {
      scrollY = Math.max(-maxScroll, Math.min(0, scrollY - e.deltaY * 0.6));
      listContainer.y = HEADER_H + scrollY;
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    this.wheelCleanup = () => window.removeEventListener('wheel', onWheel);

    // ─── Preview area ─────────────────────────────────────────────────────
    const previewW = this.screenW - SIDEBAR_W - 1;

    const previewContainer = new Container();
    previewContainer.x = SIDEBAR_W + 1;

    const previewMask = new Graphics();
    previewMask.rect(0, 0, previewW, this.screenH).fill(0xffffff);
    previewContainer.addChild(previewMask);
    previewContainer.mask = previewMask;
    app.stage.addChild(previewContainer);
    this.toDestroy.push(previewContainer);

    this.infoText = new Text({
      text: '← pick a demo',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0x443366 },
    });
    this.infoText.x = 6;
    this.infoText.y = 4;
    previewContainer.addChild(this.infoText);

    this.demoRoot = new Container();
    this.demoRoot.y = 16;
    previewContainer.addChild(this.demoRoot);

    // ─── Replay button ────────────────────────────────────────────────────
    const replayBg = new Graphics();
    replayBg.roundRect(4, this.screenH - 20, SIDEBAR_W - 8, 16, 2).fill(0x110a1e);
    replayBg.roundRect(4, this.screenH - 20, SIDEBAR_W - 8, 16, 2).stroke({ color: 0x441166, width: 1 });
    replayBg.eventMode = 'static';
    replayBg.cursor = 'pointer';
    replayBg.on('pointerover', () => replayBg.tint = 0xaa44dd);
    replayBg.on('pointerout', () => replayBg.tint = 0xffffff);
    replayBg.on('pointerdown', () => { if (this.currentDemo) this.runDemo(this.currentDemo); });
    app.stage.addChild(replayBg);
    this.toDestroy.push(replayBg);

    const replayLabel = new Text({
      text: '↺  REPLAY',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x9966cc },
    });
    replayLabel.x = SIDEBAR_W / 2;
    replayLabel.y = this.screenH - 14;
    replayLabel.anchor.set(0.5);
    app.stage.addChild(replayLabel);
    this.toDestroy.push(replayLabel);

    // Scroll hint
    const scrollHint = new Text({
      text: '▲▼ scroll',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 5, fill: 0x2a1a44 },
    });
    scrollHint.x = 6;
    scrollHint.y = this.screenH - 30;
    app.stage.addChild(scrollHint);
    this.toDestroy.push(scrollHint);

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
    const previewH = this.screenH - 16;

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
    this.wheelCleanup?.();
    this.wheelCleanup = undefined;
    this.currentCleanup?.();
    this.currentCleanup = undefined;
    this.toDestroy.forEach((c) => {
      if (!c.destroyed) c.destroy({ children: true });
    });
    this.toDestroy = [];
    this.activeRowBg = undefined;
  }
}
