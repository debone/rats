/**
 * Coroutine Utilities
 *
 * Helpers for working with generator-based coroutines.
 * These make it easier to write sequential async flows.
 */

import type { JSAnimation } from 'animejs';

/**
 * A coroutine is a generator that yields promises and can return a value.
 * The runner awaits each yielded value and sends the result back.
 */
export type Coroutine<TReturn = void> = Generator<Promise<any> | JSAnimation, TReturn, any>;

/**
 * Run a coroutine to completion and return its final value.
 * Each yielded promise is awaited, and its result is sent back into the generator.
 */
export async function runCoroutine<TReturn = void>(coroutine: Coroutine<TReturn>): Promise<TReturn> {
  let result = coroutine.next();

  while (!result.done) {
    try {
      // Await the yielded promise and send the result back
      const value = await result.value;
      result = coroutine.next(value);
    } catch (error) {
      // If the promise rejects, throw into the generator
      result = coroutine.throw(error);
    }
  }

  return result.value;
}

/**
 * Create a delay promise (helper for coroutines)
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
