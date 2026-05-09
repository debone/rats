import { ASSETS, TILED_MAPS } from '@/assets';
import { attach, defineEntity, getChildrenOf } from '@/core/entity/scope';
import { setLevelState } from '@/data/game-state';
import { Background } from '@/gameplay/entities/Background';
import { BreakoutPhysics } from '@/gameplay/entities/BreakoutPhysics';
import { Brick } from '@/gameplay/entities/Brick';
import { BlueCheese, GreenCheese, YellowCheese } from '@/gameplay/entities/Cheese';
import { Door } from '@/gameplay/entities/Door';
import { ExitWin } from '@/gameplay/entities/ExitWin';
import { InfiniteBallRules } from '@/gameplay/entities/InfiniteBallRules';
import { Scrap } from '@/gameplay/entities/Scrap';
import { useLevelOutcome } from '@/gameplay/levels/hooks/useLevelOutcome';
import { useChildren, useSubscribe } from '@/hooks/hooks';
import { t } from '@/i18n/i18n';

export const Level0 = defineEntity(() => {
  const { withChildren } = useChildren();
  const { onWin } = useLevelOutcome('level-0');

  setLevelState({ id: 'level-0', name: t.dict['level-0.name'] });

  withChildren(() => {
    Background({ tiledMap: TILED_MAPS.backgrounds_level_0 });
    const physics = BreakoutPhysics({ levelId: 'level-0', rubeAsset: ASSETS.levels_level_0_rube });

    InfiniteBallRules();
    ExitWin({ onWin });

    const bricks = getChildrenOf(physics, Brick);
    const doors = getChildrenOf(physics, Door);

    const doorA = doors.find((d) => d.name === 'door-a');
    const doorB = doors.find((d) => d.name === 'door-b');
    const doorC = doors.find((d) => d.name === 'door-c');

    if (doorB) doorB.openingDirection = 'right';

    let doorBCheeseLeft = 5;

    for (const brick of bricks) {
      attach(brick, (b) => {
        useSubscribe(b.events, 'broken', ({ x, y, powerUp }) => {
          if (powerUp === 'blue') {
            BlueCheese({ pos: { x, y }, onCollected: () => doorA?.open() });
          } else if (powerUp === 'green') {
            GreenCheese({ pos: { x, y }, onCollected: () => doorC?.open() });
          } else if (powerUp === 'yellow') {
            YellowCheese({
              pos: { x, y },
              onCollected: () => {
                doorBCheeseLeft--;
                if (doorBCheeseLeft === 0) doorB?.open();
              },
            });
          } else {
            Scrap({ pos: { x: x - 0.25, y } });
            Scrap({ pos: { x: x + 0.25, y } });
          }
        });
      });
    }
  });
});
