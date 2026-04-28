import { animate } from 'animejs';
import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';

const CREW = [
  { avatar: 1, name: 'NUGGETS', ability: 'Free ability once per level', color: 0xffee44 },
  { avatar: 2, name: 'NEON', ability: 'Haste — balls speed up', color: 0x44ffcc },
  { avatar: 3, name: 'RATFATHER', ability: 'More cheese per brick', color: 0xcc8844 },
];

export function crewJoin(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let ringAnim: ReturnType<typeof animate> | null = null;
  let crewIndex = 0;

  const cx = w / 2;
  const cy = h / 2 - 10;

  const overlay = new Graphics();
  overlay.rect(0, 0, w, h).fill(0x000000);
  overlay.alpha = 0;
  root.addChild(overlay);

  // Glow ring (animated via proxy)
  const glowRing = new Graphics();
  root.addChild(glowRing);

  const avatarBg = new Graphics();
  avatarBg.circle(cx, cy, 32).fill(0x1a1033);
  avatarBg.alpha = 0;
  root.addChild(avatarBg);

  const avatar = new Sprite();
  avatar.anchor.set(0.5);
  avatar.width = 52;
  avatar.height = 52;
  avatar.x = cx;
  avatar.y = cy;
  avatar.alpha = 0;
  root.addChild(avatar);

  const bannerText = new Text({
    text: 'NEW ALLY',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, letterSpacing: 6, fill: 0x9944bb },
  });
  bannerText.anchor.set(0.5);
  bannerText.x = cx;
  bannerText.y = cy - 58;
  bannerText.alpha = 0;
  root.addChild(bannerText);

  const joinsText = new Text({
    text: 'JOINS YOUR CREW!',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 10, letterSpacing: 2, fill: 0xffffff, fontWeight: 'bold' },
  });
  joinsText.anchor.set(0.5);
  joinsText.x = cx;
  joinsText.y = cy + 50;
  joinsText.alpha = 0;
  root.addChild(joinsText);

  const nameText = new Text({
    text: '',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 14, letterSpacing: 2, fontWeight: 'bold' },
  });
  nameText.anchor.set(0.5);
  nameText.x = cx;
  nameText.y = cy + 66;
  nameText.alpha = 0;
  root.addChild(nameText);

  const abilityText = new Text({
    text: '',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0xaa88cc },
  });
  abilityText.anchor.set(0.5);
  abilityText.x = cx;
  abilityText.y = cy + 82;
  abilityText.alpha = 0;
  root.addChild(abilityText);

  const confetti = new ParticleEmitter({
    texture: Assets.get('tiles').textures.ball,
    maxParticles: 60,
    emitting: false,
    lifespan: { min: 500, max: 1000 },
    speed: { min: 40, max: 160 },
    angle: { min: 0, max: 360 },
    scale: { start: { min: 0.08, max: 0.22 }, end: 0 },
    tint: { start: 0xffee44, end: 0xff44cc },
    alpha: { start: 1, end: 0 },
    rotate: { min: -300, max: 300 },
    gravityY: 80,
  });
  confetti.x = cx;
  confetti.y = cy;
  root.addChild(confetti.container);

  const startRingPulse = (color: number) => {
    ringAnim?.cancel();
    const rp = { r: 34, alpha: 0.9 };
    const draw = () => {
      glowRing.clear()
        .circle(cx, cy, rp.r).stroke({ color, width: 3, alpha: rp.alpha })
        .circle(cx, cy, rp.r + 10).stroke({ color, width: 1, alpha: rp.alpha * 0.3 });
    };
    ringAnim = animate(rp, { r: 58, alpha: 0, duration: 900, loop: true, ease: 'outQuad', onUpdate: draw });
  };

  const play = async () => {
    if (cancelled) return;

    const crew = CREW[crewIndex % CREW.length];
    crewIndex++;

    overlay.alpha = 0;
    bannerText.alpha = 0;
    avatarBg.alpha = 0;
    avatar.alpha = 0;
    avatar.scale.set(0);
    avatar.y = cy + 40;
    joinsText.alpha = 0;
    nameText.alpha = 0;
    abilityText.alpha = 0;
    ringAnim?.cancel();
    glowRing.clear();

    avatar.texture = Assets.get('prototype').textures[`avatars_tile_${crew.avatar}#0`];
    nameText.text = crew.name;
    nameText.style.fill = crew.color;
    abilityText.text = crew.ability;

    await animate(overlay, { alpha: 0.72, duration: 320 });
    if (cancelled) return;

    await animate(bannerText, { alpha: 1, duration: 280 });
    if (cancelled) return;

    // Avatar slides up from below
    await Promise.all([
      animate(avatarBg, { alpha: 1, duration: 300 }),
      animate(avatar, { y: cy, alpha: 1, scaleX: [0, 1], scaleY: [0, 1], duration: 460, ease: 'outBack(2)' }),
    ]);
    if (cancelled) return;

    startRingPulse(crew.color);
    confetti.explode(45);

    await animate(joinsText, { alpha: 1, duration: 280 });
    if (cancelled) return;
    await animate(nameText, { alpha: 1, duration: 220 });
    if (cancelled) return;
    await animate(abilityText, { alpha: 1, duration: 220 });
    if (cancelled) return;

    await new Promise<void>((res) => { timer = setTimeout(res, 1800); });
    if (cancelled) return;

    ringAnim?.cancel();
    glowRing.clear();

    await Promise.all([
      animate(overlay, { alpha: 0, duration: 400 }),
      animate(bannerText, { alpha: 0, duration: 280 }),
      animate(avatarBg, { alpha: 0, duration: 280 }),
      animate(avatar, { y: cy - 30, alpha: 0, scaleX: 0, scaleY: 0, duration: 340, ease: 'inBack(2)' }),
      animate(joinsText, { alpha: 0, duration: 280 }),
      animate(nameText, { alpha: 0, duration: 280 }),
      animate(abilityText, { alpha: 0, duration: 280 }),
    ]);
    if (cancelled) return;

    await new Promise<void>((res) => { timer = setTimeout(res, 500); });
    if (!cancelled) play();
  };

  play();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    ringAnim?.cancel();
    confetti.destroy();
    [overlay, glowRing, avatarBg, avatar, bannerText, joinsText, nameText, abilityText].forEach((e) => e.destroy());
  };
}
