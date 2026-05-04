import { ASSETS, type PrototypeTextures } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { defineEntity, getUnmount, onCleanup } from '@/core/entity/scope';
import { TiledResource } from '@/core/tiled';
import type { TiledMapDefinition } from '@/core/tiled/tiled-resource';
import { getGameContext } from '@/data/game-context';
import { ENTITY_KINDS, type EntityBase } from '@/entities/entity-kinds';

export interface BackgroundProps {
  tiledMap: TiledMapDefinition;
  includeBroadBg?: boolean;
}

export interface BackgroundEntity extends EntityBase<typeof ENTITY_KINDS.background> {}

export const Background = defineEntity((props: BackgroundProps): BackgroundEntity => {
  const unmount = getUnmount();
  const ctx = getGameContext();

  const bg = typedAssets.get<PrototypeTextures>(ASSETS.levels_level_1).textures;
  const tilesetTextures: Record<string, { textures: typeof bg; tileIdToFrame: (id: number) => string }> = {
    level_1_tileset: {
      textures: bg,
      tileIdToFrame: (id) => `level-1_spritesheet_${id}#0`,
    },
  };

  if (props.includeBroadBg) {
    tilesetTextures.broad_bg = {
      textures: bg,
      tileIdToFrame: (id) => `broad_bg_${id}#0`,
    };
  }

  const map = new TiledResource({ map: props.tiledMap, tilesetTextures });
  map.load();

  const origin = map.getLayer('meta')?.getObjectsByName('origin')[0];
  if (origin) {
    map.container.x = -origin.x;
    map.container.y = -origin.y;
  }
  map.container.zIndex = -1;
  ctx.container!.addChild(map.container);

  onCleanup(() => {
    ctx.container!.removeChild(map.container);
    map.container.destroy({ children: true });
  });

  return {
    kind: ENTITY_KINDS.background,
    destroy() {
      unmount();
    },
  };
});
