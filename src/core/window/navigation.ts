import { areBundlesLoaded } from '@/core/assets/assets';
import { pool } from '@/core/common/pool';
import { GameEvent } from '@/data/events';
import type { GameContext } from '@/data/game-context';
import { app } from '@/main';
import { Assets, Container } from 'pixi.js';
import { createGameLayers, destroyGameLayers } from './layers';
import type { AppScreen, AppScreenConstructor } from './types';

class Navigation {
  /** Container for screens and layers */
  public container = new Container();

  /** Application width */
  public width = 0;

  /** Application height */
  public height = 0;

  /** Current screen being displayed */
  public currentScreen?: AppScreen;

  /** Game context */
  public context!: GameContext;

  setContext(context: GameContext) {
    this.context = context;
  }

  /** Add screen to the stage, link update & resize functions */
  private async addAndShowScreen(screen: AppScreen) {
    // Add navigation container to stage if it does not have a parent yet
    if (!this.container.parent) {
      app.stage.addChild(this.container);
    }

    // Create layers for this screen (if specified)
    this.context.layers = createGameLayers(app.stage, this.context.camera);

    // Add screen to stage (after layers so screen is on top)
    // TODO: Not needed? Why GameScreen even extends Container then?
    // this.container.addChild(screen);

    // Setup things and pre-organise screen before showing
    if (screen.prepare) {
      screen.prepare();
    }

    // Add screen's resize handler, if available
    if (screen.resize) {
      // Trigger a first resize
      this.resize(this.width, this.height);
    }

    // Add update function if available
    if (screen.update) {
      app.ticker.add(screen.update, screen);
    }

    this.context.events.emit(GameEvent.SCREEN_READY, { screenId: (screen as any).SCREEN_ID });

    // Show the new screen
    if (screen.show) {
      screen.interactiveChildren = false;
      await screen.show();
      screen.interactiveChildren = true;
    }
  }

  /** Remove screen from the stage, unlink update & resize functions */
  private async hideAndRemoveScreen(screen: AppScreen) {
    console.log('[Navigation] Hiding and removing screen', screen.constructor.name);
    // Prevent interaction in the screen
    screen.interactiveChildren = false;

    // Hide screen if method is available
    if (screen.hide) {
      await screen.hide();
    }

    // Unlink update function if method is available
    if (screen.update) {
      app.ticker.remove(screen.update, screen);
    }

    // Remove screen from its parent
    if (screen.parent) {
      screen.parent.removeChild(screen);
    }

    // Destroy camera and layers for this screen
    // TODO: maybe? Sorry :)
    // this.context.camera.reset();

    if (this.context.layers) {
      destroyGameLayers(this.context.layers);
      this.context.layers = null;
    }

    // Clean up the screen so that instance can be reused again later
    if (screen.reset) {
      screen.reset();
    }

    this.context.events.emit(GameEvent.SCREEN_UNLOADED, { screenId: (screen as any).SCREEN_ID });
  }

  /**
   * Hide current screen (if there is one) and present a new screen.
   * Any class that matches AppScreen interface can be used here.
   */
  public async showScreen(ctor: AppScreenConstructor) {
    // Block interactivity in current screen
    if (this.currentScreen) {
      this.currentScreen.interactiveChildren = false;
    }

    // Load assets for the new screen, if available
    if (ctor.assetBundles && !areBundlesLoaded(ctor.assetBundles)) {
      // Load all assets required by this new screen
      await Assets.loadBundle(ctor.assetBundles);
    }

    // If there is a screen already created, hide and destroy it
    if (this.currentScreen) {
      await this.hideAndRemoveScreen(this.currentScreen);
    }

    // Create the new screen and add that to the stage
    this.currentScreen = pool.get(ctor);
    await this.addAndShowScreen(this.currentScreen);
  }

  /**
   * Resize screens
   * @param width Viewport width
   * @param height Viewport height
   */
  public resize(width: number, height: number) {
    this.width = width;
    this.height = height;

    // Resize screen
    if (this.currentScreen) {
      this.currentScreen.layout = { width, height };
      this.currentScreen.resize?.(width, height);
    }

    // Resize all layers
    if (this.context.layers) {
      for (const layer of Object.values(this.context.layers)) {
        layer.layout = { width, height };
      }
    }
  }

  /** Blur screen when window loses focus */
  public blur() {
    this.currentScreen?.blur?.();
  }

  /** Focus screen when window gains focus */
  public focus() {
    this.currentScreen?.focus?.();
  }
}

/** Shared navigation instance */
export const navigation = new Navigation();
