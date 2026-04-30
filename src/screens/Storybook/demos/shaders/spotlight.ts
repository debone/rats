/**
 * SHADER: Spotlight / Fog of War
 *
 * A dark overlay where the darkness is computed per-pixel as a function
 * of distance from one or more light sources. Uses smoothstep() for the
 * soft edge — the transition between lit and dark.
 *
 * Key insight: this is NOT a separate "darkness texture" drawn on top.
 * The shader directly darkens pixels based on position, with no extra
 * render targets. It's a single pass on the final composited scene.
 *
 * Two lights:
 *   uLight1 = moving torch (animated with sine path)
 *   uLight2 = fixed wall sconce
 *
 * Visibility is max(v1, v2) — any light that reaches a pixel contributes.
 * Aspect ratio correction on distance prevents oval light circles.
 */
import { Container, Filter, GlProgram, GpuProgram, Graphics, Text } from 'pixi.js';
import type { FilterSystem, RenderSurface, Texture } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';

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

const FRAG_GLSL = `
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec2 uLight1;    // normalised 0..1 position
uniform float uRadius1;
uniform vec2 uLight2;
uniform float uRadius2;
uniform float uAspect;   // width/height for aspect-correct distance
uniform vec2 uDimensions;
uniform vec4 uInputSize;

// Smooth light falloff with aspect-ratio-correct distance
float lightVis(vec2 uv, vec2 lightPos, float radius) {
    vec2 d = uv - lightPos;
    d.x *= uAspect;          // correct for non-square screen
    float dist = length(d);
    return 1.0 - smoothstep(radius * 0.45, radius, dist);
}

void main(void) {
    vec4 tex = texture(uTexture, vTextureCoord);
    vec2 coord = vTextureCoord * uInputSize.xy / uDimensions;

    float v1 = lightVis(coord, uLight1, uRadius1);
    float v2 = lightVis(coord, uLight2, uRadius2);
    float visibility = max(v1, v2);

    // Darken the pixel by the complement of visibility.
    // mix(a, b, t): t=0 → original, t=1 → pure dark
    float darkness = (1.0 - visibility) * 0.94;
    finalColor = mix(tex, vec4(0.0, 0.0, 0.0, tex.a), darkness);
}
`;

const WGSL = `
struct SpotUniforms {
  uLight1: vec2<f32>, uRadius1: f32,
  uLight2: vec2<f32>, uRadius2: f32,
  uAspect: f32, uDimensions: vec2<f32>,
};
struct GlobalFilterUniforms {
  uInputSize: vec4<f32>, uInputPixel: vec4<f32>, uInputClamp: vec4<f32>,
  uOutputFrame: vec4<f32>, uGlobalFrame: vec4<f32>, uOutputTexture: vec4<f32>,
};
@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;
@group(1) @binding(0) var<uniform> spotUniforms: SpotUniforms;
struct VSOutput { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32> };
@vertex fn mainVertex(@location(0) aPosition: vec2<f32>) -> VSOutput {
    var pos = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;
    pos.x = pos.x * (2.0 / gfu.uOutputTexture.x) - 1.0;
    pos.y = pos.y * (2.0 * gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;
    return VSOutput(vec4(pos, 0.0, 1.0), aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw));
}
fn lightVisW(uv: vec2<f32>, lightPos: vec2<f32>, radius: f32, aspect: f32) -> f32 {
    var d = uv - lightPos; d.x *= aspect;
    return 1.0 - smoothstep(radius * 0.45, radius, length(d));
}
@fragment fn mainFragment(@builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let tex = textureSample(uTexture, uSampler, uv);
    let coord = uv * gfu.uInputSize.xy / spotUniforms.uDimensions;
    let v1 = lightVisW(coord, spotUniforms.uLight1, spotUniforms.uRadius1, spotUniforms.uAspect);
    let v2 = lightVisW(coord, spotUniforms.uLight2, spotUniforms.uRadius2, spotUniforms.uAspect);
    let darkness = (1.0 - max(v1, v2)) * 0.94;
    return mix(tex, vec4<f32>(0.0, 0.0, 0.0, tex.a), darkness);
}
`;

class SpotlightFilter extends Filter {
  constructor(w: number, h: number) {
    const dim = new Float32Array([w, h]);
    super({
      glProgram: GlProgram.from({ vertex: VERT_GLSL, fragment: FRAG_GLSL, name: 'spotlight' }),
      gpuProgram: GpuProgram.from({ vertex: { source: WGSL, entryPoint: 'mainVertex' }, fragment: { source: WGSL, entryPoint: 'mainFragment' } }),
      resources: {
        spotUniforms: {
          uLight1:     { value: new Float32Array([0.5, 0.5]), type: 'vec2<f32>' },
          uRadius1:    { value: 0.28, type: 'f32' },
          uLight2:     { value: new Float32Array([0.15, 0.35]), type: 'vec2<f32>' },
          uRadius2:    { value: 0.14, type: 'f32' },
          uAspect:     { value: w / h, type: 'f32' },
          uDimensions: { value: dim, type: 'vec2<f32>' },
        },
      },
    });
  }

  get light1() { return this.resources.spotUniforms.uniforms.uLight1 as Float32Array; }
  get light2() { return this.resources.spotUniforms.uniforms.uLight2 as Float32Array; }
  get radius1(){ return this.resources.spotUniforms.uniforms.uRadius1 as number; }
  set radius1(v){ this.resources.spotUniforms.uniforms.uRadius1 = v; }

  public override apply(filterManager: FilterSystem, input: Texture, output: RenderSurface, clearMode: boolean): void {
    const u = this.resources.spotUniforms.uniforms;
    u.uDimensions[0] = input.frame.width;
    u.uDimensions[1] = input.frame.height;
    u.uAspect = input.frame.width / input.frame.height;
    filterManager.applyFilter(this, input, output, clearMode);
  }
}

export function spotlight(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let time = 0;

  const label = new Text({
    text: 'SHADER: SPOTLIGHT — per-pixel distance-based darkness (smoothstep falloff, 2 lights)',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x4a4a2a, letterSpacing: 1 },
  });
  label.x = 6; label.y = 6;
  root.addChild(label);

  // ── Dungeon scene (fully lit — shader handles all darkness) ──────────
  const scene = new Container();
  root.addChild(scene);

  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x1a160e);
  // Brick wall
  for (let row = 0; row * 14 < h; row++) {
    const off = (row % 2) * 18;
    for (let col = -1; col * 36 < w; col++) {
      bg.roundRect(col * 36 + off + 1, row * 14 + 1, 34, 12, 1).fill({ color: 0x2a1e10, alpha: 0.9 });
    }
  }
  // Floor
  bg.rect(0, h * 0.72, w, h * 0.28).fill(0x1a1410);
  bg.moveTo(0, h * 0.72).lineTo(w, h * 0.72).stroke({ color: 0x0c0a08, width: 1.5 });
  // Floor tiles
  for (let x = 0; x < w; x += 28) {
    bg.moveTo(x, h * 0.72).lineTo(x, h).stroke({ color: 0x140e08, width: 0.5 });
  }
  scene.addChild(bg);

  // Dungeon props visible in the lit areas
  const props = new Graphics();
  // Barrel
  props.roundRect(w * 0.55, h * 0.6, 16, 20, 3).fill(0x3a2a18);
  props.roundRect(w * 0.55, h * 0.63, 16, 4, 0).fill({ color: 0x1a1008, alpha: 0.6 });
  // Chest
  props.roundRect(w * 0.35, h * 0.62, 22, 14, 2).fill(0x4a3218);
  props.roundRect(w * 0.35, h * 0.62, 22, 7, 2).fill(0x5a3e20);
  // Wall sconce (fixed light source)
  props.rect(w * 0.15 - 2, h * 0.33, 4, 8).fill(0x3a2a18);
  props.rect(w * 0.15 - 5, h * 0.38, 10, 3).fill(0x2a1a10);
  scene.addChild(props);

  // "Flame" at sconce (fixed light 2 position)
  const sconceFire = new Graphics();
  scene.addChild(sconceFire);

  // Torch icon that follows the moving light
  const torchIcon = new Graphics();
  scene.addChild(torchIcon);

  // Apply spotlight filter
  const spotFilter = new SpotlightFilter(w, h - 16);
  scene.filters = [spotFilter];

  const tick = (dt: { deltaMS: number }) => {
    if (cancelled) return;
    time += dt.deltaMS * 0.001;

    // Moving torch follows a winding path through the room
    const tx = 0.25 + Math.sin(time * 0.6) * 0.22 + Math.sin(time * 0.3) * 0.12;
    const ty = 0.55 + Math.sin(time * 0.45) * 0.2;
    spotFilter.light1[0] = tx;
    spotFilter.light1[1] = ty;

    // Torch flicker: radius pulses slightly
    spotFilter.radius1 = 0.26 + Math.sin(time * 4.2) * 0.015 + Math.sin(time * 7.1) * 0.008;

    // Draw torch icon at light position
    const pixX = tx * w, pixY = ty * h;
    torchIcon.clear();
    torchIcon.rect(pixX - 1, pixY, 2, 8).fill(0x5a3a20);
    torchIcon.ellipse(pixX + Math.sin(time * 8) * 1, pixY - 3, 3, 5).fill({ color: 0xff5500, alpha: 0.9 });
    torchIcon.ellipse(pixX + Math.sin(time * 11) * 0.8, pixY - 6, 2, 3.5).fill({ color: 0xffaa00, alpha: 0.95 });

    // Sconce flame flicker
    sconceFire.clear();
    const fx = w * 0.15, fy = h * 0.34;
    sconceFire.ellipse(fx + Math.sin(time * 9) * 1, fy, 3, 5).fill({ color: 0xff4400, alpha: 0.9 });
    sconceFire.ellipse(fx + Math.sin(time * 12) * 0.8, fy - 4, 2, 3).fill({ color: 0xffaa00, alpha: 0.95 });
  };

  app.ticker.add(tick);

  return () => {
    cancelled = true;
    app.ticker.remove(tick);
    spotFilter.destroy();
    [scene, label].forEach((e) => e.destroy());
  };
}
