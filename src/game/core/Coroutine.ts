/**
 * Coroutine Utilities
 *
 * Helpers for working with async generator-based coroutines.
 * These make it easier to write sequential async flows without complex typing.
 */

/**
 * A coroutine is an async generator that yields promises and receives their resolved values.
 * Using a type alias keeps the complex generics out of our code.
 */
export type Coroutine = AsyncGenerator<Promise<any>, void, any>;

/**
 * Run a coroutine to completion.
 * Each yielded promise is awaited, and its result is sent back into the generator.
 */
export async function runCoroutine(coroutine: Coroutine): Promise<void> {
  try {
    let result = await coroutine.next();

    while (!result.done) {
      // Await the yielded promise
      const value = await result.value;

      // Send the resolved value back to the generator
      result = await coroutine.next(value);
    }
  } catch (error) {
    console.error('[Coroutine] Error:', error);
    throw error;
  }
}

/**
 * Create a delay promise (helper for coroutines)
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Example usage:
 *
 * ```typescript
 * private async *myFlow(): Coroutine {
 *   // Wait 500ms
 *   yield delay(500);
 *
 *   // Wait for an event
 *   const selection: MapSelection = yield this.events.wait('map:selected');
 *
 *   // Do something with selection
 *   console.log(selection);
 * }
 *
 * // Run it
 * await runCoroutine(this.myFlow());
 * ```
 */
