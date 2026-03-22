import { ASSETS, type PrototypeTextures } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { createRef } from '@/core/reactivity/refs/ref';
import { Sprite } from 'pixi.js';
import type { LevelSystems } from '../../Level';

export function createTestMountScope() {
  const cleanups: Array<() => void> = [];

  function mountEffect(effect: () => (() => void) | void) {
    const cleanup = effect();
    if (cleanup) cleanups.push(cleanup);
  }

  function unmount() {
    cleanups.forEach((c) => c());
    cleanups.length = 0;
  }

  return { mountEffect, unmount };
}

export interface SmallBrickEntity {
  position: { x: number; y: number };
  onDestroy: () => void;
}

export interface SmallBrickProps {
  systems: LevelSystems;
  mountEffect: (effect: () => (() => void) | void) => void;
  pos: { x: number; y: number };
}

const SmallBrick = ({ systems, pos, mountEffect }: SmallBrickProps) => {
  const bg = typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures;
  const sprite = new Sprite(bg[`bricks_tile_1#0`]);

  mountEffect(() => {
    sprite.anchor.set(0.5, 0.5);
    sprite.position.set(pos.x, pos.y);
    // <sprite/>?
    systems.renderer.add(sprite);
    return () => systems.renderer.remove(sprite);
  });

  return {
    position: pos,
    onDestroy: () => {
      <SmallBrick systems={systems} pos={{ x: pos.x, y: pos.y + 20 }} mountEffect={mountEffect} />;
    },
  };
};

const spawn = () => {};

export const spawnSmallBrick = (systems: LevelSystems, pos: { x: number; y: number }) => {
  const { mountEffect, unmount } = createTestMountScope();
  const smallBrick2 = createRef<SmallBrickEntity>();

  const b = <SmallBrick systems={systems} pos={{ x: 300, y: 500 }} mountEffect={mountEffect} />;
  // How to make this the data def
  // <SmallBrick systems={systems} pos={{ x: 300, y: 520 }} mountEffect={mountEffect} />;
  // And then something like
  // spawn(SmallBrick)

  // akin to React.render?
  // or the <mount> thing

  /*
  do I care? 
  

  */

  setTimeout(() => {
    console.log(smallBrick2._current);
    unmount();
    b.onDestroy();
  }, 1000);

  setTimeout(() => {
    unmount();
  }, 2000);

  return { position: pos };
};
