import { sound } from '@pixi/sound';
import type { Application } from 'pixi.js';

import { navigation } from './navigation';
import { MIN_HEIGHT, MIN_WIDTH } from '@/consts';

/** Set up a resize function for the app */
export function resize(app: Application) {
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  const minWidth = MIN_WIDTH;
  const minHeight = MIN_HEIGHT;

  // Calculate renderer and canvas sizes based on current dimensions
  const scaleX = windowWidth < minWidth ? minWidth / windowWidth : 1;
  const scaleY = windowHeight < minHeight ? minHeight / windowHeight : 1;
  const scale = scaleX > scaleY ? scaleX : scaleY;
  const width = windowWidth * scale;
  const height = windowHeight * scale;

  // Update canvas style dimensions and scroll window up to avoid issues on mobile resize
  app.renderer.canvas.style.width = `${windowWidth}px`;
  app.renderer.canvas.style.height = `${windowHeight}px`;
  window.scrollTo(0, 0);

  // Update renderer  and navigation screens dimensions
  app.renderer.resize(width, height);
  navigation.resize(width, height);
}

/** Fire when document visibility changes - lose or regain focus */
export function visibilityChange() {
  if (document.hidden) {
    sound.pauseAll();
    navigation.blur();
  } else {
    sound.resumeAll();
    navigation.focus();
  }
}
