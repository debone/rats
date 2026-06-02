import '@pixi/layout';
import { engine } from 'animejs';
import { Application, TextureStyle } from 'pixi.js';
import { InputDevice } from 'pixijs-input-devices';

import { initAssets } from '@/core/assets/assets';
import { initTone } from '@/core/audio/audio';
import { storage } from '@/core/storage/storage';
import { resize, visibilityChange } from '@/core/window/resize';

// Game Core
import { EventContext, EventEmitter } from '@/core/game/EventEmitter';
import { SystemRunner } from '@/core/game/SystemRunner';
import type { GameContext } from '@/data/game-context';
import { createGameContext, setGameContext } from '@/data/game-context';
import { createGameState, type GameState, setGameState } from '@/data/game-state';

// Systems
import { NavigationSystem } from '@/systems/navigation/system';
import { SaveSystem } from '@/systems/save/system';

// Register all gameplay VFX effects with the engine's VFXSystem (auto-discovered).
import '@/gameplay/vfx';

// Commands

import { initDevtools } from '@pixi/devtools';
import '@pixi/layout/devtools';

import { CAMERA_Z_INDEX } from './consts';
import { Camera } from './core/camera/camera';
import { CameraDebug } from './core/camera/camera-debug';
import { DebugPanel } from './core/devtools/debug-panel';
import { navigation } from './core/window/navigation';
import { HomeScene } from './scenes/HomeScene';
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

  // Add pixi canvas element (app.canvas) to the document's body
  document.body.appendChild(app.canvas);

  // Create game context
  const emitter = new EventEmitter();
  const events = new EventContext(emitter);
  const systems = new SystemRunner();

  const camera = new Camera();
  camera.viewport.zIndex = CAMERA_Z_INDEX;
  app.stage.addChild(camera.viewport);

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
  });

  const resizer = () => {
    resize(app, context);
  };

  // Resize handler
  window.addEventListener('resize', resizer);
  setTimeout(resizer, 16); // Initial resize

  // Visibility change handler
  document.addEventListener('visibilitychange', visibilityChange);

  // Start the app
  HomeScene();
}

// Init everything
init();
