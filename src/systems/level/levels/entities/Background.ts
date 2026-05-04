import { ASSETS, type PrototypeTextures } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { defineEntity, onCleanup } from '@/core/entity/scope';
import { TiledResource } from '@/core/tiled';
import type { TiledMapDefinition } from '@/core/tiled/tiled-resource';
import { getGameContext } from '@/data/game-context';

export interface BackgroundProps {
  tiledMap: TiledMapDefinition;
  includeBroadBg?: boolean;
}

export const Background = defineEntity((props: BackgroundProps) => {
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

  return {};
});

export type BackgroundEntity = ReturnType<typeof Background>;
