import { TILED_MAPS } from '@/assets';
import { attach, defineEntity, getChildrenOf } from '@/core/entity/scope';
import { setLevelState } from '@/data/game-state';
import { Background } from '@/gameplay/entities/Background';
import { BreakoutPhysics } from '@/gameplay/entities/BreakoutPhysics';
import { Brick, type BrickEntity } from '@/gameplay/entities/bricks/Brick';
import { BlueCheese, GreenCheese, YellowCheese } from '@/gameplay/entities/Cheese';
import { CrewAbilities } from '@/gameplay/entities/CrewAbilities';
import { Door } from '@/gameplay/entities/Door';
import { PaddleAndBall } from '@/gameplay/entities/PaddleBall';
import { ExitWin } from '@/gameplay/entities/rules/ExitWin';
import { InfiniteBallRules } from '@/gameplay/entities/rules/InfiniteBallsRule';
import { Scrap } from '@/gameplay/entities/Scrap';
import { useLevelOutcome } from '@/gameplay/levels/hooks/useLevelOutcome';
import { useChildren, useSubscribe } from '@/hooks/hooks';
import { t } from '@/i18n/i18n';
import { b2Vec2 } from 'phaser-box2d';

export const Level0 = defineEntity(() => {
  const { withChildren } = useChildren();

  const { onWin } = useLevelOutcome('level-0');
  setLevelState({ id: 'level-0', name: t.dict['level-0.name'] });

  withChildren(() => {
    Background({ tiledMap: TILED_MAPS.backgrounds_level_0 });

    InfiniteBallRules();
    ExitWin({
      onWin,
    });

    CrewAbilities();

    const physics = BreakoutPhysics({ levelId: 'level-0', geometryAsset: 'geometry/level-0.json' });

    const paddleBall = PaddleAndBall({ levelId: 'level-0', paddleJoint: physics.paddleJoint });

    paddleBall.createBall();

    const bricks = getChildrenOf(physics, Brick);
    const doors = getChildrenOf(physics, Door);

    const doorA = doors.find((door) => door.name === 'door-a')!;
    doorA.setLength(2);
    const doorB = doors.find((door) => door.name === 'door-b')!;
    doorB.setLength(2);
    doorB.openingDirection = 'right';
    const doorC = doors.find((door) => door.name === 'door-c')!;
    doorC.setLength(2);

    let doorBCheeseLeft = 5;

    const handleBrick = (brick: BrickEntity) => {
      attach(brick, (b) => {
        useSubscribe(b.events, 'broken', ({ x, y, powerUp }) => {
          if (powerUp === 'blue') {
            BlueCheese({
              pos: new b2Vec2(x, y),
              onCollected: () => {
                doorA.open();
              },
              onLost: () => handleBrick(brick.unbreak()),
            });
          } else if (powerUp === 'green') {
            GreenCheese({
              pos: new b2Vec2(x, y),
              onCollected: () => doorC.open(),
              onLost: () => handleBrick(brick.unbreak()),
            });
          } else if (powerUp === 'yellow') {
            YellowCheese({
              pos: new b2Vec2(x, y),
              onCollected: () => {
                doorBCheeseLeft--;
                if (doorBCheeseLeft === 0) doorB.open();
              },
              onLost: () => handleBrick(brick.unbreak()),
            });
          } else {
            Scrap({ pos: { x: x - 0.25, y } });
            Scrap({ pos: { x: x + 0.25, y } });
          }
        });
      });
    };

    for (const brick of bricks) {
      handleBrick(brick);
    }
  });
});
