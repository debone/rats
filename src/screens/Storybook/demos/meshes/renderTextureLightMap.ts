/**
 * MESH: RenderTexture Light Map (Fog of War)
 *
 * Technique: render a separate "light map" scene into a RenderTexture, then
 * composite it over the game scene using blendMode='multiply'. Black pixels
 * in the light map make the scene black; white pixels let it through.
 *
 * This is the canonical pixi fog-of-war / dynamic lighting pattern.
 * A sprite with a radial gradient acts as the torch light source.
 *
 * Why not just an alpha sprite? Multiply blend affects colour channels, not
 * alpha — so coloured lights work naturally (red torch, blue crystal, etc.)
 * without needing real-time shaders.
 *
 * Steps:
 *   1. Create a RenderTexture the size of the preview area.
 *   2. Each frame render the "darkness scene" (black fill + light blobs)
 *      into it using app.renderer.render({ container, target: rt }).
 *   3. Sprite(rt) with blendMode='multiply' sits above the scene.
 */
import { Container, Graphics, RenderTexture, Sprite, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';

function makeRadialLight(radius: number, color: number): Graphics {
  const g = new Graphics();
  const steps = 12;
  for (let i = steps; i >= 0; i--) {
    const r = (i / steps) * radius;
    const t = i / steps;
    // centre is full colour, edges fade to black
    const alpha = (1 - t) * (1 - t);
    const r8 = (color >> 16) & 0xff;
    const g8 = (color >> 8) & 0xff;
    const b8 = color & 0xff;
    const ci = (Math.round(r8 * alpha) << 16) | (Math.round(g8 * alpha) << 8) | Math.round(b8 * alpha);
    g.circle(0, 0, r).fill({ color: ci, alpha: 1 });
  }
  return g;
}

export function renderTextureLightMap(root: Container, w: number, h: number): () => void {
  const PREVIEW_H = h - 16;

  const label = new Text({
    text: 'MESH: RenderTexture light map — multiply-blend darkness overlay. Mouse = torch. Each light is a radial gradient rendered off-screen.',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0xffaa33, letterSpacing: 1 },
  });
  label.x = 6; label.y = 6;
  root.addChild(label);

  // Scene content
  const scene = new Container();
  scene.y = 16;
  root.addChild(scene);

  const bg = new Graphics().rect(0, 0, w, PREVIEW_H).fill(0x1a1020);
  scene.addChild(bg);

  // Decorative objects to show lighting
  const objects: Graphics[] = [];
  const objDefs = [
    { x: w * 0.15, y: PREVIEW_H * 0.3, r: 18, c: 0x884422 },
    { x: w * 0.45, y: PREVIEW_H * 0.6, r: 22, c: 0x224488 },
    { x: w * 0.75, y: PREVIEW_H * 0.25, r: 14, c: 0x228844 },
    { x: w * 0.3,  y: PREVIEW_H * 0.75, r: 20, c: 0x886622 },
    { x: w * 0.65, y: PREVIEW_H * 0.7,  r: 16, c: 0x662288 },
  ];
  for (const d of objDefs) {
    const g = new Graphics().circle(0, 0, d.r).fill(d.c);
    g.x = d.x; g.y = d.y;
    scene.addChild(g);
    objects.push(g);
  }

  // Off-screen container used to render the light map each frame
  const lightScene = new Container();

  // Darkness fill
  const darkness = new Graphics().rect(0, 0, w, PREVIEW_H).fill(0x000000);
  lightScene.addChild(darkness);

  // Static ambient lights (purple and blue crystals)
  const ambientLights = [
    makeRadialLight(55, 0x5522aa),
    makeRadialLight(45, 0x2244cc),
  ];
  ambientLights[0].x = w * 0.45; ambientLights[0].y = PREVIEW_H * 0.6;
  ambientLights[1].x = w * 0.75; ambientLights[1].y = PREVIEW_H * 0.25;
  for (const l of ambientLights) lightScene.addChild(l);

  // Mouse-following torch light (warm white/orange)
  const torchLight = makeRadialLight(95, 0xffe8a0);
  torchLight.x = w * 0.5;
  torchLight.y = PREVIEW_H * 0.5;
  lightScene.addChild(torchLight);

  // RenderTexture + sprite overlay
  const rt = RenderTexture.create({ width: w, height: PREVIEW_H });
  const overlay = new Sprite(rt);
  overlay.blendMode = 'multiply';
  overlay.y = 16;
  root.addChild(overlay);

  // Track mouse in root-local space
  const onMove = (e: MouseEvent) => {
    const bounds = app.canvas.getBoundingClientRect();
    const px = (e.clientX - bounds.left) * (w / bounds.width);
    const py = (e.clientY - bounds.top) * (h / bounds.height) - 16;
    torchLight.x = px;
    torchLight.y = py;
  };
  window.addEventListener('mousemove', onMove);

  let t = 0;
  const tick = (dt: { deltaMS: number }) => {
    t += dt.deltaMS / 1000;
    // Pulse the ambient lights gently
    ambientLights[0].alpha = 0.7 + 0.3 * Math.sin(t * 1.4);
    ambientLights[1].alpha = 0.7 + 0.3 * Math.sin(t * 0.9 + 1.2);

    app.renderer.render({ container: lightScene, target: rt });
  };

  app.ticker.add(tick);

  return () => {
    window.removeEventListener('mousemove', onMove);
    app.ticker.remove(tick);
    rt.destroy(true);
    lightScene.destroy({ children: true });
    [label, scene, overlay].forEach(e => e.destroy({ children: true }));
  };
}
