import { BACKGROUND_Z_INDEX, DEBUG_Z_INDEX, MIN_HEIGHT, MIN_WIDTH, OVERLAY_Z_INDEX, UI_Z_INDEX } from '@/consts';
import type { GameLayers } from '@/data/game-context';
import { LAYER_ORDER } from '@/data/game-context';
import { LayoutContainer } from '@pixi/layout/components';
import { Container } from 'pixi.js';
import type { Camera } from '../camera/camera';

/**
 * Create a single layer container
 */
function createLayer(zIndex: number = 0, label: string): LayoutContainer {
  return new LayoutContainer({
    label,
    zIndex,
    layout: {
      width: MIN_WIDTH,
      height: MIN_HEIGHT,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
}

/**
 * Create all layer containers. Only requested layers are added to the display tree.
 * All layers exist and are accessible, but only visible ones are in the parent.
 */
export function createGameLayers(parent: Container, camera: Camera): GameLayers {
  const layers: GameLayers = {
    background: createLayer(BACKGROUND_Z_INDEX, 'backgroundLayer'),
    game: new Container({ label: 'gameLayer' }),
    effects: new Container({ label: 'effectsLayer' }),
    ui: createLayer(UI_Z_INDEX, 'uiLayer'),
    popup: new Container({ label: 'popupLayer', zIndex: UI_Z_INDEX }),
    overlay: createLayer(OVERLAY_Z_INDEX, 'overlayLayer'),
    debug: createLayer(DEBUG_Z_INDEX, 'debugLayer'),
  };

  // Add only the requested layers to parent in z-order
  for (const name of LAYER_ORDER) {
    // Peak game dev code
    if (name === 'game' || name === 'effects') {
      camera.viewport.addChild(layers[name]);
    } else {
      parent.addChild(layers[name]);
    }
  }

  return layers;
}

/**
 * Destroy all layers and remove from parent
 */
export function destroyGameLayers(layers: GameLayers): void {
  for (const name of LAYER_ORDER) {
    layers[name].destroy({ children: true });
  }
}
