import { animate } from 'animejs';
import { createTimeline } from 'animejs';
import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { shake } from '@/core/camera/effects/shake';
import { getGameContext } from '@/data/game-context';
import { ASSETS } from '@/assets';
import { defineSequence } from '@/core/vfx/types';
import type { SequenceContext } from '@/core/vfx/types';

/**
 * CUTSCENE: Power Up Activate  [sequence]
 *
 * Power-up icon slams in with flash, ripple rings, and name reveal.
 * VFX type: defineSequence — complete choreographed moment with clear start/end.
 */

const POWERS = [
  { name: 'H A S T E', sub: 'Ball speed multiplied', color: 0x44ccff, avatar: 2, ringColor: 0x44aaff },
  { name: 'B L A S T', sub: 'Explosive impact radius', color: 0xff6644, avatar: 1, ringColor: 0xff4422 },
  { name: 'G H O S T', sub: 'Phase through one wall', color: 0xcc44ff, avatar: 3, ringColor: 0xaa22ff },
];

let powerIndex = 0;

const powerUpActivateSequence = defineSequence<{ w: number; h: number }>({
  kind: 'sequence',
  id: 'powerUpActivate',
  async build({ w, h }, { layer }) {
    const gameCtx = getGameContext();
    const power = POWERS[powerIndex % POWERS.length];
    powerIndex++;

    const cx = w / 2;
    const cy = h / 2;

    const flash = new Graphics();
    flash.rect(0, 0, w, h).fill(0xffffff);
    flash.alpha = 0;
    layer.addChild(flash);

    // Colored overlay
    const colorOverlay = new Graphics();
    colorOverlay.rect(0, 0, w, h).fill(power.color);
    colorOverlay.alpha = 0;
    layer.addChild(colorOverlay);

    // Expanding ripple rings
    const ripple = new Graphics();
    layer.addChild(ripple);

    // Burst particles
    const burst = new ParticleEmitter({
      texture: Assets.get(ASSETS.tiles).textures.ball,
      maxParticles: 80,
      emitting: false,
      lifespan: { min: 400, max: 900 },
      speed: { min: 60, max: 220 },
      angle: { min: 0, max: 360 },
      scale: { start: { min: 0.08, max: 0.28 }, end: 0 },
      tint: { start: 0xffffff, end: 0x000066 },
      alpha: { start: 1, end: 0 },
      rotate: { min: -400, max: 400 },
    });
    burst.x = cx;
    burst.y = cy;
    layer.addChild(burst.container);

    // Avatar icon
    const icon = new Sprite(Assets.get(ASSETS.prototype).textures[`avatars_tile_${power.avatar}#0`]);
    icon.anchor.set(0.5);
    icon.width = 56;
    icon.height = 56;
    icon.x = cx;
    icon.y = cy;
    icon.alpha = 0;
    icon.tint = power.color;
    layer.addChild(icon);

    // Name text — large slam
    const nameText = new Text({
      text: power.name,
      style: {
        ...TEXT_STYLE_DEFAULT,
        fontSize: 20,
        letterSpacing: 6,
        fontWeight: 'bold',
        fill: power.color,
      },
    });
    nameText.anchor.set(0.5);
    nameText.x = cx;
    nameText.y = cy + 44;
    nameText.alpha = 0;
    layer.addChild(nameText);

    const subText = new Text({
      text: power.sub,
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0xbbaacc, letterSpacing: 2 },
    });
    subText.anchor.set(0.5);
    subText.x = cx;
    subText.y = cy + 64;
    subText.alpha = 0;
    layer.addChild(subText);

    // Activating line
    const activeLine = new Graphics();
    layer.addChild(activeLine);

    // Flash
    await animate(flash, { alpha: [0, 0.85, 0], duration: 250, ease: 'outQuad' });

    shake(gameCtx.camera, { intensity: 7, duration: 300, frequency: 18 });

    // Color overlay pulses in and out
    animate(colorOverlay, { alpha: [0, 0.18, 0], duration: 500 });

    // Ripple rings expand
    const rp = { r: 0, alpha: 0.9 };
    const rippleAnim = animate(rp, {
      r: Math.max(w, h),
      alpha: 0,
      duration: 700,
      ease: 'outQuad',
      onUpdate: () => {
        ripple
          .clear()
          .circle(cx, cy, rp.r)
          .stroke({ color: power.ringColor, width: 2, alpha: rp.alpha })
          .circle(cx, cy, rp.r * 0.7)
          .stroke({ color: power.ringColor, width: 1, alpha: rp.alpha * 0.5 });
      },
    });

    burst.explode(70);

    // Icon slams in
    await animate(icon, {
      alpha: 1,
      scaleX: [0, 1.2],
      scaleY: [0, 1.2],
      duration: 400,
      ease: 'outBack(3)',
    });
    await animate(icon, { scaleX: 1, scaleY: 1, duration: 200 });

    // Horizontal lines grow from center to edges on both sides of icon
    const lp = { w: 0 };
    await animate(lp, {
      w: w / 2,
      duration: 320,
      ease: 'outQuad',
      onUpdate: () => {
        activeLine
          .clear()
          .rect(cx - lp.w, cy + 28, lp.w * 2, 1)
          .fill({ color: power.color, alpha: 0.6 });
      },
    });

    // Name slams in
    await animate(nameText, {
      alpha: 1,
      scaleX: [0.4, 1],
      scaleY: [0.4, 1],
      duration: 380,
      ease: 'outBack(2)',
    });

    await animate(subText, { alpha: 1, duration: 280 });

    // Icon slow spin during hold
    animate(icon, { rotation: Math.PI * 2, duration: 2000, ease: 'linear' });

    await new Promise<void>((res) => setTimeout(res, 1800));

    rippleAnim.cancel();
    ripple.clear();

    await Promise.all([
      animate(icon, { alpha: 0, scaleX: 1.5, scaleY: 1.5, duration: 380, ease: 'outQuad' }),
      animate(nameText, { alpha: 0, duration: 300 }),
      animate(subText, { alpha: 0, duration: 300 }),
    ]);
    activeLine.clear();
    icon.alpha = 1;
    icon.rotation = 0;

    await new Promise<void>((res) => setTimeout(res, 500));

    // Cleanup
    burst.destroy();
    [flash, colorOverlay, ripple, icon, nameText, subText, activeLine].forEach((e) => e.destroy());
  },
});

export function powerUpActivate(root: Container, w: number, h: number): () => void {
  let cancelled = false;

  const ctx: SequenceContext = {
    camera: null as any,
    layer: root,
    stage: root,
    size: { width: w, height: h },
    cutscene: () => Promise.resolve(),
    timeline: () => createTimeline(),
  };

  const loop = async () => {
    while (!cancelled) {
      await powerUpActivateSequence.build({ w, h }, ctx);
      await new Promise<void>((res) => setTimeout(res, 400));
    }
  };
  loop();

  return () => {
    cancelled = true;
  };
}
