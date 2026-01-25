import { BACKGROUND_Z_INDEX, DEBUG_Z_INDEX, MIN_HEIGHT, MIN_WIDTH, OVERLAY_Z_INDEX, UI_Z_INDEX } from '@/consts';
import type { GameLayers } from '@/data/game-context';
import { LAYER_ORDER } from '@/data/game-context';
import { LayoutContainer } from '@pixi/layout/components';
import { Container } from 'pixi.js';
import type { Camera } from '../camera/camera';

/**
 * Create a single layer container
 */
function createLayer(label: string, zIndex: number = 0): LayoutContainer {
  return new LayoutContainer({
    label,
    zIndex,
    layout: {
      width: MIN_WIDTH,
      height: MIN_HEIGHT,
      justifyContent: 'center',
      alignItems: 'center',
    },
    visible: false,
  });
}

/**
 * Create a container
 */
function createContainer(label: string, zIndex: number = 0): Container {
  return new Container({ label, zIndex, visible: false });
}

/**
 * Create all layer containers. Only requested layers are added to the display tree.
 * All layers exist and are accessible, but only visible ones are in the parent.
 */
export function createGameLayers(parent: Container, camera: Camera): GameLayers {
  const layers: GameLayers = {
    background: createLayer('backgroundLayer', BACKGROUND_Z_INDEX),
    game: createContainer('gameLayer'),
    effects: createContainer('effectsLayer'),
    ui: createLayer('uiLayer', UI_Z_INDEX),
    popup: createContainer('popupLayer', UI_Z_INDEX),
    overlay: createLayer('overlayLayer', OVERLAY_Z_INDEX),
    debug: createLayer('debugLayer', DEBUG_Z_INDEX),
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
