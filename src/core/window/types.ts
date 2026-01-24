import type { Container, Ticker } from 'pixi.js';

/** Available layer names for screens */
export type LayerName = 'background' | 'game' | 'effects' | 'ui' | 'popup' | 'overlay' | 'debug';

/** Interface for app screens */
export interface AppScreen extends Container {
  /** Called after layers are created, before show */
  prepare?(): void;
  /** Animate screen in */
  show?(): Promise<void>;
  /** Animate screen out */
  hide?(): Promise<void>;
  /** Per-frame update */
  update?(time: Ticker): void;
  /** Clean up when screen is removed */
  reset?(): void;
  /** Handle viewport resize */
  resize?(width: number, height: number): void;
  /** Called when window loses focus */
  blur?(): void;
  /** Called when window gains focus */
  focus?(): void;
}

/** Interface for app screens constructors */
export interface AppScreenConstructor {
  readonly SCREEN_ID: string;
  /** List of assets bundles required by the screen */
  readonly assetBundles?: string[];

  new (): AppScreen;
}
