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
import { createGameState, type GameState, setGameState } from '@/data/game-state';

// Systems
import { NavigationSystem } from '@/systems/navigation/system';
import { SaveSystem } from '@/systems/save/system';

// Commands
import { AppStartCommand } from '@/systems/app/commands/AppStartCommand';

import { BloomFilter } from 'pixi-filters';
import { CRT2Filter } from './lib/CRT/CRT';

import { initDevtools } from '@pixi/devtools';
import '@pixi/layout/devtools';

import { CAMERA_Z_INDEX, MIN_HEIGHT } from './consts';
import { Camera } from './core/camera/camera';
import { CameraDebug } from './core/camera/camera-debug';
import { DebugPanel } from './core/devtools/debug-panel';
import { navigation } from './core/window/navigation';
import { ReflectionFilter2 } from './lib/ReflectionFilter/ReflectionFilter';
import { ScheduleSystem } from './systems/app/ScheduleSystem';

export const app = new Application();

if (import.meta.env.DEV) {
  initDevtools({ app });
  DebugPanel.init();
}

// Disabling animejs own loop
engine.useDefaultMainLoop = false;

/** Setup app and initialise assets */
async function init() {
  TextureStyle.defaultOptions.scaleMode = 'nearest';
  TextureStyle.defaultOptions.mipmapFilter = 'nearest';

  // Initialize app
  await app.init({
    autoDensity: false,
    resolution: Math.max(window.devicePixelRatio, 2),
    roundPixels: false,
    antialias: false,
    backgroundColor: 0x000000,
    sharedTicker: true,
  });

  // Connect debug panel to ticker for FPS monitoring
  if (import.meta.env.DEV) {
    DebugPanel.connectTicker(app);
    //app.renderer.layout.enableDebug(true);
  }

  await initTone();

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

  const bloom = new BloomFilter({
    quality: 3,
    strength: 1,
  });
  /*
   */
  //app.stage.filters = [bloom, c];
  //app.stage.filters = [c, c, bloom];
  //app.stage.filters = [mirror, c, bloom];
  //app.stage.filters = [c, mirror];
  //app.stage.filters = [c, mirror, bloom];
  //app.stage.filters = [c, bloom, glow];

  // Add pixi canvas element (app.canvas) to the document's body
  document.body.appendChild(app.canvas);

  // Create game context
  const emitter = new EventEmitter();
  const events = new EventContext(emitter);
  const systems = new SystemRunner();

  const camera = new Camera();
  camera.viewport.zIndex = CAMERA_Z_INDEX;
  app.stage.addChild(camera.viewport);

  camera.viewport.filters = [mirror, c];

  if (import.meta.env.DEV) {
    camera.debug = new CameraDebug(camera);
    camera.debug.initDebugPanel();
  }

  const context: GameContext = createGameContext(app, events, systems, camera, navigation);
  setGameContext(context);

  const state: GameState = createGameState();
  setGameState(state);

  context.systems.add(NavigationSystem);
  context.systems.add(SaveSystem);
  context.systems.add(ScheduleSystem);

  // Initialize all systems
  context.systems.init(context);

  // Setup assets bundles and start loading
  await initAssets();
  storage.readyStorage();
  //audio.muted(storage.getStorageItem('muted'));
  // audio.muted(true);

  // Load meta state
  const savedMeta = await context.systems.get(SaveSystem).loadMeta();
  if (savedMeta) {
    // FIXME RATZ-107
    //setMetaState(savedMeta);
  }

  let debugUpdateTime = 0;

  // Main loop
  app.ticker.add((time) => {
    engine.update();
    InputDevice.update();

    // Update all scheduled systems
    context.systems.update(time.deltaMS);

    context.camera.update();

    // Once a second
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

    // The game world is MIN_HEIGHT (640px) tall. When the renderer height is larger,
    // the world is centered with equal empty space above and below.
    // border/amplitude describe that geometry in renderer-normalized [0..1] space,
    // which is the same coordinate space the filter shader uses (uDimensions.y = height).
    const border = (height - MIN_HEIGHT) / 2 / height;
    const amplitude = MIN_HEIGHT / height;

    const boundaryPlace = 0.938;

    const mirrorBoundary = border + amplitude * boundaryPlace;
    mirror.boundary = mirrorBoundary;
  };

  // Resize handler
  window.addEventListener('resize', resizer);
  setTimeout(resizer, 16); // Initial resize

  // Visibility change handler
  document.addEventListener('visibilitychange', visibilityChange);

  // Start the app via command
  execute(AppStartCommand);
}

// Init everything
init();
