import type { Container, Ticker } from 'pixi.js';

/** Interface for app screens */
export interface AppScreen extends Container {
  prepare?(): void;
  show?(): Promise<void>;
  hide?(): Promise<void>;
  update?(time: Ticker): void;
  pause?(): Promise<void>;
  resume?(): Promise<void>;
  reset?(): void;
  resize?(width: number, height: number): void;
  blur?(): void;
  focus?(): void;
}

/** Interface for app screens constructors */
export interface AppScreenConstructor {
  readonly SCREEN_ID: string;
  /** List of assets bundles required by the screen */
  readonly assetBundles?: string[];
  new (): AppScreen;
}
