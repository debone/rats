/**
 * SHADER: Chromatic Aberration + Digital Glitch
 *
 * Two combined techniques:
 *
 * 1. CHROMATIC ABERRATION — lenses focus different wavelengths slightly
 *    differently. Simulate by sampling R, G, B channels at offset UVs.
 *    Radial offset from screen center = realistic lens aberration.
 *    Uniform offset = stylised "screen tearing" read.
 *
 * 2. SCANLINE GLITCH — divide the image into horizontal bands, then
 *    randomly translate some of them left/right for one frame. The
 *    "random" is driven by floor(uTime * frequency) so it changes at
 *    a discrete rate (looks digital, not smooth).
 *
 * Both effects are driven by uGlitch (0..1). At 0: subtle aberration only.
 * At 1: heavy scanline disruption. Glitch pulses on a timer.
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
uniform float uGlitch; // 0=subtle aberration only, 1=full glitch

float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }

void main(void) {
    vec2 uv = vTextureCoord;

    // Chromatic aberration: radial offset from centre, scales with uGlitch
    float aber = 0.003 + uGlitch * 0.012;
    vec2 dir = uv - vec2(0.5);
    vec2 offR = dir * aber;
    vec2 offB = -dir * aber;

    // Scanline glitch: random row offset
    if (uGlitch > 0.05) {
        float rowH = 0.04 + (1.0 - uGlitch) * 0.08; // finer rows when more glitchy
        float row  = floor(uv.y / rowH);
        float seed = floor(uTime * (4.0 + uGlitch * 12.0));
        if (rand(vec2(row, seed)) < uGlitch * 0.55) {
            float shift = (rand(vec2(row + 0.5, seed)) - 0.5) * uGlitch * 0.15;
            offR.x += shift + aber;
            offB.x += shift - aber;
            uv.x   += shift;
        }
    }

    float r = texture(uTexture, clamp(uv + offR, 0.0, 1.0)).r;
    float g = texture(uTexture, clamp(uv,        0.0, 1.0)).g;
    float b = texture(uTexture, clamp(uv + offB, 0.0, 1.0)).b;
    float a = texture(uTexture, uv).a;

    // Film grain (subtle, present even at uGlitch=0)
    float grain = (rand(uv + fract(uTime * 0.07)) - 0.5) * 0.04;

    finalColor = vec4(r + grain, g + grain, b + grain, a);
}
`;

const WGSL = `
struct GlitchUniforms { uTime: f32, uGlitch: f32 };
struct GlobalFilterUniforms {
  uInputSize: vec4<f32>, uInputPixel: vec4<f32>, uInputClamp: vec4<f32>,
  uOutputFrame: vec4<f32>, uGlobalFrame: vec4<f32>, uOutputTexture: vec4<f32>,
};
@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;
@group(1) @binding(0) var<uniform> glitchUniforms: GlitchUniforms;
struct VSOutput { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32> };
@vertex fn mainVertex(@location(0) aPosition: vec2<f32>) -> VSOutput {
    var pos = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;
    pos.x = pos.x * (2.0 / gfu.uOutputTexture.x) - 1.0;
    pos.y = pos.y * (2.0 * gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;
    return VSOutput(vec4(pos, 0.0, 1.0), aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw));
}
fn randW(co: vec2<f32>) -> f32 { return fract(sin(dot(co, vec2<f32>(12.9898, 78.233))) * 43758.5453); }
@fragment fn mainFragment(@builtin(position) pos: vec4<f32>, @location(0) uvIn: vec2<f32>) -> @location(0) vec4<f32> {
    var uv = uvIn;
    let g = glitchUniforms.uGlitch;
    let t = glitchUniforms.uTime;
    let aber = 0.003 + g * 0.012;
    let dirV = uv - vec2<f32>(0.5);
    var offR = dirV * aber;
    var offB = -dirV * aber;
    if (g > 0.05) {
        let rowH = 0.04 + (1.0 - g) * 0.08;
        let row = floor(uv.y / rowH);
        let seed = floor(t * (4.0 + g * 12.0));
        if (randW(vec2<f32>(row, seed)) < g * 0.55) {
            let shift = (randW(vec2<f32>(row + 0.5, seed)) - 0.5) * g * 0.15;
            offR.x += shift + aber; offB.x += shift - aber; uv.x += shift;
        }
    }
    let r = textureSample(uTexture, uSampler, clamp(uv + offR, vec2<f32>(0.0), vec2<f32>(1.0))).r;
    let gv = textureSample(uTexture, uSampler, clamp(uv, vec2<f32>(0.0), vec2<f32>(1.0))).g;
    let b = textureSample(uTexture, uSampler, clamp(uv + offB, vec2<f32>(0.0), vec2<f32>(1.0))).b;
    let a = textureSample(uTexture, uSampler, uv).a;
    let grain = (randW(uv + fract(vec2<f32>(t * 0.07))) - 0.5) * 0.04;
    return vec4<f32>(r + grain, gv + grain, b + grain, a);
}
`;

class GlitchFilter extends Filter {
  constructor() {
    super({
      glProgram: GlProgram.from({ vertex: VERT_GLSL, fragment: FRAG_GLSL, name: 'glitch' }),
      gpuProgram: GpuProgram.from({ vertex: { source: WGSL, entryPoint: 'mainVertex' }, fragment: { source: WGSL, entryPoint: 'mainFragment' } }),
      resources: {
        glitchUniforms: {
          uTime:   { value: 0, type: 'f32' },
          uGlitch: { value: 0, type: 'f32' },
        },
      },
    });
  }
  get time()   { return this.resources.glitchUniforms.uniforms.uTime; }
  set time(v)  { this.resources.glitchUniforms.uniforms.uTime = v; }
  get glitch() { return this.resources.glitchUniforms.uniforms.uGlitch; }
  set glitch(v){ this.resources.glitchUniforms.uniforms.uGlitch = v; }
}

export function glitchEffect(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let time = 0;

  const label = new Text({
    text: 'SHADER: GLITCH — chromatic aberration (radial UV offset) + random scanline disruption',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x3a5a3a, letterSpacing: 1 },
  });
  label.x = 6; label.y = 6;
  root.addChild(label);

  // ── Security camera feed scene ────────────────────────────────────────
  const scene = new Container();
  root.addChild(scene);

  // Monochrome corridor
  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x1a1e1a);
  // Perspective floor lines
  for (let i = 1; i <= 5; i++) {
    const t = i / 6;
    const y = h * 0.45 + t * h * 0.5;
    const xOff = w * 0.5 * (1 - t);
    bg.moveTo(xOff, y).lineTo(w - xOff, y).stroke({ color: 0x2a2e2a, width: 0.8 });
  }
  // Ceiling
  bg.moveTo(0, h * 0.08).lineTo(w, h * 0.08).stroke({ color: 0x222622, width: 1 });
  // Walls converging to vanishing point
  bg.moveTo(0, 0).lineTo(w * 0.5, h * 0.45).stroke({ color: 0x222622, width: 1 });
  bg.moveTo(w, 0).lineTo(w * 0.5, h * 0.45).stroke({ color: 0x222622, width: 1 });
  // A pipe running down the right wall
  bg.rect(w * 0.78, 0, 4, h).fill({ color: 0x222a22, alpha: 0.7 });
  // Security cam overlay text
  const camText = new Text({
    text: 'CAM-04   REC',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0x44aa44 },
  });
  camText.x = 8; camText.y = h - 18;
  bg.addChild(camText);
  const tsText = new Text({
    text: '02:34:17',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0x44aa44 },
  });
  tsText.anchor.set(1, 0);
  tsText.x = w - 8; tsText.y = h - 18;
  bg.addChild(tsText);
  scene.addChild(bg);

  // Apply glitch filter to the whole scene
  const glitch = new GlitchFilter();
  scene.filters = [glitch];

  // Glitch pulse timer
  let glitchTimer = 0;
  let glitchActive = false;
  let glitchDur = 0;
  let nextGlitch = 1800 + Math.random() * 2000;

  const tick = (dt: { deltaMS: number }) => {
    if (cancelled) return;
    time += dt.deltaMS * 0.001;
    glitch.time = time;

    if (glitchActive) {
      glitchTimer += dt.deltaMS;
      const progress = glitchTimer / glitchDur;
      // Spike up quickly, decay slowly
      const intensity = Math.max(0, 1 - progress * progress);
      glitch.glitch = intensity;
      if (glitchTimer >= glitchDur) {
        glitchActive = false;
        glitch.glitch = 0;
        nextGlitch = 1200 + Math.random() * 3000;
      }
    } else {
      nextGlitch -= dt.deltaMS;
      // Subtle persistent aberration
      glitch.glitch = 0.04 + Math.sin(time * 0.3) * 0.02;
      if (nextGlitch <= 0) {
        glitchActive = true;
        glitchTimer = 0;
        glitchDur = 200 + Math.random() * 400;
        glitch.glitch = 1;
      }
    }
  };

  app.ticker.add(tick);

  return () => {
    cancelled = true;
    app.ticker.remove(tick);
    glitch.destroy();
    [scene, label].forEach((e) => e.destroy());
  };
}
