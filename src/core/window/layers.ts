import { BACKGROUND_Z_INDEX, DEBUG_Z_INDEX, MIN_HEIGHT, MIN_WIDTH, OVERLAY_Z_INDEX, UI_Z_INDEX } from '@/consts';
import type { GameLayers } from '@/data/game-context';
import { LAYER_ORDER } from '@/data/game-context';
import { LayoutContainer } from '@pixi/layout/components';
import { Container } from 'pixi.js';
import type { LayerName } from './types';
import type { Camera } from '../camera/camera';

/**
 * Create a single layer container
 */
function createLayer(zIndex: number = 0): LayoutContainer {
  return new LayoutContainer({
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
export function createGameLayers(parent: Container, camera: Camera, visibleLayers: LayerName[]): GameLayers {
  const layers: GameLayers = {
    background: createLayer(BACKGROUND_Z_INDEX),
    game: new Container(),
    effects: new Container(),
    ui: createLayer(UI_Z_INDEX),
    overlay: createLayer(OVERLAY_Z_INDEX),
    debug: createLayer(DEBUG_Z_INDEX),
  };

  // Add only the requested layers to parent in z-order
  for (const name of LAYER_ORDER) {
    if (visibleLayers.includes(name)) {
      // Peak game dev code
      if (name === 'game' || name === 'effects') {
        camera.viewport.addChild(layers[name]);
      } else {
        parent.addChild(layers[name]);
      }
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
