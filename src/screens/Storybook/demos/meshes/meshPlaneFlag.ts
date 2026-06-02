/**
 * MESH: MeshPlane Flag Wave
 *
 * MeshPlane maps a texture onto a subdivided grid of vertices. Mutating
 * the aPosition buffer and calling buffer.update() each frame lets you
 * deform the mesh in arbitrary ways — the texture stretches with the
 * vertex displacement automatically.
 *
 * A Sprite could render the flag texture, but it cannot deform it.
 * MeshPlane does the deformation at zero extra draw cost.
 *
 * Pattern:
 *   const { buffer } = plane.geometry.getAttribute('aPosition');
 *   // buffer.data layout: [x0,y0, x1,y1, ...] — VX*VY vertices row-major
 *   buffer.data[i * 2]     = baseX + waveOffsetX;
 *   buffer.data[i * 2 + 1] = baseY + waveOffsetY;
 *   buffer.update();
 *
 * verticesX/Y trade quality for vertex count. 24×16 is enough for smooth
 * cloth-like ripples at this scale.
 */
import { Container, Graphics, Mesh, PlaneGeometry, Texture, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';

const VX = 24;
const VY = 16;
const FLAG_W = 180;
const FLAG_H = 100;

function makeFlagTex(): Texture {
  const g = new Graphics();
  // Simple tricolour flag: three horizontal stripes
  g.rect(0, 0, FLAG_W, FLAG_H / 3).fill(0x223388);
  g.rect(0, FLAG_H / 3, FLAG_W, FLAG_H / 3).fill(0xeeeeee);
  g.rect(0, (FLAG_H * 2) / 3, FLAG_W, FLAG_H / 3).fill(0xcc2211);
  // Emblem hint
  g.circle(FLAG_W / 2, FLAG_H / 2, 14).fill(0xffd700);
  g.circle(FLAG_W / 2, FLAG_H / 2, 10).fill(0x223388);
  const tex = app.renderer.generateTexture(g);
  g.destroy();
  return tex;
}

export function meshPlaneFlag(root: Container, w: number, h: number): () => void {
  const label = new Text({
    text: 'MESH: MeshPlane — per-vertex displacement deforms texture. A Sprite cannot bend its pixels.',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x33aaff, letterSpacing: 1 },
  });
  label.x = 6; label.y = 6;
  root.addChild(label);

  const bg = new Graphics().rect(0, 16, w, h - 16).fill(0x080818);
  root.addChild(bg);

  // Flagpole
  const pole = new Graphics();
  pole.rect(w * 0.2 - 3, 24, 6, h - 32).fill(0x887755);
  pole.circle(w * 0.2, 24, 8).fill(0xffdd88);
  root.addChild(pole);

  const flagTex = makeFlagTex();
  const geo = new PlaneGeometry({ width: FLAG_W, height: FLAG_H, verticesX: VX, verticesY: VY });
  const plane = new Mesh({ geometry: geo, texture: flagTex });
  // Anchor left edge at pole top
  plane.x = w * 0.2;
  plane.y = 28;
  root.addChild(plane);

  // Store rest positions for each vertex
  const { buffer } = (plane.geometry as PlaneGeometry).getAttribute('aPosition');
  const restX = new Float32Array(VX * VY);
  const restY = new Float32Array(VX * VY);
  for (let iy = 0; iy < VY; iy++) {
    for (let ix = 0; ix < VX; ix++) {
      const i = iy * VX + ix;
      restX[i] = buffer.data[i * 2];
      restY[i] = buffer.data[i * 2 + 1];
    }
  }

  let t = 0;

  const tick = (dt: { deltaMS: number }) => {
    t += dt.deltaMS / 1000;

    for (let iy = 0; iy < VY; iy++) {
      for (let ix = 0; ix < VX; ix++) {
        const i = iy * VX + ix;
        // Amplitude grows toward the free (right) edge
        const xRatio = ix / (VX - 1);
        const amp = xRatio * xRatio * 18;
        // Two overlapping sine waves for organic feel
        const phase = ix * 0.4 - t * 3.8;
        const phase2 = ix * 0.25 - t * 2.1 + iy * 0.15;
        const wave = Math.sin(phase) + 0.4 * Math.sin(phase2);
        // Left column stays pinned to pole
        buffer.data[i * 2]     = restX[i];
        buffer.data[i * 2 + 1] = restY[i] + wave * amp;
      }
    }
    buffer.update();
  };

  app.ticker.add(tick);

  return () => {
    app.ticker.remove(tick);
    flagTex.destroy(true);
    [label, bg, pole, plane].forEach(e => e.destroy({ children: true }));
  };
}
