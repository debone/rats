import { TEXT_STYLE_DEFAULT } from '@/consts';
import type { Camera } from '@/core/camera/camera';
import { getGameContext } from '@/data/game-context';
import { Container, Graphics, Text } from 'pixi.js';
import type { DemoEntry } from './demoTypes';
import { REGISTRY } from './registry';

const SIDEBAR_W = 170;
const ITEM_H = 14;
const CAT_H = 15;
const HEADER_H = 22;

/**
 * Storybook shell. Activated at /?storybook in dev mode.
 *
 * Architecture:
 *   app.stage
 *   ├── camera.viewport  (z=CAMERA_Z_INDEX)  ← demoRoot lives here
 *   └── StorybookScreen  (z=UI_Z_INDEX)       ← sidebar + header, not camera-affected
 *
 * Placing demoRoot inside camera.viewport means shake/zoom/fade effects from
 * camera demos are actually visible. The opaque sidebar background renders on
 * top and covers any content that overflows during a shake.
 */
export class StorybookScreen extends Container {
  static readonly SCREEN_ID = 'storybook';
  static readonly assetBundles = ['preload', 'default'];

  private demoRoot!: Container;
  private camera!: Camera;
  private infoText!: Text;
  private currentDemo?: DemoEntry;
  private currentCleanup?: () => void;
  private screenW = 480;
  private screenH = 640;
  private wheelCleanup?: () => void;
  private activeRowBg?: Graphics;

  prepare() {
    this.camera = getGameContext().camera;

    // ── Sidebar (fixed UI, not camera-affected, part of this Container) ──

    const sidebarBg = new Graphics();
    sidebarBg.rect(0, 0, SIDEBAR_W, this.screenH).fill(0x0b0b1a);
    this.addChild(sidebarBg);

    const div = new Graphics();
    div.rect(SIDEBAR_W, 0, 1, this.screenH).fill(0x1e0e3e);
    this.addChild(div);

    // Header strip across the top of the preview area (covers camera content)
    const previewHeader = new Graphics();
    previewHeader.rect(SIDEBAR_W + 1, 0, this.screenW - SIDEBAR_W - 1, HEADER_H).fill(0x050510);
    this.addChild(previewHeader);

    const header = new Text({
      text: 'STORYBOOK',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, letterSpacing: 2, fill: 0x7733aa, fontWeight: 'bold' },
    });
    header.x = 6;
    header.y = 6;
    this.addChild(header);

    this.infoText = new Text({
      text: '← pick a demo',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0x443366 },
    });
    this.infoText.x = SIDEBAR_W + 6;
    this.infoText.y = 4;
    this.addChild(this.infoText);

    // ── Scrollable demo list ─────────────────────────────────────────────

    const listContainer = new Container();
    this.addChild(listContainer);

    const listMask = new Graphics();
    listMask.rect(0, HEADER_H, SIDEBAR_W, this.screenH - HEADER_H - 24).fill(0xffffff);
    this.addChild(listMask);
    listContainer.mask = listMask;

    // rowYMap lets us redraw a row's background when deselecting it,
    // without needing to re-capture rowY from within each handler closure.
    const rowYMap = new Map<Graphics, number>();

    let curY = 0;
    let lastCat = '';

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
      rowYMap.set(rowBg, rowY);

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
          rBg.clear().rect(4, rY, SIDEBAR_W - 8, ITEM_H).fill(0x221144);
        }
      });
      rowBg.on('pointerout', () => {
        if (rBg !== this.activeRowBg) {
          rBg.clear().rect(4, rY, SIDEBAR_W - 8, ITEM_H).fill(0x111120);
        }
      });
      rowBg.on('pointerdown', () => {
        if (this.activeRowBg && this.activeRowBg !== rBg) {
          const prevY = rowYMap.get(this.activeRowBg) ?? 0;
          this.activeRowBg.clear().rect(4, prevY, SIDEBAR_W - 8, ITEM_H).fill(0x111120);
        }
        this.activeRowBg = rBg;
        rBg.clear().rect(4, rY, SIDEBAR_W - 8, ITEM_H).fill(0x441188);
        this.runDemo(d);
      });

      curY += ITEM_H + 1;
    }

    const totalListH = curY;
    listContainer.y = HEADER_H;

    let scrollY = 0;
    const maxScroll = Math.max(0, totalListH - (this.screenH - HEADER_H - 28));
    const onWheel = (e: WheelEvent) => {
      scrollY = Math.max(-maxScroll, Math.min(0, scrollY - e.deltaY * 0.6));
      listContainer.y = HEADER_H + scrollY;
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    this.wheelCleanup = () => window.removeEventListener('wheel', onWheel);

    // ── Replay / scroll controls ─────────────────────────────────────────

    const scrollHint = new Text({
      text: '▲▼ scroll',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 5, fill: 0x2a1a44 },
    });
    scrollHint.x = 6;
    scrollHint.y = this.screenH - 30;
    this.addChild(scrollHint);

    const replayBg = new Graphics();
    replayBg.roundRect(4, this.screenH - 20, SIDEBAR_W - 8, 16, 2).fill(0x110a1e);
    replayBg.roundRect(4, this.screenH - 20, SIDEBAR_W - 8, 16, 2).stroke({ color: 0x441166, width: 1 });
    replayBg.eventMode = 'static';
    replayBg.cursor = 'pointer';
    replayBg.on('pointerover', () => { replayBg.tint = 0xaa44dd; });
    replayBg.on('pointerout', () => { replayBg.tint = 0xffffff; });
    replayBg.on('pointerdown', () => { if (this.currentDemo) this.runDemo(this.currentDemo); });
    this.addChild(replayBg);

    const replayLabel = new Text({
      text: '↺  REPLAY',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x9966cc },
    });
    replayLabel.anchor.set(0.5);
    replayLabel.x = SIDEBAR_W / 2;
    replayLabel.y = this.screenH - 14;
    this.addChild(replayLabel);

    // ── Demo root inside camera.viewport ────────────────────────────────
    // camera.viewport.position = (screenW/2, screenH/2) after camera.resize().
    // A child at local (cx, cy) in viewport space appears at screen (screenW/2+cx, screenH/2+cy).
    // We offset demoRoot so its (0,0) maps to screen (SIDEBAR_W+1, HEADER_H).
    this.demoRoot = new Container();
    this.syncDemoRootPosition();
    this.camera.viewport.addChild(this.demoRoot);

    if (REGISTRY.length > 0) {
      this.runDemo(REGISTRY[0]);
    }
  }

  private syncDemoRootPosition() {
    this.demoRoot.x = SIDEBAR_W + 1 - this.screenW / 2;
    this.demoRoot.y = HEADER_H - this.screenH / 2;
  }

  private resetCamera() {
    if (!this.camera) return;
    this.camera.stop();
    this.camera.x = 0;
    this.camera.y = 0;
    this.camera.scale = 1;
    this.camera.alpha = 1;
    this.camera.rotation = 0;
  }

  private runDemo(demo: DemoEntry) {
    this.currentCleanup?.();
    this.currentCleanup = undefined;
    this.resetCamera();
    this.demoRoot.removeChildren();

    this.infoText.text = `${demo.category} / ${demo.name}`;
    this.currentDemo = demo;

    const previewW = this.screenW - SIDEBAR_W - 1;
    const previewH = this.screenH - HEADER_H;

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
    if (this.demoRoot) {
      this.syncDemoRootPosition();
    }
  }

  reset() {
    this.wheelCleanup?.();
    this.wheelCleanup = undefined;
    this.currentCleanup?.();
    this.currentCleanup = undefined;
    this.resetCamera();

    if (this.demoRoot && !this.demoRoot.destroyed) {
      this.demoRoot.parent?.removeChild(this.demoRoot);
      this.demoRoot.destroy({ children: true });
    }

    this.removeChildren().forEach((c) => { if (!c.destroyed) c.destroy({ children: true }); });
    this.activeRowBg = undefined;
  }
}
