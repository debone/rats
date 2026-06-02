import type { Container, Ticker } from 'pixi.js';

export const LAYER_NAMES = {
  BACKGROUND: 'background',
  GAME: 'game',
  EFFECTS: 'effects',
  UI: 'ui',
  POPUP: 'popup',
  OVERLAY: 'overlay',
  DEBUG: 'debug',
} as const;

/** Available layer names for screens */
export type LayerName = (typeof LAYER_NAMES)[keyof typeof LAYER_NAMES];

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
  /** Pause gameplay under this screen (overlay, window blur, etc.) */
  pause?(): void | Promise<void>;
  /** Resume after {@link pause} */
  resume?(): void | Promise<void>;
}

/** Interface for app screens constructors */
export interface AppScreenConstructor {
  readonly SCREEN_ID: string;
  /** List of assets bundles required by the screen */
  readonly assetBundles?: string[];

  new (): AppScreen;
}
