export type TransitionHandler<V extends readonly string[]> = () => V[number] | undefined;

/**
 * A simplified state machine
 *
 * @param handlers - a record of handlers for each state
 * @param initial - which state the machine starts
 * @returns
 */
export function state<ValidStates extends readonly string[]>(
  handlers: Record<ValidStates[number], TransitionHandler<ValidStates>>,
  initial: ValidStates[number],
) {
  let nextHandler: ValidStates[number] = initial;
  let finished = false;

  const next = () => {
    const handler = handlers[nextHandler];
    const nextState = handler();

    if (nextState) {
      nextHandler = nextState;
    } else {
      finished = true;
    }
  };

  return {
    next,
    get current() {
      return nextHandler;
    },
    get finished() {
      return finished;
    },
  };
}
