const contexts = new Map<string, Record<string, any>>();

export function provideContext<T extends Record<string, any>>(name: string, bag: T): T {
  if (contexts.has(name)) throw new Error(`Context '${name}' already provided`);
  contexts.set(name, bag);
  return bag;
}

export function useContext<T extends Record<string, any>>(name: string): T {
  const ctx = contexts.get(name);
  if (!ctx) throw new Error(`Context '${name}' not found`);
  return ctx as T;
}

export function disposeContext(name: string): void {
  const ctx = contexts.get(name);
  if (!ctx) return;
  for (const value of Object.values(ctx)) {
    if (value && typeof value.dispose === 'function') value.dispose();
  }
  contexts.delete(name);
}
