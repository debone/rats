import '@pixi/layout';
import { engine } from 'animejs';
import { Application, TextureStyle } from 'pixi.js';
import { InputDevice } from 'pixijs-input-devices';

import { initAssets } from '@/core/assets/assets';
import { initTone } from '@/core/audio/audio';
import { storage } from '@/core/storage/storage';
import { resize, visibilityChange } from '@/core/window/resize';

// Game Core
import { execute } from '@/core/game/Command';
import { EventContext, EventEmitter } from '@/core/game/EventEmitter';
import { SystemRunner } from '@/core/game/SystemRunner';
import type { GameContext } from '@/data/game-context';
import { createGameContext, setGameContext } from '@/data/game-context';
import { createGameState, setGameState } from '@/data/game-state';

// Systems
import { NavigationSystem } from '@/systems/navigation/system';
import { SaveSystem } from '@/systems/save/system';

// Commands
import { AppStartCommand } from '@/systems/app/commands/AppStartCommand';

import { CRT2Filter } from './lib/CRT/CRT';

import { initDevtools } from '@pixi/devtools';
import '@pixi/layout/devtools';

import { CAMERA_Z_INDEX, MIN_HEIGHT, UI_Z_INDEX } from './consts';
import { Camera } from './core/camera/camera';
import { CameraDebug } from './core/camera/camera-debug';
import { DebugPanel } from './core/devtools/debug-panel';
import { navigation } from './core/window/navigation';
import { ReflectionFilter2 } from './lib/ReflectionFilter/ReflectionFilter';

export const app = new Application();

if (import.meta.env.DEV) {
  initDevtools({ app });
  DebugPanel.init();
}

// Disabling animejs own loop
engine.useDefaultMainLoop = false;

async function init() {
  TextureStyle.defaultOptions.scaleMode = 'nearest';
  TextureStyle.defaultOptions.mipmapFilter = 'nearest';

  await app.init({
    autoDensity: false,
    resolution: Math.max(window.devicePixelRatio, 2),
    roundPixels: false,
    antialias: false,
    backgroundColor: 0x000000,
    sharedTicker: true,
  });

  if (import.meta.env.DEV) {
    DebugPanel.connectTicker(app);
  }

  await initTone();

  document.body.appendChild(app.canvas);

  // z-index sorting required for camera viewport to sit below UI layers
  app.stage.sortableChildren = true;

  const emitter = new EventEmitter();
  const events = new EventContext(emitter);
  const systems = new SystemRunner();

  const camera = new Camera();
  camera.viewport.zIndex = CAMERA_Z_INDEX;

  if (import.meta.env.DEV) {
    camera.debug = new CameraDebug(camera);
    camera.debug.initDebugPanel();
  }

  const context: GameContext = createGameContext(app, events, systems, camera, navigation);
  setGameContext(context);

  document.addEventListener('visibilitychange', visibilityChange);

  const isStorybook = import.meta.env.DEV && new URLSearchParams(window.location.search).has('storybook');

  if (isStorybook) {
    await initStorybookMode(context);
  } else {
    await initGameMode(context);
  }
}

// ── Storybook mode ────────────────────────────────────────────────────────────
// Minimal bootstrap: Pixi app + assets + camera + StorybookScreen.
// No game systems, no navigation, no physics.
async function initStorybookMode(context: GameContext) {
  const { camera } = context;

  await initAssets();

  // Camera viewport on stage so shake/zoom/fade effects are visible in demos
  app.stage.addChild(camera.viewport);

  const { StorybookScreen } = await import('@/screens/Storybook/StorybookScreen');
  const screen = new StorybookScreen();
  screen.zIndex = UI_Z_INDEX;
  app.stage.addChild(screen);

  const sbResizer = () => {
    const { width, height } = resize(app, context);
    screen.resize(width, height);
  };
  window.addEventListener('resize', sbResizer);
  sbResizer();
  screen.prepare();

  app.ticker.add(() => {
    engine.update();
    context.camera.update();
  });
}

// ── Game mode ─────────────────────────────────────────────────────────────────
async function initGameMode(context: GameContext) {
  const { camera } = context;

  const mirror = new ReflectionFilter2({
    alpha: [1.0, 0.0],
    amplitude: [20, 200],
  });

  const c = new CRT2Filter({
    curvature: 0,
    lineWidth: 0,
    lineContrast: 0,
    noise: 0.12,
    vignetting: 0,
  });

  //app.stage.filters = [c, mirror];

  // Camera viewport on stage — game world layers (background/game/effects) live inside it
  app.stage.addChild(camera.viewport);

  context.systems.add(NavigationSystem);
  context.systems.add(SaveSystem);
  context.systems.init(context);

  await initAssets();
  storage.readyStorage();

  const savedMeta = await context.systems.get(SaveSystem).loadMeta();
  if (savedMeta) {
    // FIXME RATZ-107
    //setMetaState(savedMeta);
  }

  const state = createGameState();
  setGameState(state);

  let debugUpdateTime = 0;

  app.ticker.add((time) => {
    engine.update();
    InputDevice.update();

    context.systems.update(time.deltaMS);
    context.camera.update();

    if (import.meta.env.DEV) {
      debugUpdateTime += time.deltaMS;
      if (debugUpdateTime >= 1000) {
        context.camera.debug?.updateDebug();
        debugUpdateTime = 0;
      }
    }

    c.time += time.deltaMS / 500;
    mirror.time += time.deltaMS / 200;
  });

  const resizer = () => {
    const { height } = resize(app, context);

    const border = (height - MIN_HEIGHT) / 2 / height;
    const amplitude = MIN_HEIGHT / height;
    const boundaryPlace = 0.938;
    const mirrorBoundary = border + amplitude * boundaryPlace;
    mirror.boundary = mirrorBoundary;
  };

  window.addEventListener('resize', resizer);
  setTimeout(resizer, 16);

  execute(AppStartCommand);
}

init();
