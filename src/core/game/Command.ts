/**
 * Command Pattern
 *
 * Commands are explicit, executable units of work that operate on the game context.
 * Unlike events (fire-and-forget notifications), commands are the control flow mechanism.
 *
 * Each command is a class extending the base Command class.
 */

import { getGameContext } from '@/data/game-context';
import { runCoroutine, type Coroutine } from './Coroutine';
import type { GameContext } from '@/data/game-context';

/**
 * Base class for all commands.
 * Extend this class to create a new command.
 *
 * @example
 * export class LoadLevelCommand extends Command<{ levelId: string }> {
 *   *execute({ levelId }) {
 *     const levelSystem = this.context.systems.get(LevelSystem);
 *     yield* levelSystem.loadLevel(levelId);
 *   }
 * }
 */
export abstract class Command<TPayload = void, TReturn = void> {
  /** The game context - injected before execution */
  protected context!: GameContext;

  /**
   * Execute the command logic.
   * Override this method in subclasses.
   */
  abstract execute(payload: TPayload): Coroutine<TReturn>;

  // ============================================
  // Future Hooks (for subclasses to override)
  // ============================================

  // protected onBefore?(payload: TPayload): void | Promise<void>;
  // protected onAfter?(result: TReturn): void | Promise<void>;
  // protected onError?(error: Error): void | Promise<void>;
}

/** Constructor type for Command classes */
export interface CommandClass<TPayload = void, TReturn = void> {
  new (): Command<TPayload, TReturn>;
}

/** Cache of command instances (singleton per class) */
const commandInstances = new Map<CommandClass<any, any>, Command<any, any>>();

/**
 * Get or create a command instance.
 */
function getCommandInstance<TPayload, TReturn>(
  CommandClass: CommandClass<TPayload, TReturn>,
): Command<TPayload, TReturn> {
  let instance = commandInstances.get(CommandClass);
  if (!instance) {
    instance = new CommandClass();
    commandInstances.set(CommandClass, instance);
  }
  return instance as Command<TPayload, TReturn>;
}

/**
 * Execute a command. Context is injected automatically.
 *
 * @param CommandClass - The command class to execute
 * @param args - The payload to pass to the command (if any)
 * @returns The value returned by the command
 *
 * @example
 * // Command with no payload
 * await execute(PauseGameCommand);
 *
 * // Command with payload
 * await execute(LoadLevelCommand, { levelId: 'level-1' });
 *
 * // Command with return value
 * const ball = await execute(SpawnBallCommand, { x: 100, y: 200 });
 */
export async function execute<TPayload = void, TReturn = void>(
  CommandClass: CommandClass<TPayload, TReturn>,
  ...args: TPayload extends void ? [] : [TPayload]
): Promise<TReturn> {
  const context = getGameContext();
  const payload = args[0] as TPayload;

  const command = getCommandInstance(CommandClass);
  command['context'] = context;

  console.log('[Command][execute] Executing command', CommandClass.name, payload);

  return runCoroutine(command.execute(payload));
}
