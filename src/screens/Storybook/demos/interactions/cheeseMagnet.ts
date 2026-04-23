import { animate } from 'animejs';
import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';

const CHEESE_COUNT = 12;
const COLLECT_AREA = { x: 0, y: 0, w: 0, h: 0 }; // set in setup

interface CheeseObj {
  sprite: Sprite;
  collected: boolean;
}

export function cheeseMagnet(root: Container, w: number, h: number): () => void {
  const cheeseTex = Assets.get('prototype').textures['cheese_tile_1#0'];
  const ballTex = Assets.get('tiles').textures.ball;

  // Counter panel at top-center
  const panel = new Graphics();
  panel.roundRect(w / 2 - 60, 16, 120, 36, 6).fill(0x111120).stroke({ color: 0x441133, width: 1 });
  root.addChild(panel);

  const cheeseIcon = new Sprite(cheeseTex);
  cheeseIcon.anchor.set(0.5);
  cheeseIcon.scale.set(0.8);
  cheeseIcon.x = w / 2 - 28;
  cheeseIcon.y = 34;
  root.addChild(cheeseIcon);

  const countText = new Text({
    text: '0',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 18, fontWeight: 'bold', fill: 0xffee44 },
  });
  countText.anchor.set(0, 0.5);
  countText.x = w / 2 - 10;
  countText.y = 34;
  root.addChild(countText);

  // Collect particles on counter
  const sparkle = new ParticleEmitter({
    texture: ballTex,
    maxParticles: 20,
    emitting: false,
    lifespan: { min: 200, max: 400 },
    speed: { min: 20, max: 60 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.15, end: 0 },
    tint: 0xffee44,
    alpha: { start: 1, end: 0 },
  });
  sparkle.x = w / 2;
  sparkle.y = 34;
  root.addChild(sparkle.container);

  let count = 0;
  const cheeses: CheeseObj[] = [];

  const rand = (a: number, b: number) => a + Math.random() * (b - a);

  const spawnAll = () => {
    cheeses.forEach((c) => c.sprite.destroy());
    cheeses.length = 0;
    count = 0;
    countText.text = '0';

    for (let i = 0; i < CHEESE_COUNT; i++) {
      const sprite = new Sprite(cheeseTex);
      sprite.anchor.set(0.5);
      sprite.scale.set(0.9 + Math.random() * 0.4);
      sprite.x = rand(20, w - 20);
      sprite.y = rand(80, h - 30);
      sprite.interactive = true;
      sprite.cursor = 'pointer';
      sprite.alpha = 0;
      root.addChild(sprite);

      const obj: CheeseObj = { sprite, collected: false };
      cheeses.push(obj);

      // Staggered appear
      animate(sprite, { alpha: 1, scaleX: [0, sprite.scale.x], scaleY: [0, sprite.scale.y], duration: 300, delay: i * 60, ease: 'outBack(1.5)' });

      // Gentle idle bob
      const baseY = sprite.y;
      const bobAnim = () => {
        if (obj.collected) return;
        animate(sprite, { y: baseY + rand(-4, 4), duration: rand(900, 1400), ease: 'inOutSine' }).then(bobAnim);
      };
      setTimeout(bobAnim, Math.random() * 1000);

      sprite.on('pointertap', () => collect(obj));
    }
  };

  const collect = async (obj: CheeseObj) => {
    if (obj.collected) return;
    obj.collected = true;
    obj.sprite.interactive = false;

    const targetX = w / 2;
    const targetY = 34;

    // Fly to counter
    await animate(obj.sprite, {
      x: targetX,
      y: targetY,
      scaleX: 0.3,
      scaleY: 0.3,
      duration: 380,
      ease: 'inBack(1.4)',
    });

    obj.sprite.visible = false;

    // Increment
    count++;
    countText.text = String(count);

    // Counter bounce
    animate(cheeseIcon, { scaleX: [1.4, 1], scaleY: [1.4, 1], duration: 200, ease: 'outBack' });
    animate(countText, { scaleX: [1.5, 1], scaleY: [1.5, 1], duration: 200, ease: 'outBack' });

    sparkle.explode(8);

    // All collected?
    if (count === CHEESE_COUNT) {
      const done = new Text({
        text: '✓ ALL CHEESE COLLECTED!',
        style: { ...TEXT_STYLE_DEFAULT, fontSize: 10, fill: 0xffee44 },
      });
      done.anchor.set(0.5);
      done.x = w / 2;
      done.y = h / 2;
      root.addChild(done);
      animate(done, { alpha: [0, 1, 1, 0], y: h / 2 - 20, duration: 1600 }).then(() => {
        done.destroy();
        spawnAll();
      });
    }
  };

  const hint = new Text({
    text: 'click cheese to collect',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0x443355 },
  });
  hint.anchor.set(0.5);
  hint.x = w / 2;
  hint.y = h - 14;
  root.addChild(hint);

  spawnAll();

  return () => {
    sparkle.destroy();
    cheeses.forEach((c) => c.sprite.destroy());
    panel.destroy();
    cheeseIcon.destroy();
    countText.destroy();
    hint.destroy();
  };
}
