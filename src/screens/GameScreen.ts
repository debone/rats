import { MIN_HEIGHT, MIN_WIDTH } from '@/consts';
import type { AppScreen } from '@/core/window/types';
import { LayoutContainer } from '@pixi/layout/components';
import { Assets, Container, Ticker, TilingSprite } from 'pixi.js';
import { getGameContext } from '@/data/game-context';
import { GameEvent, type EventPayload } from '@/data/events';
import { PhysicsSystem } from '@/systems/physics/system';

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

  private readonly _background: TilingSprite;
  private readonly _gameContainer: LayoutContainer;

  constructor() {
    super();

    this.layout = {
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'column',
    };

    // Tiling background
    const tilingSprite = new TilingSprite({
      texture: Assets.get('tiles').textures.grid,
      width: 64,
      height: 64,
    });
    this._background = tilingSprite;
    this.addChild(this._background);

    // Game container (black box for the game area)
    const gameContainer = new LayoutContainer({
      layout: {
        width: MIN_WIDTH,
        height: MIN_HEIGHT,
        justifyContent: 'center',
        backgroundColor: 'black',
        alignItems: 'center',
      },
    });
    this._gameContainer = gameContainer;
    this.addChild(gameContainer);

    const context = getGameContext();
    const physicsSystem = context.systems.get(PhysicsSystem);
    physicsSystem.setupDebugDraw(gameContainer);
  }

  /**
   * Prepare is called before show.
   * Set up the game container reference in context.
   */
  async prepare() {
    console.log('[GameScreen] Preparing...');

    // Set the container on the context so systems can use it
    const context = getGameContext();
    context.container = this._gameContainer;

    // Setup event listeners for UI events
    this.setupEventListeners();

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
    this._background.width = w;
    this._background.height = h;
  }

  /**
   * Pause is called when the screen loses focus.
   */
  async pause() {
    console.log('[GameScreen] Pausing...');
    const context = getGameContext();
    context.phase = 'paused';
  }

  /**
   * Resume is called when the screen regains focus.
   */
  async resume() {
    console.log('[GameScreen] Resuming...');
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

    // Clear container reference
    const context = getGameContext();
    context.container = null;

    context.events.off(GameEvent.GAME_SHOW_MAP, this.handleShowMap);
    context.events.off(GameEvent.GAME_OVER_DATA, this.handleShowGameOver);
    context.events.off(GameEvent.GAME_QUIT, this.handleQuit);
  }
}
