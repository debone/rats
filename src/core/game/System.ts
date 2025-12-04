import type { GameContext } from '@/data/game-context';

/**
 * Define the structure of a system which can be added to the game.
 *
 * Systems are services that provide functionality to the game.
 * They can self-schedule for lifecycle events (update, resize, etc.)
 * and execute commands to drive game flow.
 */
export interface System {
  /**
   * Method called when the system is initialized.
   * Systems should set up their state and register lifecycle handlers here.
   */
  init?(context: GameContext): void;

  /**
   * Method called when the system needs to be destroyed and cleaned up.
   */
  destroy?(): void;
}

/**
 * Define a class that describes a system.
 */
export interface SystemClass<S extends System = System> {
  /** A unique identifier for the system. */
  SYSTEM_ID: string;

  /** A constructor to create an instance of the system. */
  new (): S;
}
