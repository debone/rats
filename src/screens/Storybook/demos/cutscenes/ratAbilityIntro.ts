import { animate } from 'animejs';
import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { delay } from '@/core/game/Coroutine';
import { ASSETS } from '@/assets';

const RATS = [
  { avatar: 1, name: 'NUGGETS', ability: 'Free ability once per level', color: 0xffee44 },
  { avatar: 2, name: 'NEON', ability: 'Haste — balls speed up', color: 0x44ffcc },
  { avatar: 3, name: 'RATFATHER', ability: 'More cheese from bricks', color: 0xcc8844 },
];

export function ratAbilityIntro(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let ratIndex = 0;
  let activeParticles: ParticleEmitter | null = null;

  const panel = new Graphics();
  panel.roundRect(w / 2 - 100, -80, 200, 160, 10).fill(0x1a1133);
  panel.alpha = 0;
  root.addChild(panel);

  const avatarSlot = new Graphics();
  avatarSlot.circle(0, 0, 28).fill(0x2a1a4a);
  avatarSlot.x = w / 2;
  avatarSlot.y = h / 2 - 30;
  root.addChild(avatarSlot);

  const avatar = new Sprite();
  avatar.anchor.set(0.5);
  avatar.x = w / 2;
  avatar.y = h / 2 - 30;
  avatar.alpha = 0;
  root.addChild(avatar);

  const nameText = new Text({
    text: '',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 14, letterSpacing: 3, fontWeight: 'bold' },
  });
  nameText.anchor.set(0.5);
  nameText.x = w / 2;
  nameText.y = h / 2 + 16;
  nameText.alpha = 0;
  root.addChild(nameText);

  const abilityText = new Text({
    text: '',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 9, fill: 0xaa88cc },
  });
  abilityText.anchor.set(0.5);
  abilityText.x = w / 2;
  abilityText.y = h / 2 + 36;
  abilityText.alpha = 0;
  root.addChild(abilityText);

  const play = async () => {
    if (cancelled) return;

    const rat = RATS[ratIndex % RATS.length];
    ratIndex++;

    avatar.texture = Assets.get(ASSETS.prototype).textures[`avatars_tile_${rat.avatar}#0`];
    nameText.text = rat.name;
    nameText.style.fill = rat.color;
    abilityText.text = rat.ability;

    // Slide in from below
    panel.y = 60;
    panel.alpha = 0;
    avatar.alpha = 0;
    avatar.y = h / 2 - 30 + 30;
    nameText.alpha = 0;
    abilityText.alpha = 0;

    await Promise.all([
      animate(panel, { y: 0, alpha: 1, duration: 400, ease: 'outBack(1.2)' }),
      animate(avatar, { y: h / 2 - 30, alpha: 1, duration: 350, delay: 80, ease: 'outBack(1.5)' }),
    ]);
    if (cancelled) return;

    await animate(nameText, { alpha: 1, duration: 250 });
    if (cancelled) return;
    await animate(abilityText, { alpha: 1, duration: 250 });
    if (cancelled) return;

    // Burst particles on name reveal
    activeParticles?.destroy();
    activeParticles = new ParticleEmitter({
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
    root.addChild(activeParticles.container);
    activeParticles.explode(25);

    await new Promise<void>((res) => {
      timer = setTimeout(res, 1400);
    });
    if (cancelled) return;

    // Slide out upward
    await Promise.all([
      animate(panel, { y: -60, alpha: 0, duration: 350, ease: 'inBack(1.2)' }),
      animate(avatar, { alpha: 0, duration: 250 }),
      animate(nameText, { alpha: 0, duration: 200 }),
      animate(abilityText, { alpha: 0, duration: 200 }),
    ]);
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 300);
    });
    if (!cancelled) play();
  };

  play();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    activeParticles?.destroy();
    panel.destroy();
    avatar.destroy();
    nameText.destroy();
    abilityText.destroy();
    avatarSlot.destroy();
  };
}
