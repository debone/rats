import { ASSETS } from '@/assets';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { bgm, sfx } from '@/core/audio/audio';
import { computed, signal } from '@/core/reactivity/signals/signals';
import { LAYER_NAMES, type AppScreen } from '@/core/window/types';
import { getGameContext } from '@/data/game-context';
import { LayoutContainer } from '@pixi/layout/components';
import { animate } from 'animejs';
import { DropShadowFilter } from 'pixi-filters';
import { Container, Graphics } from 'pixi.js';
import { MenuButton } from './components/MenuButton';
import { VolumeSlider } from './components/VolumeSlider';

export class OptionsOverlay extends Container implements AppScreen {
  static readonly SCREEN_ID = 'options-overlay';
  static readonly assetBundles = ['default'];
  readonly SCREEN_ID = 'options-overlay';

  private _backdrop!: Graphics;
  private _panel!: LayoutContainer;

  constructor() {
    super({
      layout: {
        backgroundColor: 0x272736,
        alignItems: 'center',
        justifyContent: 'center',
      },
      alpha: 0,
    });
  }

  async prepare() {
    const ctx = getGameContext();
    const navigation = ctx.navigation;

    const backdrop = new Graphics();
    backdrop.rect(0, 0, navigation.width, navigation.height);
    backdrop.interactive = true;
    backdrop.fill(0x272736);
    backdrop.alpha = 0.5;
    backdrop.interactive = true;
    backdrop.on('pointerdown', () => {
      ctx.navigation.dismissCurrentOverlay();
    });

    this._backdrop = backdrop;
    this.addChild(this._backdrop);

    const panel = new LayoutContainer({
      layout: {
        height: 300,
        backgroundColor: 0x1a1a2e,
        borderColor: 0x57294b,
        borderWidth: 2,
        borderRadius: 10,
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        padding: 20,
        width: 280,
      },
    });

    panel.background.filters = [
      new DropShadowFilter({
        color: 0x000000,
        blur: 16,
      }),
    ];

    // TODO: actually attach these to audio
    // TODO: actually save the volume to storage
    // TODO: actually load the volume from storage
    // TODO: make the mute button work

    const muted = signal(false);
    const bgmVolume = signal(bgm.getVolume());
    const sfxVolume = signal(sfx.getVolume());

    let lastBgmVolume = 0;
    let lastSfxVolume = 0;
    const muteBtn = (
      <MenuButton
        label={computed(() => (muted.get() ? 'Unmute All' : 'Mute All'))}
        onPress={() => {
          if (muted.get()) {
            bgmVolume.set(lastBgmVolume);
            sfxVolume.set(lastSfxVolume);
          } else {
            lastBgmVolume = bgm.getVolume();
            lastSfxVolume = sfx.getVolume();
            bgmVolume.set(0);
            sfxVolume.set(0);
          }
          muted.set(!muted.get());
        }}
      />
    );

    // --- Divider ---
    const divider = new Graphics().rect(0, 0, 220, 1).fill(0x57294b);
    divider.layout = { width: 220, height: 1 };

    // --- Close button ---
    const closeBtn = <MenuButton label="Close" onPress={() => getGameContext().navigation.dismissCurrentOverlay()} />;

    <mount target={panel}>
      <text text="Options" style={{ ...TEXT_STYLE_DEFAULT, fontSize: 22, letterSpacing: 4 }} layout={true} />
      <text text="Music Volume" style={{ ...TEXT_STYLE_DEFAULT, fontSize: 12 }} layout={true} />
      <VolumeSlider
        value={bgmVolume}
        onChange={(value) => bgm.setVolume(value)}
        onUpdate={(value) => bgm.setVolume(value)}
      />
      <text text="Sound Volume" style={{ ...TEXT_STYLE_DEFAULT, fontSize: 12 }} layout={true} />
      <VolumeSlider
        value={sfxVolume}
        onUpdate={(value) => {
          sfx.setVolume(value);
        }}
        onChange={(value) => {
          sfx.play(ASSETS.sounds_Wood_Board_A);
          sfx.setVolume(value);
        }}
      />
      {muteBtn}
      {divider}
      {closeBtn}
    </mount>;

    this.addChild(panel);
    this._panel = panel;
    ctx.navigation.addToLayer(this, LAYER_NAMES.POPUP, true);
  }

  private _syncPanelMarginTop() {
    const rest = 100;
    const offset = 100;
    this._panel.layout!.setStyle({ marginTop: rest + offset * (1 - this.alpha) });
  }

  async show() {
    this._panel.layout!.setStyle({ marginTop: 200 });
    await animate(this, {
      alpha: 1,
      duration: 250,
      ease: 'outQuad',
      onUpdate: () => this._syncPanelMarginTop(),
      onComplete: () => this._panel.layout!.setStyle({ marginTop: 100 }),
    });
  }

  async hide() {
    animate(this._panel, {
      alpha: 0,
      duration: 220,
      ease: 'inQuad',
    });

    await animate(this, {
      alpha: 0,
      duration: 250,
      ease: 'inQuad',
      onUpdate: () => this._syncPanelMarginTop(),
      onComplete: () => this._panel.layout!.setStyle({ marginTop: 200 }),
    });
  }

  resize(width: number, height: number) {
    this._backdrop.clear();
    this._backdrop.rect(0, 0, width, height);
    this._backdrop.fill(0x272736);
    this._backdrop.alpha = 0.5;
  }
}
