import { type PrototypeTextures, ASSETS } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { assert } from '@/core/common/assert';
import { defineEntity, onCleanup } from '@/core/entity/scope';
import { ObjectLayer, TiledResource, type TiledMapDefinition, type TilesetTextureConfig } from '@/core/tiled';
import { getGameContext } from '@/data/game-context';

export interface BackgroundProps {
  tiledMap: TiledMapDefinition;
  includeBroadBg?: boolean;
}

export const Background = defineEntity(({ tiledMap, includeBroadBg = false }: BackgroundProps) => {
  const ctx = getGameContext();

  const bg = typedAssets.get<PrototypeTextures>(ASSETS.levels_level_1).textures;
  const tilesetTextures: Record<string, TilesetTextureConfig> = {
    level_1_tileset: {
      textures: bg,
      tileIdToFrame: (id) => `level-1_spritesheet_${id}#0`,
    },
  };

  if (includeBroadBg) {
    tilesetTextures.broad_bg = {
      textures: bg,
      tileIdToFrame: (id) => `broad_bg_${id}#0`,
    };
  }

  const map = new TiledResource({ map: tiledMap, tilesetTextures });
  map.load();

  const metaLayer = map.getLayer('meta');
  assert(metaLayer instanceof ObjectLayer, 'Meta layer not found');

  const origin = metaLayer.getObjectsByName('origin')[0];
  assert(origin, 'Origin object not found');

  map.container.x = -origin.x;
  map.container.y = -origin.y;

  map.container.zIndex = -1;
  ctx.container!.addChild(map.container);

  onCleanup(() => {
    ctx.container!.removeChild(map.container);
    map.container.destroy({ children: true });
  });

  return {};
});
