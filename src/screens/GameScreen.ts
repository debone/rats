import { MIN_HEIGHT, MIN_WIDTH } from '@/consts';
import type { AppScreen } from '@/core/window/types';
import { LayoutContainer } from '@pixi/layout/components';
import { Assets, Container, Ticker, TilingSprite } from 'pixi.js';
import { Game } from '@/game/core/Game';
import { SaveSystem } from '@/game/systems/SaveSystem';
import { GameEvent, type EventPayload } from '@/data/events';

export class GameScreen extends Container implements AppScreen {
  static readonly SCREEN_ID = 'game';
  static readonly assetBundles = ['preload', 'default'];

  private readonly _background: TilingSprite;
  private readonly _gameContainer: LayoutContainer;

  /** The game instance - public so levels can access it */
  public game!: Game;

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
  }

  /**
   * Prepare is called before show
   * Initialize the game here
   */
  async prepare() {
    console.log('[GameScreen] Preparing...');

    // Create game instance
    this.game = new Game(this, this._gameContainer);

    // Initialize game (load systems, meta state)
    await this.game.init();

    // Setup event listeners for game events
    this.setupEventListeners();

    console.log('[GameScreen] Prepared');
  }

  /**
   * Show is called when the screen is displayed
   * Start or resume the game here
   */
  async show() {
    console.log('[GameScreen] Showing...');

    // Check if there's a saved run to resume
    const saveSystem = this.game.context.systems.get(SaveSystem);
    const savedRun = await saveSystem.loadRun();

    if (savedRun) {
      // Resume existing run
      console.log('[GameScreen] Resuming saved game');
      await this.game.resumeRun();
    } else {
      // Start new run
      console.log('[GameScreen] Starting new game');
      await this.game.startNewRun('level-1');
    }

    console.log('[GameScreen] Shown');
  }

  /**
   * Update is called every frame
   */
  update(time: Ticker) {
    this.game.update(time.deltaMS);
  }

  /**
   * Resize is called when the screen size changes
   */
  resize(w: number, h: number) {
    // Fit background to screen
    this._background.width = w;
    this._background.height = h;

    // Resize game
    this.game.resize(w, h);
  }

  /**
   * Pause is called when the screen loses focus
   */
  async pause() {
    console.log('[GameScreen] Pausing...');
    this.game.pause();
  }

  /**
   * Resume is called when the screen regains focus
   */
  async resume() {
    console.log('[GameScreen] Resuming...');
    this.game.resume();
  }

  /**
   * Setup event listeners for game events
   */
  private setupEventListeners() {
    const { events } = this.game.context;

    // Listen for map screen request
    events.on(GameEvent.GAME_SHOW_MAP, (data) => {
      this.handleShowMap(data);
    });

    // Listen for game over
    events.on(GameEvent.GAME_SHOW_GAME_OVER, (data) => {
      this.handleShowGameOver(data);
    });

    // Listen for quit request
    events.on(GameEvent.GAME_QUIT, () => {
      this.handleQuit();
    });
  }

  /**
   * Handle showing the map screen
   * For now, just auto-select the next level
   */
  private handleShowMap(data: EventPayload<typeof GameEvent.GAME_SHOW_MAP>) {
    console.log('[GameScreen] Show map requested:', data);

    // TODO: Actually show map screen UI
    // For now, just auto-progress to next level
    setTimeout(() => {
      // Auto-select level-1 (for testing)
      this.game.context.events.emit(GameEvent.MAP_LEVEL_SELECTED, { levelId: 'level-1' });
    }, 1000);
  }

  /**
   * Handle showing game over screen
   */
  private handleShowGameOver(data: EventPayload<typeof GameEvent.GAME_SHOW_GAME_OVER>) {
    console.log('[GameScreen] Game over:', data);

    // TODO: Show actual game over UI
    // For now, just auto-restart after delay
    setTimeout(() => {
      this.game.context.events.emit(GameEvent.GAME_OVER_ACTION, 'restart');
    }, 2000);
  }

  /**
   * Handle quit to main menu
   */
  private handleQuit() {
    console.log('[GameScreen] Quit requested');

    // TODO: Navigate back to main menu
    // navigation.showScreen(MainMenuScreen);
  }

  /**
   * Reset is called when the screen is removed
   */
  reset() {
    console.log('[GameScreen] Resetting...');

    if (this.game) {
      this.game.destroy();
    }
  }
}
