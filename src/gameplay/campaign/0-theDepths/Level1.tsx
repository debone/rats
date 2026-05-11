import { ASSETS, TILED_MAPS } from '@/assets';
import { attach, defineEntity, getChildrenOf } from '@/core/entity/scope';
import { setLevelState } from '@/data/game-state';
import { Background } from '@/gameplay/entities/Background';
import { BreakoutPhysics } from '@/gameplay/entities/BreakoutPhysics';
import { Brick } from '@/gameplay/entities/Brick';
import { BlueCheese, GreenCheese, YellowCheese } from '@/gameplay/entities/Cheese';
import { CrewAbilities } from '@/gameplay/entities/CrewAbilities';
import { Door } from '@/gameplay/entities/Door';
import { PaddleAndBall } from '@/gameplay/entities/PaddleBall';
import { Scrap } from '@/gameplay/entities/Scrap';
import { useChildren, useSubscribe } from '@/hooks/hooks';
import { t } from '@/i18n/i18n';

export const Level1 = defineEntity(() => {
  const { withChildren } = useChildren();

  setLevelState({ id: 'level-1', name: t.dict['level-1.name'] });

  withChildren(() => {
    Background({ tiledMap: TILED_MAPS.backgrounds_level_1 });

    const physics = BreakoutPhysics({ levelId: 'level-1', rubeAsset: ASSETS.level_1_rube });

    withChildren(() => CrewAbilities());

    const paddleBall = withChildren(() => PaddleAndBall({ levelId: 'level-1', paddleJoint: physics.paddleJoint }));

    paddleBall.createBall();

    const bricks = getChildrenOf(physics, Brick);
    const [door] = getChildrenOf(physics, Door);

    let remaining = bricks.length;

    for (const brick of bricks) {
      attach(brick, (b) => {
        useSubscribe(b.events, 'broken', ({ x, y, powerUp }) => {
          if (powerUp === 'blue') {
            BlueCheese({ pos: { x, y } });
          } else if (powerUp === 'green') {
            GreenCheese({ pos: { x, y } });
          } else if (powerUp === 'yellow') {
            YellowCheese({ pos: { x, y } });
          } else {
            const r = Math.random();
            if (r < 0.2) {
              YellowCheese({ pos: { x, y } });
            } else if (r < 0.5) {
              Scrap({ pos: { x: x - 0.25, y } });
              Scrap({ pos: { x: x + 0.25, y } });
            } else {
              Scrap({ pos: { x, y } });
            }
          }

          remaining--;
          if (remaining <= 48 && door?.closed) {
            door?.open();
          }
        });
      });
    }
  });
});
