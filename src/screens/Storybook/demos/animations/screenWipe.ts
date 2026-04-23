import { animate } from 'animejs';
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';

const SCENES = [
  { bg: 0x1a0d2e, label: 'SCENE ONE', accent: 0xcc44ff },
  { bg: 0x0d1a1e, label: 'SCENE TWO', accent: 0x44ccff },
  { bg: 0x1e1a0d, label: 'SCENE THREE', accent: 0xffcc44 },
];

export function screenWipe(root: Container, w: number, h: number): () => void {
  let sceneIndex = 0;

  const background = new Graphics();
  background.rect(0, 0, w, h).fill(SCENES[0].bg);
  root.addChild(background);

  const sceneText = new Text({
    text: SCENES[0].label,
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 20, letterSpacing: 4, fontWeight: 'bold', fill: SCENES[0].accent },
  });
  sceneText.anchor.set(0.5);
  sceneText.x = w / 2;
  sceneText.y = h / 2;
  root.addChild(sceneText);

  // Wipe overlay — slides from left to right, covering then revealing
  const wipe = new Graphics();
  wipe.rect(0, 0, w, h).fill(0x000000);
  wipe.x = -w;
  root.addChild(wipe);

  const hint = new Text({
    text: 'level transition wipe pattern',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0x554477 },
  });
  hint.anchor.set(0.5);
  hint.x = w / 2;
  hint.y = h - 20;
  root.addChild(hint);

  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const play = async () => {
    if (cancelled) return;

    // Wipe in (covers screen)
    await animate(wipe, { x: 0, duration: 400, ease: 'inQuad' });
    if (cancelled) return;

    // Switch scene while covered
    sceneIndex = (sceneIndex + 1) % SCENES.length;
    const scene = SCENES[sceneIndex];
    background.clear().rect(0, 0, w, h).fill(scene.bg);
    sceneText.text = scene.label;
    sceneText.style.fill = scene.accent;

    await new Promise<void>((res) => { timer = setTimeout(res, 150); });
    if (cancelled) return;

    // Wipe out (reveals new scene)
    await animate(wipe, { x: w, duration: 400, ease: 'outQuad' });
    if (cancelled) return;

    wipe.x = -w; // reset for next loop

    await new Promise<void>((res) => { timer = setTimeout(res, 1200); });
    if (!cancelled) play();
  };

  play();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    background.destroy();
    sceneText.destroy();
    wipe.destroy();
    hint.destroy();
  };
}
