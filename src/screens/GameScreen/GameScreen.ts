import { ASSETS } from '@/assets';
import type { PrototypeTextures } from '@/assets/frames';
import { MIN_HEIGHT, MIN_WIDTH, TEXT_STYLE_DEFAULT } from '@/consts';
import { typedAssets } from '@/core/assets/typed-assets';
import { navigation } from '@/core/window/navigation';
import { LAYER_NAMES, type AppScreen } from '@/core/window/types';
import { GameEvent, type EventPayload } from '@/data/events';
import { getGameContext } from '@/data/game-context';
import { PhysicsSystem } from '@/systems/physics/system';
import { LayoutContainer } from '@pixi/layout/components';
import { Button } from '@pixi/ui';
import { DropShadowFilter } from 'pixi-filters';
import { Color, Container, Text, Ticker, TilingSprite } from 'pixi.js';
import { BallCounter } from './ui/BallCounter';
import { LevelIndicator } from './ui/LevelIndicator';
import { ScrapCounter } from './ui/ScrapCounter';

/**
 * GameScreen is the main gameplay screen.
 * It provides the visual container for the game and handles game-specific UI.
 *
 * Note: The game logic is handled by systems (LevelSystem, PhysicsSystem, etc.)
 * which are managed by the SystemRunner. This screen just provides the view.
 */
export class GameScreen extends Container implements AppScreen {
  static readonly SCREEN_ID = 'game';
  static readonly assetBundles = ['preload', 'default'];

  private _background?: TilingSprite;
  private _popupLayer?: LayoutContainer;
  private _gameContainer?: Container;

  constructor() {
    super();
  }

  /**
   * Prepare is called before show.
   * Set up layers and game container reference in context.
   */
  async prepare() {
    console.log('[GameScreen] Preparing...');

    // Game container
    const gameContainer = new Container();
    this._gameContainer = gameContainer;

    // Tiling background
    const tilingSprite = new TilingSprite({
      texture: typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures['prototype_spritesheet_60#0'],
      width: 32,
      height: 32,
    });
    this._background = tilingSprite;

    const context = getGameContext();
    context.camera.setPosition(MIN_WIDTH / 2, MIN_HEIGHT / 2);

    // Add content to layers
    context.navigation.addToLayer(this._background, LAYER_NAMES.BACKGROUND);
    context.navigation.addToLayer(this, LAYER_NAMES.GAME);

    // Set the container on the context so systems can use it
    context.container = this;

    /*
    const b = new Sprite({
      texture: typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures['bricks_tile_2#0'],
      layout: { width: MIN_WIDTH, height: 8 },
    });
    layers.debug.addChild(b);

    setTimeout(() => {
      layers.debug.addChild(
        new Sprite({
          texture: typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures['bricks_tile_2#0'],
          x: context.camera.viewWidth / 2,
          y: context.camera.viewHeight / 2,
          width: 8,
          height: MIN_HEIGHT,
          anchor: { x: 0.5, y: 0.5 },
        }),
      );
    }, 100);
    */

    // Setup physics debug draw on debug layer
    const physicsSystem = context.systems.get(PhysicsSystem);
    physicsSystem.setupDebugDraw();

    // Setup event listeners for UI events
    this.setupEventListeners();

    const uiLayer = new LayoutContainer();
    uiLayer.layout = {
      gap: 10,
      padding: 10,
      flexDirection: 'column',
      alignItems: 'flex-start',
      width: MIN_WIDTH,
      height: MIN_HEIGHT,
    };
    context.navigation.addToLayer(uiLayer, LAYER_NAMES.UI);

    uiLayer.addChild(new LevelIndicator());
    uiLayer.addChild(new BallCounter());
    uiLayer.addChild(new ScrapCounter());

    const popupLayer = new LayoutContainer({
      layout: {
        backgroundColor: new Color({ r: 30, g: 30, b: 45, a: 0.8 }),
        gap: 10,
        padding: 10,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: navigation.width,
        height: navigation.height,
      },
    });

    this._popupLayer = popupLayer;

    const popupBackground = new LayoutContainer({
      layout: {
        backgroundColor: 0x272736,
        borderColor: 0x57294b,
        borderWidth: 1,
        borderRadius: 5,
        width: 200,
        height: 200,
      },
    });

    popupBackground.filters = [
      new DropShadowFilter({
        color: 0x101019,
        blur: 10,
      }),
    ];

    const buttonContainer = new LayoutContainer({
      layout: {
        gap: 10,
        padding: 10,
        backgroundColor: 0x272736,
        borderColor: 0x57294b,
        borderWidth: 1,
        borderRadius: 3,
        alignItems: 'center',
        height: 32,
      },
    });

    buttonContainer.addChild(new Text({ text: 'Close', style: TEXT_STYLE_DEFAULT, layout: true }));

    const closeButton = new Button(buttonContainer);
    closeButton.enabled = true;

    closeButton.onPress.connect(() => {
      // navigation.dismissPopup();
      console.log('Close button pressed');
    });

    context.navigation.addToLayer(buttonContainer, LAYER_NAMES.UI);

    popupLayer.addChild(popupBackground);

    //layers.popup.addChild(popupLayer);

    console.log('[GameScreen] Prepared');
  }

  /**
   * Show is called when the screen is displayed.
   */
  async show() {
    console.log('[GameScreen] Showing...');
    // The game is already running via systems

    // We just need to display the visuals
    console.log('[GameScreen] Shown');
  }

  /**
   * Update is called every frame.
   * Note: Game logic updates are handled by the SystemRunner in main.ts
   */
  update(_time: Ticker) {
    // Game screen specific updates (UI animations, etc.)
    // The actual game logic is updated by SystemRunner
  }

  /**
   * Resize is called when the screen size changes.
   */
  resize(w: number, h: number) {
    // Fit background to screen
    this._background!.width = w;
    this._background!.height = h;

    this._popupLayer!.layout = {
      width: w,
      height: h,
    };
  }

  /**
   * Called when window loses focus.
   */
  blur() {
    console.log('[GameScreen] Blurring...');
    const context = getGameContext();
    context.phase = 'paused';
  }

  /**
   * Called when window gains focus.
   */
  focus() {
    console.log('[GameScreen] Focusing...');
    const context = getGameContext();
    if (context.phase === 'paused') {
      context.phase = 'level';
    }
  }

  /**
   * Setup event listeners for game UI events.
   */
  private setupEventListeners() {
    const context = getGameContext();

    // Listen for UI notifications (fire and forget)
    context.events.on(GameEvent.GAME_SHOW_MAP, this.handleShowMap.bind(this));
    context.events.on(GameEvent.GAME_OVER_DATA, this.handleShowGameOver.bind(this));
    context.events.on(GameEvent.GAME_QUIT, this.handleQuit.bind(this));
  }

  /**
   * Handle showing the map screen.
   * For now, just auto-select the next level.
   */
  private handleShowMap(data: EventPayload<typeof GameEvent.GAME_SHOW_MAP>) {
    console.log('[GameScreen] Show map requested:', data);

    // TODO: Actually show map screen UI
    // For now, just auto-progress to next level
    setTimeout(() => {
      const context = getGameContext();
      context.events.emit(GameEvent.MAP_LEVEL_SELECTED, { levelId: 'level-1' });
    }, 1000);
  }

  /**
   * Handle showing game over screen.
   */
  private handleShowGameOver(data: EventPayload<typeof GameEvent.GAME_OVER_DATA>) {
    console.log('[GameScreen] Game over:', data);

    // TODO: Show actual game over UI
    // For now, just auto-restart after delay
    setTimeout(() => {
      const context = getGameContext();
      context.events.emit(GameEvent.GAME_OVER_ACTION, 'restart');
    }, 2000);
  }

  /**
   * Handle quit to main menu.
   */
  private handleQuit() {
    console.log('[GameScreen] Quit requested');

    // TODO: Navigate back to main menu
    // navigation.showScreen(MainMenuScreen);
  }

  /**
   * Reset is called when the screen is removed.
   */
  reset() {
    console.log('[GameScreen] Resetting...');

    const context = getGameContext();

    // Clear physics sprite associations (world stays alive)
    const physicsSystem = context.systems.get(PhysicsSystem);
    physicsSystem.clearSprites();
    physicsSystem.cleanupDebugDraw();

    // Destroy containers
    this._gameContainer?.destroy({ children: true });
    this._background?.destroy();
    this._gameContainer = undefined;
    this._background = undefined;

    context.container = null;

    context.events.off(GameEvent.GAME_SHOW_MAP, this.handleShowMap);
    context.events.off(GameEvent.GAME_OVER_DATA, this.handleShowGameOver);
    context.events.off(GameEvent.GAME_QUIT, this.handleQuit);
  }
}
