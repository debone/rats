import '@pixi/layout';
import { Application } from 'pixi.js';

import { initAssets } from '@/core/assets/assets';
import { audio } from '@/core/audio/audio';
import { storage } from '@/core/storage/storage';
import { navigation } from '@/core/window/navigation';
import { resize, visibilityChange } from '@/core/window/resize';
import { engine } from 'animejs';
import { LoadScreen } from './screens/LoadScreen';
import { GameScreen } from './screens/GameScreen';

export const app = new Application();

// Disabling animejs own loop
engine.useDefaultMainLoop = false;

/** Setup app and initialise assets */
async function init() {
  // Initialize app
  await app.init({
    resolution: Math.max(window.devicePixelRatio, 2),
    backgroundColor: 0xffffff,
  });

  app.ticker.add(() => {
    engine.update();
  });

  // Add pixi canvas element (app.canvas) to the document's body
  document.body.appendChild(app.canvas);

  // Whenever the window resizes, call the 'resize' function
  window.addEventListener('resize', () => resize(app));

  // Trigger the first resize
  resize(app);

  // Add a visibility listener, so the app can pause sounds and screens
  document.addEventListener('visibilitychange', visibilityChange);

  // Setup assets bundles (see assets.ts) and start up loading everything in background
  await initAssets();

  storage.readyStorage();

  // Add a persisting background shared by all screens
  //navigation.setBackground(TiledBackground);

  audio.muted(storage.getStorageItem('muted'));

  // Show initial loading screen
  await navigation.showScreen(LoadScreen);

  // Go to one of the screens if a shortcut is present in url params, otherwise go to home screen
  // if (getUrlParam('game') !== null) {
  // await navigation.showScreen(GameScreen);
  // } else if (getUrlParam('load') !== null) {
  //   await navigation.showScreen(LoadScreen);
  // } else if (getUrlParam('result') !== null) {
  //   await navigation.showScreen(ResultScreen);
  // } else {
  // }
  await navigation.showScreen(GameScreen);
}

// Init everything
init();
