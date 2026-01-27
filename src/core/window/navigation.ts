import { areBundlesLoaded } from '@/core/assets/assets';
import { pool } from '@/core/common/pool';
import { GameEvent } from '@/data/events';
import type { GameContext, GameLayers } from '@/data/game-context';
import { app } from '@/main';
import { Assets, Container } from 'pixi.js';
import { assert } from '../common/assert';
import { createGameLayers, destroyGameLayers } from './layers';
import type { AppScreen, AppScreenConstructor, LayerName } from './types';

export class Navigation {
  /** Container for screens and layers */
  public container = new Container();

  /** Application width */
  public width = 0;

  /** Application height */
  public height = 0;

  /** Current screen being displayed */
  public currentScreen?: AppScreen;

  /** Current popup being displayed */
  public currentOverlay?: AppScreen;

  /** Game context */
  public context!: GameContext;

  /** Game layers */
  private layers: GameLayers | null = null;

  addToLayer(child: Container, layer: LayerName, makeVisible: boolean = true): void {
    if (this.layers && this.layers[layer]) {
      this.layers[layer].addChild(child);

      if (makeVisible) {
        this.layers[layer].visible = true;
      }
    }
  }

  hideLayer(layer: LayerName): void {
    if (this.layers && this.layers[layer]) {
      this.layers[layer].visible = false;
    }
  }

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
    this.layers = createGameLayers(app.stage, this.context.camera);

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
    screen.interactiveChildren = false;

    if (screen.show) {
      await screen.show();
    }

    if (!this.currentOverlay) {
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

    if (this.layers) {
      destroyGameLayers(this.layers);
      this.layers = null;
    }

    // Clean up the screen so that instance can be reused again later
    if (screen.reset) {
      screen.reset();
    }

    this.context.events.emit(GameEvent.SCREEN_UNLOADED, { screenId: (screen as any).SCREEN_ID });
  }

  private async addAndShowOverlay(overlay: AppScreen) {
    console.log('[Navigation] Adding and showing overlay', overlay.constructor.name);

    // Setup things and pre-organise screen before showing
    if (overlay.prepare) {
      overlay.prepare();
    }

    // Add screen's resize handler, if available
    if (overlay.resize) {
      // Trigger a first resize
      this.resize(this.width, this.height);
    }

    // Add update function if available
    if (overlay.update) {
      app.ticker.add(overlay.update, overlay);
    }

    this.context.events.emit(GameEvent.OVERLAY_READY, { overlayId: (overlay as any).SCREEN_ID });

    // Show the new screen
    if (overlay.show) {
      overlay.interactiveChildren = false;
      await overlay.show();
      overlay.interactiveChildren = true;
    }
  }

  private async hideAndRemoveOverlay(overlay: AppScreen) {
    console.log('[Navigation] Hiding and removing popup', overlay.constructor.name);
    // Prevent interaction in the screen
    overlay.interactiveChildren = false;

    // Hide screen if method is available
    if (overlay.hide) {
      await overlay.hide();
    }

    // Unlink update function if method is available
    if (overlay.update) {
      app.ticker.remove(overlay.update, overlay);
    }

    // Remove screen from its parent
    if (overlay.parent) {
      overlay.parent.removeChild(overlay);
    }

    // Clean up the screen so that instance can be reused again later
    if (overlay.reset) {
      overlay.reset();
    }

    this.context.events.emit(GameEvent.OVERLAY_UNLOADED, { overlayId: (overlay as any).SCREEN_ID });
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

  public async showOverlay(ctor: AppScreenConstructor) {
    assert(!this.currentOverlay, 'An overlay is already being displayed');

    if (this.currentScreen) {
      this.currentScreen.interactiveChildren = false;
    }

    if (ctor.assetBundles && !areBundlesLoaded(ctor.assetBundles)) {
      await Assets.loadBundle(ctor.assetBundles);
    }

    const overlay = pool.get(ctor);
    this.currentOverlay = overlay;
    await this.addAndShowOverlay(overlay);
  }

  public async dismissCurrentOverlay() {
    assert(this.currentOverlay, 'No overlay to dismiss');

    await this.hideAndRemoveOverlay(this.currentOverlay);
    this.currentOverlay = undefined;

    if (this.currentScreen) {
      this.currentScreen.interactiveChildren = true;
    }
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

    // Resize popup
    if (this.currentOverlay) {
      // TODO: bug when refreshing the screen. But should it?
      this.currentOverlay.layout = { width, height };
      this.currentOverlay.resize?.(width, height);
    }

    // Resize all layers
    if (this.layers) {
      for (const layer of Object.values(this.layers)) {
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
