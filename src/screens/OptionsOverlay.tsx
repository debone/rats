import { TEXT_STYLE_DEFAULT } from '@/consts';
import { audio, bgm, sfx } from '@/core/audio/audio';
import { storage } from '@/core/storage/storage';
import { LAYER_NAMES, type AppScreen } from '@/core/window/types';
import { getGameContext } from '@/data/game-context';
import { LayoutContainer } from '@pixi/layout/components';
import { Button } from '@pixi/ui';
import { animate } from 'animejs';
import { DropShadowFilter } from 'pixi-filters';
import { Color, Container, Graphics, Text } from 'pixi.js';

function makeButton(label: string) {
  const bg = new LayoutContainer({
    layout: {
      gap: 8,
      paddingTop: 6,
      paddingBottom: 6,
      paddingLeft: 14,
      paddingRight: 14,
      backgroundColor: 0x272736,
      borderColor: 0x57294b,
      borderWidth: 1,
      borderRadius: 3,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
  bg.addChild(new Text({ text: label, style: { ...TEXT_STYLE_DEFAULT, fontSize: 13 }, layout: true }));
  return new Button(bg);
}

class VolumeSlider extends Container {
  private _track: Graphics;
  private _fill: Graphics;
  private _handle: Graphics;
  private _value: number;
  private _onChange: (v: number) => void;
  private readonly _width = 180;
  private readonly _height = 16;
  private _dragging = false;

  constructor(initialValue: number, onChange: (v: number) => void) {
    super();
    this._value = Math.max(0, Math.min(1, initialValue));
    this._onChange = onChange;

    this._track = new Graphics();
    this._fill = new Graphics();
    this._handle = new Graphics();

    this.addChild(this._track);
    this.addChild(this._fill);
    this.addChild(this._handle);

    this.interactive = true;
    this.cursor = 'pointer';

    this._redraw();

    this.on('pointerdown', (e) => {
      this._dragging = true;
      this._updateFromPointer(e.globalX);
    });
    this.on('pointermove', (e) => {
      if (!this._dragging) return;
      this._updateFromPointer(e.globalX);
    });
    this.on('pointerup', () => { this._dragging = false; });
    this.on('pointerupoutside', () => { this._dragging = false; });
  }

  private _updateFromPointer(globalX: number) {
    const local = this.toLocal({ x: globalX, y: 0 });
    const v = Math.max(0, Math.min(1, local.x / this._width));
    this._value = v;
    this._redraw();
    this._onChange(v);
  }

  private _redraw() {
    const w = this._width;
    const h = this._height;
    const cx = this._value * w;

    this._track.clear()
      .roundRect(0, h / 2 - 3, w, 6, 3)
      .fill(0x3a3a4a)
      .stroke({ color: 0x57294b, width: 1 });

    this._fill.clear()
      .roundRect(0, h / 2 - 3, cx, 6, 3)
      .fill(0x9944aa);

    this._handle.clear()
      .circle(cx, h / 2, 8)
      .fill(0xddaaff)
      .stroke({ color: 0x57294b, width: 1 });
  }

}

export class OptionsOverlay extends Container implements AppScreen {
  static readonly SCREEN_ID = 'options';
  static readonly assetBundles = ['default'];
  readonly SCREEN_ID = 'options';

  private _backdrop: Graphics;
  private _panel: LayoutContainer;

  constructor() {
    super({
      layout: {
        backgroundColor: new Color({ r: 0, g: 0, b: 0, a: 0.6 }),
        alignItems: 'center',
        justifyContent: 'center',
      },
    });

    const backdrop = new Graphics().rect(0, 0, 9999, 9999).fill({ color: 0x000000, alpha: 0.6 });
    backdrop.interactive = true;
    this.addChild(backdrop);
    this._backdrop = backdrop;

    const panel = new LayoutContainer({
      layout: {
        backgroundColor: 0x1a1a2e,
        borderColor: 0x57294b,
        borderWidth: 2,
        borderRadius: 8,
        flexDirection: 'column',
        alignItems: 'center',
        gap: 18,
        padding: 24,
        width: 280,
      },
      alpha: 0,
    });

    panel.background.filters = [
      new DropShadowFilter({ color: 0x000000, blur: 16 }),
    ];

    this._panel = panel;
  }

  async prepare() {
    const bgmVol = storage.getOrDefault('bgm_volume', 0.15);
    const sfxVol = storage.getOrDefault('sfx_volume', 1.0);
    const muted = storage.getOrDefault('muted', false);

    const title = new Text({
      text: 'OPTIONS',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 22, letterSpacing: 4 },
      layout: true,
    });

    // --- BGM ---
    const bgmLabel = new Text({
      text: 'Music Volume',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 12 },
      layout: true,
    });

    const bgmSlider = new VolumeSlider(bgmVol, (v) => {
      bgm.setVolume(v);
      storage.set('bgm_volume', v);
    });
    bgmSlider.layout = { width: 180, height: 20, marginTop: 4 };

    // --- SFX ---
    const sfxLabel = new Text({
      text: 'Sound Effects',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 12 },
      layout: true,
    });

    const sfxSlider = new VolumeSlider(sfxVol, (v) => {
      sfx.setVolume(v);
      storage.set('sfx_volume', v);
    });
    sfxSlider.layout = { width: 180, height: 20, marginTop: 4 };

    // --- Mute toggle ---
    const muteBtn = makeButton(muted ? 'Unmute All' : 'Mute All');
    muteBtn.view!.layout = { width: 140 };
    let _muted = muted;
    audio.muted(_muted);
    muteBtn.onPress.connect(() => {
      _muted = !_muted;
      audio.muted(_muted);
      storage.set('muted', _muted);
      const txt = muteBtn.view!.children.find((c) => c instanceof Text) as Text | undefined;
      if (txt) txt.text = _muted ? 'Unmute All' : 'Mute All';
    });

    // --- Divider ---
    const divider = new Graphics().rect(0, 0, 220, 1).fill(0x57294b);
    divider.layout = { width: 220, height: 1 };

    // --- Close button ---
    const closeBtn = makeButton('Close');
    closeBtn.view!.layout = { width: 100 };
    closeBtn.onPress.connect(() => {
      getGameContext().navigation.dismissCurrentOverlay();
    });

    <mount target={this._panel}>
      {title}
      {bgmLabel}
      {bgmSlider}
      {sfxLabel}
      {sfxSlider}
      {muteBtn.view!}
      {divider}
      {closeBtn.view!}
    </mount>;

    this.addChild(this._panel);
    getGameContext().navigation.addToLayer(this, LAYER_NAMES.POPUP);
  }

  async show() {
    await animate(this._panel, { alpha: 1, duration: 250, ease: 'outQuad' });
  }

  async hide() {
    await animate(this._panel, { alpha: 0, duration: 150, ease: 'inQuad' });
  }

  resize(w: number, h: number) {
    this._backdrop.clear().rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.6 });
  }

}
