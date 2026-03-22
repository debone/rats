export function state(
  handlers: Record<string, (transition: (to: string) => void) => (() => void) | void>,
  initial: string,
) {
  let cleanup: (() => void) | void;

  const transition = (to: string) => {
    cleanup?.();
    cleanup = handlers[to]?.(transition);
  };

  transition(initial);
  return () => cleanup?.();
}
