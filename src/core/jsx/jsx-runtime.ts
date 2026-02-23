import { setupPixiElement } from '@/core/jsx/pixi-jsx';

export type { IntrinsicElementMap } from '@/core/jsx/types';

export function jsx(type: string | Function, props: Record<string, any>): any {
  if (typeof type === 'function') return type(props);
  return setupPixiElement(type, props);
}

export { jsx as jsxs };

export function Fragment({ children }: { children: any[] }): any[] {
  return children;
}
