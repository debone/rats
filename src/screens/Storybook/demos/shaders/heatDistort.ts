/**
 * SHADER: Heat Distortion
 *
 * Fragment shader technique: UV displacement.
 * Sample the texture at a perturbed coordinate instead of the real one.
 * The perturbation is a sum of sine waves that:
 *   - only applies ABOVE the heat source (screenY < uHeatY)
 *   - decays exponentially with distance from the source (hot air thins out)
 *   - evolves over time (hot air moves)
 *
 * This is the same technique used for heat over roads, fire, portals,
 * and any "wavy air" effect in games. Cost: 2-3 extra texture samples.
 */
import { Container, Filter, GlProgram, GpuProgram, Graphics, Text } from 'pixi.js';
import type { FilterSystem, RenderSurface, Texture } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';

// ── Shared vertex boilerplate (identical for all custom filters) ──────────
const VERT_GLSL = `
in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
vec4 filterVertexPosition(void) {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
}
vec2 filterTextureCoord(void) { return aPosition * (uOutputFrame.zw * uInputSize.zw); }
void main(void) { gl_Position = filterVertexPosition(); vTextureCoord = filterTextureCoord(); }
`;

// ── Heat distortion fragment shader ──────────────────────────────────────
const FRAG_GLSL = `
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uTime;
uniform float uStrength;  // displacement scale (try 0.01..0.04)
uniform float uHeatY;     // normalised Y of heat source, 0=top 1=bottom

void main(void) {
    vec2 uv = vTextureCoord;
    float distAbove = uHeatY - uv.y;   // positive = above the heat source

    if (distAbove > 0.0) {
        // Exponential falloff: strongest near the flame, fades going up
        float falloff = exp(-distAbove * 7.0);

        // Two overlapping sine waves give more natural shimmer than one
        float wave = sin(uv.y * 90.0 + uTime * 5.5) * 0.55
                   + sin(uv.y * 58.0 - uTime * 3.8 + uv.x * 25.0) * 0.45;
        uv.x += wave * uStrength * falloff;
        uv.y += sin(uv.x * 45.0 + uTime * 4.3) * uStrength * 0.25 * falloff;
    }
    finalColor = texture(uTexture, uv);
}
`;

// ── WGSL (WebGPU) equivalent ──────────────────────────────────────────────
const WGSL = `
struct HeatUniforms { uTime: f32, uStrength: f32, uHeatY: f32 };
struct GlobalFilterUniforms {
  uInputSize: vec4<f32>, uInputPixel: vec4<f32>, uInputClamp: vec4<f32>,
  uOutputFrame: vec4<f32>, uGlobalFrame: vec4<f32>, uOutputTexture: vec4<f32>,
};
@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;
@group(1) @binding(0) var<uniform> heatUniforms: HeatUniforms;
struct VSOutput { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32> };
@vertex fn mainVertex(@location(0) aPosition: vec2<f32>) -> VSOutput {
    var pos = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;
    pos.x = pos.x * (2.0 / gfu.uOutputTexture.x) - 1.0;
    pos.y = pos.y * (2.0 * gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;
    return VSOutput(vec4(pos, 0.0, 1.0), aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw));
}
@fragment fn mainFragment(@builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    var coord = uv;
    let distAbove = heatUniforms.uHeatY - uv.y;
    if (distAbove > 0.0) {
        let falloff = exp(-distAbove * 7.0);
        let t = heatUniforms.uTime;
        let wave = sin(uv.y * 90.0 + t * 5.5) * 0.55 + sin(uv.y * 58.0 - t * 3.8 + uv.x * 25.0) * 0.45;
        coord.x += wave * heatUniforms.uStrength * falloff;
        coord.y += sin(uv.x * 45.0 + t * 4.3) * heatUniforms.uStrength * 0.25 * falloff;
    }
    return textureSample(uTexture, uSampler, coord);
}
`;

class HeatDistortFilter extends Filter {
  constructor() {
    super({
      glProgram: GlProgram.from({ vertex: VERT_GLSL, fragment: FRAG_GLSL, name: 'heat-distort' }),
      gpuProgram: GpuProgram.from({ vertex: { source: WGSL, entryPoint: 'mainVertex' }, fragment: { source: WGSL, entryPoint: 'mainFragment' } }),
      resources: {
        heatUniforms: {
          uTime:     { value: 0,    type: 'f32' },
          uStrength: { value: 0.02, type: 'f32' },
          uHeatY:    { value: 0.72, type: 'f32' },
        },
      },
    });
  }
  get time()     { return this.resources.heatUniforms.uniforms.uTime; }
  set time(v)    { this.resources.heatUniforms.uniforms.uTime = v; }
  get strength() { return this.resources.heatUniforms.uniforms.uStrength; }
  set strength(v){ this.resources.heatUniforms.uniforms.uStrength = v; }
  get heatY()    { return this.resources.heatUniforms.uniforms.uHeatY; }
  set heatY(v)   { this.resources.heatUniforms.uniforms.uHeatY = v; }
}

export function heatDistort(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let time = 0;

  // ── Scene (this whole container gets the heat shader) ──────────────
  const scene = new Container();
  root.addChild(scene);

  // Stone dungeon wall + floor
  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x0c0a08);
  for (let row = 0; row * 13 < h; row++) {
    const off = (row % 2) * 16;
    for (let col = -1; col * 32 < w; col++) {
      bg.roundRect(col * 32 + off + 1, row * 13 + 1, 30, 11, 1).fill({ color: 0x1a1410, alpha: 0.85 });
    }
  }
  bg.rect(0, h * 0.72, w, h * 0.28).fill(0x100e0c); // floor
  bg.moveTo(0, h * 0.72).lineTo(w, h * 0.72).stroke({ color: 0x0a0806, width: 2 });
  scene.addChild(bg);

  // Wall decorations (torch mounts, cracks)
  const deco = new Graphics();
  [[w * 0.25, h * 0.4], [w * 0.75, h * 0.4]].forEach(([mx, my]) => {
    deco.rect(mx - 1, my, 2, 14).fill(0x2a2010);
    deco.rect(mx - 6, my + 11, 12, 3).fill(0x1e1810);
  });
  scene.addChild(deco);

  // Torch body at center-bottom
  const torchMount = new Graphics();
  torchMount.rect(w / 2 - 1, h * 0.62, 2, 10).fill(0x3a2a18);
  torchMount.rect(w / 2 - 5, h * 0.7, 10, 3).fill(0x2a1a10);
  scene.addChild(torchMount);

  // Animated flame (redrawn each frame in tick)
  const flame = new Graphics();
  scene.addChild(flame);

  const label = new Text({
    text: 'SHADER: HEAT DISTORTION — UV displacement with exponential falloff above heat source',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x5a3a18, letterSpacing: 1 },
  });
  label.x = 6; label.y = 6;
  root.addChild(label); // label outside scene (not distorted)

  // Apply heat distortion filter to the scene
  const heatFilter = new HeatDistortFilter();
  heatFilter.strength = 0.022;
  heatFilter.heatY = 0.73;
  scene.filters = [heatFilter];

  const tick = (dt: { deltaMS: number }) => {
    if (cancelled) return;
    time += dt.deltaMS * 0.001;
    heatFilter.time = time;

    // Animated flame layers
    flame.clear();
    const fx = w / 2;
    const fy = h * 0.68;
    // Corona
    flame.circle(fx, fy - 10, 22 + Math.sin(time * 4.1) * 3).fill({ color: 0xff6600, alpha: 0.06 });
    // Base
    flame.ellipse(fx + Math.sin(time * 8.1) * 1.5, fy, 5 + Math.sin(time * 6.7) * 0.8, 10).fill({ color: 0xff4400, alpha: 0.9 });
    // Mid
    flame.ellipse(fx + Math.sin(time * 9.3) * 1.2, fy - 6, 3.5, 8).fill({ color: 0xffaa00, alpha: 0.95 });
    // Tip
    flame.ellipse(fx + Math.sin(time * 12) * 0.8, fy - 12, 2, 5).fill({ color: 0xffffcc, alpha: 0.9 });
  };

  app.ticker.add(tick);

  return () => {
    cancelled = true;
    app.ticker.remove(tick);
    heatFilter.destroy();
    [scene, label].forEach((e) => e.destroy());
  };
}
