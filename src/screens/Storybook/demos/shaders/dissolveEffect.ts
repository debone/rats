/**
 * SHADER: Dissolve / Burn Transition
 *
 * Technique: noise threshold masking with a "burn edge".
 *   1. Compute a smooth noise value n at each pixel (0..1)
 *   2. If n < threshold: pixel is gone (alpha = 0)
 *   3. If n < threshold + edge_width: pixel is the burn glow
 *   4. Otherwise: original pixel
 *
 * Animating threshold from 0→1 dissolves the whole texture.
 * The bright edge "burns away" the content rather than fading it —
 * that edge detail is what separates a dissolve from a plain fade.
 *
 * Used for: death/destruction effects, portal openings, spell cast,
 * environmental destruction, collectible pickups.
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
uniform float uThreshold; // 0=fully intact, 1=fully dissolved
uniform float uEdge;      // burn edge width in noise-space (try 0.08)

// Smooth noise (value noise, 4 octaves = "fractal brownian motion")
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
               mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.1; a *= 0.5; }
    return v;
}

void main(void) {
    vec4 tex = texture(uTexture, vTextureCoord);
    float n = fbm(vTextureCoord * 5.5);

    float dissolveAt = uThreshold;
    float edgeEnd    = uThreshold + uEdge;

    if (n < dissolveAt) {
        finalColor = vec4(0.0); // dissolved: transparent
    } else if (n < edgeEnd) {
        // Burn edge: interpolate orange → yellow toward the intact side
        float t = (n - dissolveAt) / uEdge;
        vec3 burn = mix(vec3(1.0, 0.15, 0.0), vec3(1.0, 0.85, 0.1), t);
        finalColor = vec4(burn * (1.0 - t * 0.4 + 0.6), 1.0);
    } else {
        finalColor = tex;
    }
}
`;

const WGSL = `
struct DissolveUniforms { uThreshold: f32, uEdge: f32 };
struct GlobalFilterUniforms {
  uInputSize: vec4<f32>, uInputPixel: vec4<f32>, uInputClamp: vec4<f32>,
  uOutputFrame: vec4<f32>, uGlobalFrame: vec4<f32>, uOutputTexture: vec4<f32>,
};
@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;
@group(1) @binding(0) var<uniform> dissolveUniforms: DissolveUniforms;
struct VSOutput { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32> };
@vertex fn mainVertex(@location(0) aPosition: vec2<f32>) -> VSOutput {
    var pos = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;
    pos.x = pos.x * (2.0 / gfu.uOutputTexture.x) - 1.0;
    pos.y = pos.y * (2.0 * gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;
    return VSOutput(vec4(pos, 0.0, 1.0), aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw));
}
fn hashW(p: vec2<f32>) -> f32 { return fract(sin(dot(p, vec2<f32>(127.1, 311.7))) * 43758.5453); }
fn vnoiseW(p: vec2<f32>) -> f32 {
    let i = floor(p); let f = fract(p);
    let ff = f * f * (vec2<f32>(3.0) - 2.0 * f);
    return mix(mix(hashW(i), hashW(i+vec2<f32>(1,0)), ff.x),
               mix(hashW(i+vec2<f32>(0,1)), hashW(i+vec2<f32>(1,1)), ff.x), ff.y);
}
fn fbmW(pIn: vec2<f32>) -> f32 {
    var v = 0.0; var a = 0.5; var p = pIn;
    for (var i = 0; i < 4; i++) { v += a * vnoiseW(p); p *= 2.1; a *= 0.5; }
    return v;
}
@fragment fn mainFragment(@builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let tex = textureSample(uTexture, uSampler, uv);
    let n = fbmW(uv * 5.5);
    let thr = dissolveUniforms.uThreshold;
    let edge = dissolveUniforms.uEdge;
    if (n < thr) { return vec4<f32>(0.0); }
    else if (n < thr + edge) {
        let t = (n - thr) / edge;
        let burn = mix(vec3<f32>(1.0, 0.15, 0.0), vec3<f32>(1.0, 0.85, 0.1), t);
        return vec4<f32>(burn * (1.0 - t * 0.4 + 0.6), 1.0);
    }
    return tex;
}
`;

class DissolveFilter extends Filter {
  constructor() {
    super({
      glProgram: GlProgram.from({ vertex: VERT_GLSL, fragment: FRAG_GLSL, name: 'dissolve' }),
      gpuProgram: GpuProgram.from({ vertex: { source: WGSL, entryPoint: 'mainVertex' }, fragment: { source: WGSL, entryPoint: 'mainFragment' } }),
      resources: {
        dissolveUniforms: {
          uThreshold: { value: 0,    type: 'f32' },
          uEdge:      { value: 0.09, type: 'f32' },
        },
      },
    });
  }
  get threshold() { return this.resources.dissolveUniforms.uniforms.uThreshold; }
  set threshold(v){ this.resources.dissolveUniforms.uniforms.uThreshold = v; }
  get edge()      { return this.resources.dissolveUniforms.uniforms.uEdge; }
  set edge(v)     { this.resources.dissolveUniforms.uniforms.uEdge = v; }
}

export function dissolveEffect(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let time = 0;

  const label = new Text({
    text: 'SHADER: DISSOLVE — noise threshold + burn edge (threshold 0→1→0 cycles)',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x5a2a18, letterSpacing: 1 },
  });
  label.x = 6; label.y = 6;
  root.addChild(label);

  // Background (outside dissolved area, not filtered)
  const bgBase = new Graphics();
  bgBase.rect(0, 0, w, h).fill(0x080608);
  root.addChild(bgBase);

  // ── Content that dissolves ────────────────────────────────────────────
  const subject = new Container();
  root.addChild(subject);

  const subBg = new Graphics();
  subBg.rect(0, 0, w, h).fill(0x100c08);
  // Brick wall
  for (let row = 0; row * 14 < h; row++) {
    const off = (row % 2) * 18;
    for (let col = -1; col * 36 < w; col++) {
      subBg.roundRect(col * 36 + off + 1, row * 14 + 1, 34, 12, 1).fill({ color: 0x1e1008, alpha: 0.85 });
    }
  }
  subject.addChild(subBg);

  // "RATS" large text as the subject
  const subjText = new Text({
    text: 'RATS',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: Math.floor(w / 4.5), fontWeight: 'bold', fill: 0xdd4422 },
  });
  subjText.anchor.set(0.5);
  subjText.x = w / 2;
  subjText.y = h / 2;
  subject.addChild(subjText);

  // Decorative skull suggestion
  const skull = new Graphics();
  const sx = w / 2, sy = h / 2 + 50;
  skull.circle(sx, sy, 18).fill({ color: 0xccbbaa, alpha: 0.6 });
  skull.circle(sx - 7, sy + 2, 5).fill({ color: 0x080608, alpha: 0.8 });
  skull.circle(sx + 7, sy + 2, 5).fill({ color: 0x080608, alpha: 0.8 });
  skull.rect(sx - 5, sy + 9, 4, 5).fill({ color: 0x080608, alpha: 0.7 });
  skull.rect(sx + 1, sy + 9, 4, 5).fill({ color: 0x080608, alpha: 0.7 });
  subject.addChild(skull);

  const dissolveFilter = new DissolveFilter();
  subject.filters = [dissolveFilter];

  // Threshold oscillates: 0→1 over 2.5s, hold dissolved 0.5s, 1→0 over 2.5s, hold intact 1s
  const CYCLE = 6.5;

  const tick = (dt: { deltaMS: number }) => {
    if (cancelled) return;
    time += dt.deltaMS * 0.001;
    const t = (time % CYCLE) / CYCLE;

    let threshold: number;
    if (t < 0.4) {
      threshold = t / 0.4;              // dissolve in
    } else if (t < 0.48) {
      threshold = 1.0;                  // hold dissolved
    } else if (t < 0.88) {
      threshold = 1.0 - (t - 0.48) / 0.4; // reform
    } else {
      threshold = 0.0;                  // hold intact
    }

    dissolveFilter.threshold = threshold;
    dissolveFilter.edge = 0.07 + Math.sin(time * 2.1) * 0.02; // slight edge shimmer
  };

  app.ticker.add(tick);

  return () => {
    cancelled = true;
    app.ticker.remove(tick);
    dissolveFilter.destroy();
    [bgBase, subject, label].forEach((e) => e.destroy());
  };
}
