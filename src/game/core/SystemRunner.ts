import type { Game } from './Game';
import type { System, SystemClass } from '../systems/System';

/** A class that manages the systems and calls the appropriate methods on them */
export class SystemRunner {
  /** The instance of the game the system is attached to. */
  private readonly _game: Game;

  /** A map containing all the systems added to the game */
  public readonly allSystems: Map<string, System> = new Map();

  /** Store the current width. */
  private _width?: number;

  /** Store the current height. */
  private _height?: number;

  /**
   * Create a new instance of SystemRunner
   * @param game - the game to associate the SystemRunner with.
   */
  constructor(game: Game) {
    this._game = game;
  }

  /**
   * Add a system to the SystemRunner.
   * @param Class - a class that describes the system to be added.
   * @returns the instance of the system added to the SystemRunner.
   */
  public add<S extends System>(Class: SystemClass<S>): S {
    const name = Class.SYSTEM_ID;

    // Check if the system has a name and throw an error if it doesn't
    if (!name) throw new Error('[SystemRunner]: cannot add System without SYSTEM_ID');

    // If the system has already been added, return the existing instance
    if (this.allSystems.has(name)) {
      return this.allSystems.get(name) as S;
    }

    // Create a new instance of the system
    const system = new Class();

    // Set the game property of the system to the SystemRunner's game
    system.game = this._game;

    // If the width and height of the SystemRunner are already set, call resize on the system
    if (this._width && this._height) system.resize?.(this._width, this._height);

    // Add the system to the SystemRunner's allSystems map
    this.allSystems.set(Class.SYSTEM_ID, system);

    // Return the new instance of the system
    return system;
  }

  /**
   * Get an instance of a system from the SystemRunner.
   * @param Class - a class that describes the system to get.
   * @returns the instance of the system requested.
   */
  public get<S extends System>(Class: SystemClass<S>): S {
    const system = this.allSystems.get(Class.SYSTEM_ID);
    if (!system) {
      throw new Error(`[SystemRunner]: System ${Class.SYSTEM_ID} not found`);
    }
    return system as S;
  }

  /**
   * Check if a system has been added.
   * @param Class - a class that describes the system to check.
   * @returns true if the system has been added, false otherwise.
   */
  public has<S extends System>(Class: SystemClass<S>): boolean {
    return this.allSystems.has(Class.SYSTEM_ID);
  }

  /**
   * Calls the `init` method of all registered systems
   */
  public init() {
    this.allSystems.forEach((system) => system.init?.());
  }

  /**
   * Calls the `awake` method of all registered systems
   */
  public awake() {
    this.allSystems.forEach((system) => system.awake?.());
  }

  /**
   * Calls the `start` method of all registered systems
   */
  public start() {
    this.allSystems.forEach((system) => system.start?.());
  }

  /**
   * Calls the `update` method of all registered systems
   * @param delta - The time elapsed since the last update (in milliseconds).
   */
  public update(delta: number) {
    this.allSystems.forEach((system) => system.update?.(delta));
  }

  /**
   * Calls the `end` method of all registered systems
   */
  public end() {
    this.allSystems.forEach((system) => system.end?.());
  }

  /**
   * Calls the `reset` method of all registered systems
   */
  public reset() {
    this.allSystems.forEach((system) => system.reset?.());
  }

  /**
   * Calls the `resize` method of all registered systems
   * @param w - The width of the game
   * @param h - The height of the game
   */
  public resize(w: number, h: number) {
    this._width = w;
    this._height = h;
    this.allSystems.forEach((system) => system.resize?.(w, h));
  }

  /**
   * Calls the `destroy` method of all registered systems and clears the map
   */
  public destroy() {
    this.allSystems.forEach((system) => system.destroy?.());
    this.allSystems.clear();
  }
}
