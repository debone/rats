/**
 * MESH CUTSCENE: Security Camera Alert
 *
 * A CCTV feed monitoring a sewer tunnel. Rats are spotted. Alert fires.
 *
 * Technique: The live scene (animated tunnel + rat silhouettes) is rendered
 * into a RenderTexture every frame. A MeshPlane displays it with UV-space
 * scan-line distortion baked in — shifting every other horizontal strip of
 * vertices by a tiny U amount, giving the CRT phosphor-line look.
 *
 * On ALERT, the UV distortion explodes (random per-vertex noise) simulating
 * a feed breaking up under interference. This is a pure UV manipulation:
 * vertex positions stay fixed, only the texture sampling coordinates change.
 *
 * A plain Sprite showing the same RenderTexture could not do this — it has
 * no per-region UV control.
 */
import { animate } from 'animejs';
import { Container, Graphics, Mesh, PlaneGeometry, RenderTexture, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';

const VX = 40;
const VY = 30;

export function dangerScan(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (fn: () => void, ms: number) =>
    timers.push(setTimeout(() => { if (!cancelled) fn(); }, ms));

  let glitchIntensity = 0;
  let alertPhase = false;

  // ── Scene content (rendered into RT) ─────────────────────────────────
  const scene = new Container();

  const sceneBg = new Graphics().rect(0, 0, w, h).fill(0x060a06);
  scene.addChild(sceneBg);

  // Tunnel walls in scene
  const sTunnel = new Graphics();
  sTunnel.rect(0, 0, w * 0.12, h).fill(0x0c100c);
  sTunnel.rect(w * 0.88, 0, w * 0.12, h).fill(0x0c100c);
  for (let y = 10; y < h; y += 18)
    sTunnel.rect(w*0.12, y, w*0.76, 1).fill({ color: 0x0e120e, alpha: 0.5 });
  sTunnel.rect(w*0.12, h*0.65, w*0.76, h*0.35).fill(0x080c08); // floor
  scene.addChild(sTunnel);

  // Pipe silhouettes
  const sPipes = new Graphics();
  sPipes.roundRect(0, h*0.25, w*0.12 + 8, 14, 3).fill(0x1a1e18);
  sPipes.roundRect(w*0.88 - 8, h*0.18, w*0.12 + 8, 14, 3).fill(0x1a1e18);
  sPipes.roundRect(w*0.3, 0, 12, h*0.35, 3).fill(0x141814);
  scene.addChild(sPipes);

  // Rat silhouettes (simple shapes)
  function makeSceneRat(): Graphics {
    const r = new Graphics();
    r.ellipse(0, 0, 10, 5).fill(0x222822);
    r.ellipse(8, -1, 5, 3.5).fill(0x1c221c);
    r.circle(11.5, -2, 1.5).fill({ color: 0xff2200, alpha: 0.85 });
    r.moveTo(-7, 2).bezierCurveTo(-14, 7, -22, 3, -26, 6).stroke({ color: 0x141814, width: 1.5 });
    return r;
  }
  const sceneRat1 = makeSceneRat(); sceneRat1.x = w * 0.2;  sceneRat1.y = h * 0.62;
  const sceneRat2 = makeSceneRat(); sceneRat2.x = w * 0.75; sceneRat2.y = h * 0.64;
  const sceneRat3 = makeSceneRat(); sceneRat3.x = -30;      sceneRat3.y = h * 0.63;
  scene.addChild(sceneRat1, sceneRat2, sceneRat3);

  // Cam timestamp
  const camInfo = new Text({
    text: 'CAM 04  ·  SEWER-B  ·  00:03:47',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x44aa44 },
  });
  camInfo.x = 6; camInfo.y = h - 14;
  scene.addChild(camInfo);

  // ── RenderTexture + distort mesh ──────────────────────────────────────
  const rt  = RenderTexture.create({ width: w, height: h });
  const geo = new PlaneGeometry({ width: w, height: h, verticesX: VX, verticesY: VY });
  const crtMesh = new Mesh({ geometry: geo, texture: rt });
  crtMesh.tint  = 0xaaffaa;   // phosphor green tint
  crtMesh.alpha = 0;
  root.addChild(crtMesh);

  const { buffer: uvBuf } = geo.getAttribute('aUV');
  const restU = new Float32Array(VX * VY);
  const restV = new Float32Array(VX * VY);
  for (let i = 0; i < VX * VY; i++) {
    restU[i] = uvBuf.data[i * 2];
    restV[i] = uvBuf.data[i * 2 + 1];
  }

  // ── Overlays (drawn above mesh, in demoRoot space) ────────────────────
  // CCTV frame border
  const border = new Graphics()
    .rect(0, 0, w, h).stroke({ color: 0x22aa22, width: 3, alpha: 0.6 });
  border.alpha = 0;
  root.addChild(border);

  // Motion detection box (appears on rat3 entering)
  const motionBox = new Graphics()
    .rect(-30 - 14, h * 0.62 - 8, 28, 16).stroke({ color: 0xff4400, width: 1.5, alpha: 0.9 });
  motionBox.alpha = 0;
  root.addChild(motionBox);

  // ALERT overlay
  const alertBg = new Graphics().rect(0, 0, w, h).fill({ color: 0xff0000, alpha: 0.08 });
  alertBg.alpha = 0;
  root.addChild(alertBg);

  const alertText = new Text({
    text: '! MOTION DETECTED — SECURITY ALERT !',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 12, fill: 0xff2200, fontWeight: 'bold', letterSpacing: 2 },
  });
  alertText.anchor.set(0.5); alertText.x = w / 2; alertText.y = h * 0.14;
  alertText.alpha = 0;
  root.addChild(alertText);

  const staticText = new Text({
    text: 'SIGNAL LOST',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 18, fill: 0x88ff88, fontWeight: 'bold', letterSpacing: 4 },
  });
  staticText.anchor.set(0.5); staticText.x = w / 2; staticText.y = h / 2;
  staticText.alpha = 0;
  root.addChild(staticText);

  let t = 0;
  const tick = (dt: { deltaMS: number }) => {
    t += dt.deltaMS / 1000;

    // Animate scene rats
    sceneRat1.x = w * 0.2 + Math.sin(t * 0.7) * 6;
    sceneRat1.rotation = Math.sin(t * 0.9) * 0.08;
    sceneRat3.x = -30 + t * 22; // rat3 walks into frame — triggers detection
    sceneRat3.x = Math.min(w * 0.5, sceneRat3.x);
    motionBox.x = sceneRat3.x - 14 - w * 0.5 + sceneRat3.x;
    motionBox.x = sceneRat3.x - 14;

    // Update cam timestamp
    const secs = Math.floor(t) % 60;
    const mins = 3 + Math.floor(t / 60);
    camInfo.text = `CAM 04  ·  SEWER-B  ·  00:0${mins}:${secs < 10 ? '0' : ''}${secs}`;

    // Render scene to RT
    app.renderer.render({ container: scene, target: rt });

    // UV distortion — scan-line baseline + glitch
    for (let iy = 0; iy < VY; iy++) {
      for (let ix = 0; ix < VX; ix++) {
        const i = iy * VX + ix;
        // Subtle scan-line (every other row shifts slightly)
        const scanShift = (iy % 2 === 0 ? 0.0012 : -0.0006) * Math.sin(t * 60 + iy * 0.5);
        const noiseU = alertPhase ? (Math.random() - 0.5) * glitchIntensity * 0.12 : 0;
        const noiseV = alertPhase ? (Math.random() - 0.5) * glitchIntensity * 0.05 : 0;
        uvBuf.data[i * 2]     = restU[i] + scanShift + noiseU;
        uvBuf.data[i * 2 + 1] = restV[i] + noiseV;
      }
    }
    uvBuf.update();

    // Alert pulsing
    if (alertPhase) {
      alertBg.alpha  = 0.06 + 0.06 * Math.sin(t * 8);
      alertText.alpha = (Math.sin(t * 5) > -0.3) ? 1 : 0.1;
    }
  };

  // Sequence
  animate(crtMesh, { alpha: 1, duration: 1000, easing: 'easeIn' });
  animate(border,  { alpha: 1, duration: 1000 });
  app.ticker.add(tick);

  // Rat3 enters frame at ~2.5s — motion box appears
  later(() => {
    animate(motionBox, { alpha: [0, 1], duration: 400 });
  }, 2500);

  // Alert fires
  later(() => {
    alertPhase = true;
    animate({ v: 0 }, { v: 1, duration: 1500, onUpdate: (a) => glitchIntensity = (a.targets[0] as { v: number }).v });
    animate(alertBg, { alpha: 1, duration: 300 });
    animate(alertText, { alpha: [0, 1, 0, 1], duration: 600,
      keyframes: [{ alpha: 0 }, { alpha: 1, duration: 150 }, { alpha: 0, duration: 150 }, { alpha: 1, duration: 300 }]
    });
  }, 3800);

  // Feed degrades
  later(() => {
    animate({ v: 1 }, { v: 3, duration: 1200, onUpdate: (a) => glitchIntensity = (a.targets[0] as { v: number }).v });
    crtMesh.tint = 0xffffff;  // lose the green when signal breaks
  }, 5800);

  later(() => {
    animate(crtMesh, { alpha: 0.15, duration: 600 });
    animate(staticText, { alpha: [0, 1], duration: 500 });
    animate(alertText, { alpha: 0, duration: 400 });
    animate(alertBg, { alpha: 0, duration: 400 });
  }, 7000);

  return () => {
    cancelled = true;
    timers.forEach(clearTimeout);
    app.ticker.remove(tick);
    rt.destroy(true);
    scene.destroy({ children: true });
    [crtMesh, border, motionBox, alertBg, alertText, staticText].forEach(e => e.destroy({ children: true }));
  };
}
