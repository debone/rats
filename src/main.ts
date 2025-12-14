import '@pixi/layout';
import { engine } from 'animejs';
import { Application, TextureStyle } from 'pixi.js';
import { InputDevice } from 'pixijs-input-devices';

import { initAssets } from '@/core/assets/assets';
import { audio } from '@/core/audio/audio';
import { storage } from '@/core/storage/storage';
import { resize, visibilityChange } from '@/core/window/resize';

// Game Core
import { SystemRunner } from '@/core/game/SystemRunner';
import { EventEmitter, EventContext } from '@/core/game/EventEmitter';
import { execute } from '@/core/game/Command';
import { createDefaultMetaState } from '@/data/game-state';
import { setGameContext } from '@/data/game-context';
import type { GameContext } from '@/data/game-context';

// Systems
import { NavigationSystem } from '@/systems/navigation/system';
import { SaveSystem } from '@/systems/save/system';

// Commands
import { AppStartCommand } from '@/systems/app/commands/AppStartCommand';

export const app = new Application();

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
    backgroundColor: 0xffffff,
  });

  // Add pixi canvas element (app.canvas) to the document's body
  document.body.appendChild(app.canvas);

  // Create game context
  const emitter = new EventEmitter();
  const events = new EventContext(emitter);

  const context: GameContext = {
    app,
    worldId: null,
    container: null,
    meta: createDefaultMetaState(),
    run: null,
    level: null,
    phase: 'idle',
    systems: new SystemRunner(),
    events,
  };

  // Make context globally accessible
  setGameContext(context);

  context.systems.add(NavigationSystem);
  context.systems.add(SaveSystem);

  // Initialize all systems
  context.systems.init(context);

  // Setup assets bundles and start loading
  await initAssets();
  storage.readyStorage();
  audio.muted(storage.getStorageItem('muted'));

  // Load meta state
  const savedMeta = await context.systems.get(SaveSystem).loadMeta();
  if (savedMeta) {
    context.meta = savedMeta;
  }

  // Main loop
  app.ticker.add((time) => {
    engine.update();
    InputDevice.update();

    // Update all scheduled systems
    context.systems.update(time.deltaMS);
  });

  // Resize handler
  window.addEventListener('resize', () => resize(app, context));
  resize(app, context); // Initial resize

  // Visibility change handler
  document.addEventListener('visibilitychange', visibilityChange);

  // Start the app via command
  execute(AppStartCommand);
}

// Init everything
init();
