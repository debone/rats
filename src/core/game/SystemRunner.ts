import type { System, SystemClass } from './System';
import type { GameContext } from '@/data/game-context';

/**
 * SystemRunner manages systems and their lifecycle.
 *
 * - Registers/unregisters systems
 * - Provides dynamic scheduling for lifecycle handlers (update, resize, pause, resume)
 *
 */
export class SystemRunner {
  /** A map containing all the systems added */
  private systems = new Map<string, System>();

  /** The game context - set on init */
  private context!: GameContext;

  /** Store the current width */
  private width?: number;

  /** Store the current height */
  private height?: number;

  // Dynamic lifecycle handlers
  private updateHandlers = new Set<(delta: number) => void>();
  private resizeHandlers = new Set<(w: number, h: number) => void>();
  private pauseHandlers = new Set<() => void>();
  private resumeHandlers = new Set<() => void>();

  /**
   * Add a system to the SystemRunner.
   * If context is already set, the system is initialized immediately.
   * @param Class - a class that describes the system to be added.
   * @returns the instance of the system added to the SystemRunner.
   */
  add<S extends System>(Class: SystemClass<S>): S {
    const name = Class.SYSTEM_ID;

    if (!name) {
      throw new Error('[SystemRunner] Cannot add System without SYSTEM_ID');
    }

    // If the system has already been added, return the existing instance
    if (this.systems.has(name)) {
      throw new Error(`[SystemRunner] System ${name} already added, cannot add again`);
      //return this.systems.get(name) as S;
    }

    // Create a new instance of the system
    const system = new Class();

    // Add the system to the map
    this.systems.set(name, system);

    // If context is already set, initialize immediately
    if (this.context) {
      system.init?.(this.context);

      // Apply current resize if known
      if (this.width !== undefined && this.height !== undefined) {
        this.resizeHandlers.forEach((h) => h(this.width!, this.height!));
      }
    }

    return system;
  }

  /**
   * Remove a system from the SystemRunner.
   * Calls destroy on the system.
   * @param Class - a class that describes the system to remove.
   */
  remove<S extends System>(Class: SystemClass<S>): void {
    const name = Class.SYSTEM_ID;
    const system = this.systems.get(name);

    if (!system) return;

    // Call destroy
    system.destroy?.();

    // Remove from map
    this.systems.delete(name);
  }

  /**
   * Get an instance of a system from the SystemRunner.
   * @param Class - a class that describes the system to get.
   * @returns the instance of the system requested.
   */
  get<S extends System>(Class: SystemClass<S>): S {
    const system = this.systems.get(Class.SYSTEM_ID);
    if (!system) {
      throw new Error(`[SystemRunner] System ${Class.SYSTEM_ID} not found`);
    }
    return system as S;
  }

  /**
   * Check if a system has been added.
   * @param Class - a class that describes the system to check.
   * @returns true if the system has been added, false otherwise.
   */
  has<S extends System>(Class: SystemClass<S>): boolean {
    return this.systems.has(Class.SYSTEM_ID);
  }

  /**
   * Initialize all systems.
   * @param context - The game context to pass to systems
   */
  init(context: GameContext) {
    this.context = context;

    // Initialize each system
    this.systems.forEach((system) => {
      system.init?.(context);
    });
  }

  // ============================================
  // Dynamic Scheduling - register/unregister
  // ============================================

  /**
   * Register a handler for a lifecycle phase.
   * Systems call this to self-schedule.
   */
  register(lifecycle: 'update', handler: (delta: number) => void): void;
  register(lifecycle: 'resize', handler: (w: number, h: number) => void): void;
  register(lifecycle: 'pause', handler: () => void): void;
  register(lifecycle: 'resume', handler: () => void): void;
  register(lifecycle: string, handler: Function): void {
    switch (lifecycle) {
      case 'update':
        this.updateHandlers.add(handler as (delta: number) => void);
        break;
      case 'resize':
        this.resizeHandlers.add(handler as (w: number, h: number) => void);
        // Immediately call with current size if known
        if (this.width !== undefined && this.height !== undefined) {
          (handler as (w: number, h: number) => void)(this.width, this.height);
        }
        break;
      case 'pause':
        this.pauseHandlers.add(handler as () => void);
        break;
      case 'resume':
        this.resumeHandlers.add(handler as () => void);
        break;
    }
  }

  /**
   * Unregister a handler from a lifecycle phase.
   */
  unregister(lifecycle: 'update', handler: (delta: number) => void): void;
  unregister(lifecycle: 'resize', handler: (w: number, h: number) => void): void;
  unregister(lifecycle: 'pause', handler: () => void): void;
  unregister(lifecycle: 'resume', handler: () => void): void;
  unregister(lifecycle: string, handler: Function): void {
    switch (lifecycle) {
      case 'update':
        this.updateHandlers.delete(handler as (delta: number) => void);
        break;
      case 'resize':
        this.resizeHandlers.delete(handler as (w: number, h: number) => void);
        break;
      case 'pause':
        this.pauseHandlers.delete(handler as () => void);
        break;
      case 'resume':
        this.resumeHandlers.delete(handler as () => void);
        break;
    }
  }

  // ============================================
  // Lifecycle Execution
  // ============================================

  /**
   * Calls all registered update handlers.
   * @param delta - The time elapsed since the last update (in milliseconds).
   */
  update(delta: number) {
    this.updateHandlers.forEach((handler) => handler(delta));
  }

  /**
   * Calls all registered resize handlers.
   * @param w - The width of the game
   * @param h - The height of the game
   */
  resize(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.resizeHandlers.forEach((handler) => handler(w, h));
  }

  /**
   * Calls all registered pause handlers.
   */
  pause() {
    this.pauseHandlers.forEach((handler) => handler());
  }

  /**
   * Calls all registered resume handlers.
   */
  resume() {
    this.resumeHandlers.forEach((handler) => handler());
  }

  /**
   * Destroys all systems and clears all handlers.
   */
  destroy() {
    // Destroy all systems
    this.systems.forEach((system) => system.destroy?.());

    // Clear everything
    this.systems.clear();
    this.updateHandlers.clear();
    this.resizeHandlers.clear();
    this.pauseHandlers.clear();
    this.resumeHandlers.clear();
  }
}
