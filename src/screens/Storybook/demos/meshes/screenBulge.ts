/**
 * MESH: Screen Bulge / Lens Warp (RenderTexture + MeshPlane)
 *
 * Pipeline:
 *   1. Render the "world" scene into a RenderTexture each frame.
 *   2. Stretch that texture over a highly-subdivided MeshPlane.
 *   3. Displace aPosition vertices toward/away from the mouse to create a
 *      lens-bulge or pinch effect — the UV stays fixed so the texture warps.
 *
 * This is impossible with a Sprite: a Sprite maps texture 1-to-1 and cannot
 * remap which texture pixel appears at which screen position. The MeshPlane
 * vertex positions control screen position independently of UV, giving full
 * post-process warp at zero extra draw calls.
 *
 * Bulge formula for vertex at (vx, vy):
 *   r = distance(vertex, mouse)
 *   strength = bulge * exp(-r² / (2 * sigma²))
 *   vertex += normalize(vertex - mouse) * strength
 *
 * sigma controls the radius of influence (larger = wider lens).
 */
import { Container, Graphics, Mesh, PlaneGeometry, RenderTexture, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';

const VX = 36;
const VY = 28;

export function screenBulge(root: Container, w: number, h: number): () => void {
  const PREVIEW_H = h - 16;
  const SIGMA2 = (PREVIEW_H * 0.28) ** 2;
  const BULGE_STRENGTH = 55;

  const label = new Text({
    text: 'MESH: Screen bulge — scene→RenderTexture→MeshPlane with vertex lens warp. Move mouse to warp.',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0xff88cc, letterSpacing: 1 },
  });
  label.x = 6; label.y = 6;
  root.addChild(label);

  // World scene rendered into RT
  const world = new Container();

  const worldBg = new Graphics().rect(0, 0, w, PREVIEW_H).fill(0x11082a);
  world.addChild(worldBg);

  // Grid of coloured circles to make warping visible
  const cols = 7, rows = 5;
  for (let ry = 0; ry < rows; ry++) {
    for (let rx = 0; rx < cols; rx++) {
      const hue = (rx * cols + ry) / (cols * rows);
      const color = hslToHex(hue, 0.75, 0.55);
      const g = new Graphics();
      g.circle(0, 0, 14).fill(color);
      g.circle(0, 0, 9).fill(lighten(color, 0.4));
      g.x = (rx + 0.5) * (w / cols);
      g.y = (ry + 0.5) * (PREVIEW_H / rows);
      world.addChild(g);
    }
  }

  const rt = RenderTexture.create({ width: w, height: PREVIEW_H });

  // The mesh plane covers the same area as the RT
  const geo = new PlaneGeometry({ width: w, height: PREVIEW_H, verticesX: VX, verticesY: VY });
  const plane = new Mesh({ geometry: geo, texture: rt });
  plane.y = 16;
  root.addChild(plane);

  const { buffer } = (plane.geometry as PlaneGeometry).getAttribute('aPosition');

  // Snapshot rest positions
  const restX = new Float32Array(VX * VY);
  const restY = new Float32Array(VX * VY);
  for (let i = 0; i < VX * VY; i++) {
    restX[i] = buffer.data[i * 2];
    restY[i] = buffer.data[i * 2 + 1];
  }

  let mouseX = w / 2, mouseY = PREVIEW_H / 2;

  const onMove = (e: MouseEvent) => {
    const bounds = app.canvas.getBoundingClientRect();
    mouseX = (e.clientX - bounds.left) * (w / bounds.width);
    mouseY = (e.clientY - bounds.top) * (h / bounds.height) - 16;
  };
  window.addEventListener('mousemove', onMove);

  const tick = () => {
    // Render world into RT
    app.renderer.render({ container: world, target: rt });

    // Apply lens bulge to each vertex
    for (let i = 0; i < VX * VY; i++) {
      const vx = restX[i];
      const vy = restY[i];
      const dx = vx - mouseX;
      const dy = vy - mouseY;
      const r2 = dx * dx + dy * dy;
      const strength = BULGE_STRENGTH * Math.exp(-r2 / (2 * SIGMA2));
      const dist = Math.sqrt(r2) || 1;
      buffer.data[i * 2]     = vx + (dx / dist) * strength;
      buffer.data[i * 2 + 1] = vy + (dy / dist) * strength;
    }
    buffer.update();
  };

  app.ticker.add(tick);

  return () => {
    window.removeEventListener('mousemove', onMove);
    app.ticker.remove(tick);
    rt.destroy(true);
    world.destroy({ children: true });
    [label, plane].forEach(e => e.destroy({ children: true }));
  };
}

function hslToHex(h: number, s: number, l: number): number {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h * 6) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 1/6)      { r=c; g=x; b=0; }
  else if (h < 2/6) { r=x; g=c; b=0; }
  else if (h < 3/6) { r=0; g=c; b=x; }
  else if (h < 4/6) { r=0; g=x; b=c; }
  else if (h < 5/6) { r=x; g=0; b=c; }
  else               { r=c; g=0; b=x; }
  return (Math.round((r+m)*255) << 16) | (Math.round((g+m)*255) << 8) | Math.round((b+m)*255);
}

function lighten(color: number, amount: number): number {
  const r = Math.min(255, ((color >> 16) & 0xff) + Math.round(amount * 255));
  const g = Math.min(255, ((color >>  8) & 0xff) + Math.round(amount * 255));
  const b = Math.min(255, (color & 0xff)         + Math.round(amount * 255));
  return (r << 16) | (g << 8) | b;
}
