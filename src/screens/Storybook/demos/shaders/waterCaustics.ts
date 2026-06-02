/**
 * SHADER: Water Caustics
 *
 * Caustics = the moving bright patterns formed when light refracts through
 * a wavy water surface onto a floor/wall below. They are impossible to fake
 * convincingly with sprites but trivial in a shader.
 *
 * Technique: additive interference pattern from two counter-rotating sets
 * of cosine waves. The two sets slightly disagree, creating bright nodes
 * where they constructively interfere and dark nodes where they cancel.
 * Squaring the result (c*c) sharpens the bright spots, matching real caustics.
 *
 * Cost: 0 texture samples, pure math per pixel — very cheap.
 */
import { Container, Filter, GlProgram, GpuProgram, Graphics, Text } from 'pixi.js';
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
uniform float uTime;
uniform float uStrength; // caustic brightness multiplier
uniform float uScale;    // pattern frequency (larger = tighter pattern)

float caustic(vec2 uv, float t) {
    vec2 p = uv * uScale;
    // Two rotating interference sets
    float a = cos(p.x * 6.2 + t * 1.1) + cos(p.y * 5.8 + t * 0.9)
            + cos((p.x + p.y) * 4.3 + t * 1.4);
    float b = cos(p.x * 5.1 - t * 0.8 + 1.2) + cos(p.y * 6.9 + t * 1.0 - 0.5)
            + cos((p.x - p.y) * 4.7 - t * 0.7);
    float c = (a + b) * (1.0 / 12.0) + 0.5;    // normalise to 0..1
    return c * c * c;                             // sharpen bright nodes
}

void main(void) {
    vec4 tex = texture(uTexture, vTextureCoord);
    float c = caustic(vTextureCoord, uTime);
    // Additive: caustics brighten the surface, they do not darken it
    vec3 light = vec3(c * uStrength) * vec3(0.55, 0.85, 1.0); // cool blue-green tint
    finalColor = vec4(tex.rgb + light * tex.a, tex.a);
}
`;

const WGSL = `
struct CausticsUniforms { uTime: f32, uStrength: f32, uScale: f32 };
struct GlobalFilterUniforms {
  uInputSize: vec4<f32>, uInputPixel: vec4<f32>, uInputClamp: vec4<f32>,
  uOutputFrame: vec4<f32>, uGlobalFrame: vec4<f32>, uOutputTexture: vec4<f32>,
};
@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;
@group(1) @binding(0) var<uniform> causticsUniforms: CausticsUniforms;
struct VSOutput { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32> };
@vertex fn mainVertex(@location(0) aPosition: vec2<f32>) -> VSOutput {
    var pos = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;
    pos.x = pos.x * (2.0 / gfu.uOutputTexture.x) - 1.0;
    pos.y = pos.y * (2.0 * gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;
    return VSOutput(vec4(pos, 0.0, 1.0), aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw));
}
fn causticW(uv: vec2<f32>, t: f32) -> f32 {
    let p = uv * causticsUniforms.uScale;
    let a = cos(p.x * 6.2 + t * 1.1) + cos(p.y * 5.8 + t * 0.9) + cos((p.x + p.y) * 4.3 + t * 1.4);
    let b = cos(p.x * 5.1 - t * 0.8 + 1.2) + cos(p.y * 6.9 + t * 1.0 - 0.5) + cos((p.x - p.y) * 4.7 - t * 0.7);
    let c = (a + b) * (1.0 / 12.0) + 0.5;
    return c * c * c;
}
@fragment fn mainFragment(@builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let tex = textureSample(uTexture, uSampler, uv);
    let c = causticW(uv, causticsUniforms.uTime);
    let light = vec3<f32>(c * causticsUniforms.uStrength) * vec3<f32>(0.55, 0.85, 1.0);
    return vec4<f32>(tex.rgb + light * tex.a, tex.a);
}
`;

class WaterCausticsFilter extends Filter {
  constructor() {
    super({
      glProgram: GlProgram.from({ vertex: VERT_GLSL, fragment: FRAG_GLSL, name: 'water-caustics' }),
      gpuProgram: GpuProgram.from({ vertex: { source: WGSL, entryPoint: 'mainVertex' }, fragment: { source: WGSL, entryPoint: 'mainFragment' } }),
      resources: {
        causticsUniforms: {
          uTime:     { value: 0,    type: 'f32' },
          uStrength: { value: 0.35, type: 'f32' },
          uScale:    { value: 4.0,  type: 'f32' },
        },
      },
    });
  }
  get time()     { return this.resources.causticsUniforms.uniforms.uTime; }
  set time(v)    { this.resources.causticsUniforms.uniforms.uTime = v; }
  get strength() { return this.resources.causticsUniforms.uniforms.uStrength; }
  set strength(v){ this.resources.causticsUniforms.uniforms.uStrength = v; }
}

export function waterCaustics(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let time = 0;

  const scene = new Container();
  root.addChild(scene);

  // Flooded sewer interior
  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x060e14);
  // Tiled floor (large wet stones)
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 6; col++) {
      const tx = col * (w / 5) + (row % 2) * 12;
      const ty = h * 0.5 + row * 28;
      bg.roundRect(tx + 1, ty + 1, w / 5 - 3, 26, 2).fill({ color: 0x0e1a20, alpha: 0.9 });
    }
  }
  // Shallow water surface (slight transparency)
  bg.rect(0, h * 0.5, w, h * 0.5).fill({ color: 0x081018, alpha: 0.6 });
  bg.moveTo(0, h * 0.5).lineTo(w, h * 0.5).stroke({ color: 0x1a3a4a, width: 1 });
  scene.addChild(bg);

  // Arch columns
  const arches = new Graphics();
  [w * 0.15, w * 0.85].forEach((ax) => {
    arches.rect(ax - 6, 0, 12, h).fill(0x0e1418);
    arches.rect(ax - 10, 0, 20, 8).fill(0x141c22);
  });
  scene.addChild(arches);

  // Water surface shimmer line
  const shimmer = new Graphics();
  scene.addChild(shimmer);

  const label = new Text({
    text: 'SHADER: WATER CAUSTICS — additive interference pattern (zero texture samples, pure math)',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x1a4a6a, letterSpacing: 1 },
  });
  label.x = 6; label.y = 6;
  root.addChild(label);

  const causticsFilter = new WaterCausticsFilter();
  causticsFilter.strength = 0.38;
  scene.filters = [causticsFilter];

  const tick = (dt: { deltaMS: number }) => {
    if (cancelled) return;
    time += dt.deltaMS * 0.001;
    causticsFilter.time = time;

    // Animated water surface line
    shimmer.clear();
    shimmer.moveTo(0, h * 0.5);
    for (let x = 0; x <= w; x += 4) {
      shimmer.lineTo(x, h * 0.5 + Math.sin(x * 0.08 + time * 2.2) * 1.5 + Math.sin(x * 0.13 + time * 3.1) * 0.7);
    }
    shimmer.stroke({ color: 0x4488aa, width: 0.8, alpha: 0.4 });
  };

  app.ticker.add(tick);

  return () => {
    cancelled = true;
    app.ticker.remove(tick);
    causticsFilter.destroy();
    [scene, label].forEach((e) => e.destroy());
  };
}
