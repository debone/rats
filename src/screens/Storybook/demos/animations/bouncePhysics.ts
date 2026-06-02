import { animate } from 'animejs';
import { Assets, Container, Sprite } from 'pixi.js';

export function bouncePhysics(root: Container, w: number, h: number): () => void {
  const texture = Assets.get('tiles').textures.ball;
  const ball = new Sprite(texture);
  ball.anchor.set(0.5);
  ball.scale.set(1.5);
  ball.x = w / 2;
  ball.y = 80;
  ball.tint = 0xaaddff;
  root.addChild(ball);

  // Shadow ellipse
  const shadow = new Sprite(texture);
  shadow.anchor.set(0.5);
  shadow.x = w / 2;
  shadow.y = h - 60;
  shadow.tint = 0x000000;
  shadow.alpha = 0.4;
  shadow.scale.set(1.2, 0.3);
  root.addChild(shadow);

  const FLOOR = h - 60;
  const TOP = 80;

  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const play = async () => {
    if (cancelled) return;

    ball.y = TOP;
    ball.scale.set(1.5);

    // Drop
    await animate(ball, {
      y: FLOOR,
      scaleX: [1.5, 1.3],
      scaleY: [1.5, 1.7],
      duration: 600,
      ease: 'inQuad',
    });
    if (cancelled) return;

    // Squash on impact
    await animate(ball, {
      scaleX: 2.1,
      scaleY: 0.9,
      duration: 80,
      ease: 'outSine',
    });
    if (cancelled) return;

    // Bounce up (smaller)
    await animate(ball, {
      y: TOP + 100,
      scaleX: 1.2,
      scaleY: 1.8,
      duration: 380,
      ease: 'outQuad',
    });
    if (cancelled) return;

    await animate(ball, {
      y: FLOOR,
      scaleX: 1.8,
      scaleY: 1.2,
      duration: 320,
      ease: 'inQuad',
    });
    if (cancelled) return;

    // Small squash
    await animate(ball, {
      scaleX: 1.9,
      scaleY: 0.95,
      duration: 60,
      ease: 'outSine',
    });
    if (cancelled) return;

    // Tiny bounce
    await animate(ball, {
      y: TOP + 230,
      scaleX: 1.4,
      scaleY: 1.6,
      duration: 200,
      ease: 'outQuad',
    });
    if (cancelled) return;

    await animate(ball, {
      y: FLOOR,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 200,
      ease: 'inQuad',
    });
    if (cancelled) return;

    await new Promise<void>((res) => { timer = setTimeout(res, 700); });
    if (!cancelled) play();
  };

  // Sync shadow scale with ball position
  const updateShadow = () => {
    const dist = FLOOR - ball.y;
    const maxDist = FLOOR - TOP;
    const t = 1 - dist / maxDist;
    shadow.scale.set(0.3 + t * 1.0, 0.2 + t * 0.15);
    shadow.alpha = 0.1 + t * 0.35;
  };

  // TODO: shadow sync via ticker for best accuracy — acceptable approximation for storybook
  play();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    ball.destroy();
    shadow.destroy();
  };
}
