import { animate } from 'animejs';
import { createTimeline } from 'animejs';
import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { ASSETS } from '@/assets';
import { defineSequence } from '@/core/vfx/types';
import type { SequenceContext } from '@/core/vfx/types';

/**
 * CUTSCENE: Rat Ability Intro  [sequence]
 *
 * Rat portrait slides in with ability text and particle burst.
 * VFX type: defineSequence — complete choreographed moment with clear start/end.
 */

const RATS = [
  { avatar: 1, name: 'NUGGETS', ability: 'Free ability once per level', color: 0xffee44 },
  { avatar: 2, name: 'NEON', ability: 'Haste — balls speed up', color: 0x44ffcc },
  { avatar: 3, name: 'RATFATHER', ability: 'More cheese from bricks', color: 0xcc8844 },
];

let ratIndex = 0;

const ratAbilityIntroSequence = defineSequence<{ w: number; h: number }>({
  kind: 'sequence',
  id: 'ratAbilityIntro',
  async build({ w, h }, { layer }) {
    const rat = RATS[ratIndex % RATS.length];
    ratIndex++;

    const panel = new Graphics();
    panel.roundRect(w / 2 - 100, -80, 200, 160, 10).fill(0x1a1133);
    panel.alpha = 0;
    panel.y = 60;
    layer.addChild(panel);

    const avatarSlot = new Graphics();
    avatarSlot.circle(0, 0, 28).fill(0x2a1a4a);
    avatarSlot.x = w / 2;
    avatarSlot.y = h / 2 - 30;
    layer.addChild(avatarSlot);

    const avatar = new Sprite(Assets.get(ASSETS.prototype).textures[`avatars_tile_${rat.avatar}#0`]);
    avatar.anchor.set(0.5);
    avatar.x = w / 2;
    avatar.y = h / 2 - 30 + 30;
    avatar.alpha = 0;
    layer.addChild(avatar);

    const nameText = new Text({
      text: rat.name,
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 14, letterSpacing: 3, fontWeight: 'bold', fill: rat.color },
    });
    nameText.anchor.set(0.5);
    nameText.x = w / 2;
    nameText.y = h / 2 + 16;
    nameText.alpha = 0;
    layer.addChild(nameText);

    const abilityText = new Text({
      text: rat.ability,
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 9, fill: 0xaa88cc },
    });
    abilityText.anchor.set(0.5);
    abilityText.x = w / 2;
    abilityText.y = h / 2 + 36;
    abilityText.alpha = 0;
    layer.addChild(abilityText);

    // Slide in from below
    await Promise.all([
      animate(panel, { y: 0, alpha: 1, duration: 400, ease: 'outBack(1.2)' }),
      animate(avatar, { y: h / 2 - 30, alpha: 1, duration: 350, delay: 80, ease: 'outBack(1.5)' }),
    ]);

    await animate(nameText, { alpha: 1, duration: 250 });
    await animate(abilityText, { alpha: 1, duration: 250 });

    // Burst particles on name reveal
    const activeParticles = new ParticleEmitter({
      texture: Assets.get('tiles').textures.ball,
      maxParticles: 30,
      emitting: false,
      lifespan: { min: 300, max: 600 },
      speed: { min: 30, max: 100 },
      angle: { min: 0, max: 360 },
      scale: { start: { min: 0.1, max: 0.3 }, end: 0 },
      tint: rat.color,
      alpha: { start: 1, end: 0 },
    });
    activeParticles.x = w / 2;
    activeParticles.y = h / 2 - 30;
    layer.addChild(activeParticles.container);
    activeParticles.explode(25);

    await new Promise<void>((res) => setTimeout(res, 1400));

    // Slide out upward
    await Promise.all([
      animate(panel, { y: -60, alpha: 0, duration: 350, ease: 'inBack(1.2)' }),
      animate(avatar, { alpha: 0, duration: 250 }),
      animate(nameText, { alpha: 0, duration: 200 }),
      animate(abilityText, { alpha: 0, duration: 200 }),
    ]);

    await new Promise<void>((res) => setTimeout(res, 300));

    // Cleanup
    activeParticles.destroy();
    panel.destroy();
    avatar.destroy();
    nameText.destroy();
    abilityText.destroy();
    avatarSlot.destroy();
  },
});

export function ratAbilityIntro(root: Container, w: number, h: number): () => void {
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
      await ratAbilityIntroSequence.build({ w, h }, ctx);
      await new Promise<void>((res) => setTimeout(res, 400));
    }
  };
  loop();

  return () => {
    cancelled = true;
  };
}
