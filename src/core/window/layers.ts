import { MIN_HEIGHT, MIN_WIDTH } from '@/consts';
import type { GameLayers } from '@/data/game-context';
import { LAYER_ORDER } from '@/data/game-context';
import { LayoutContainer } from '@pixi/layout/components';
import type { Container } from 'pixi.js';
import type { LayerName } from './types';

/**
 * Create a single layer container
 */
function createLayer(): LayoutContainer {
  return new LayoutContainer({
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
export function createGameLayers(parent: Container, visibleLayers: LayerName[]): GameLayers {
  const layers: GameLayers = {
    background: createLayer(),
    game: createLayer(),
    effects: createLayer(),
    ui: createLayer(),
    debug: createLayer(),
  };

  // Add only the requested layers to parent in z-order
  for (const name of LAYER_ORDER) {
    if (visibleLayers.includes(name)) {
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
