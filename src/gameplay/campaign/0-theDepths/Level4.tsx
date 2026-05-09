import { ASSETS, TILED_MAPS } from '@/assets';
import { attach, defineEntity, getChildrenOf } from '@/core/entity/scope';
import { getGameContext } from '@/data/game-context';
import { setLevelState } from '@/data/game-state';
import { Background } from '@/gameplay/entities/Background';
import { BreakoutPhysics } from '@/gameplay/entities/BreakoutPhysics';
import { Brick } from '@/gameplay/entities/Brick';
import { BlueCheese, GreenCheese, YellowCheese } from '@/gameplay/entities/Cheese';
import { CatPiece } from '@/gameplay/entities/cats/CatBody';
import { CatTail } from '@/gameplay/entities/cats/CatTail';
import { Door } from '@/gameplay/entities/Door';
import { ExitWin } from '@/gameplay/entities/ExitWin';
import { LivesBallRules } from '@/gameplay/entities/LivesBallRules';
import { Scrap } from '@/gameplay/entities/Scrap';
import { StrongBrick } from '@/gameplay/entities/StrongBrick';
import { useLevelOutcome } from '@/gameplay/levels/hooks/useLevelOutcome';
import { PhysicsSystem } from '@/systems/physics/system';
import { useChildren, useSubscribe } from '@/hooks/hooks';
import { t } from '@/i18n/i18n';

export const Level4 = defineEntity(() => {
  const { withChildren } = useChildren();
  const { onWin, onLose, checkLoseCondition } = useLevelOutcome('level-4');

  setLevelState({ id: 'level-4', name: t.dict['level-4.name'] });

  withChildren(() => {
    Background({ tiledMap: TILED_MAPS.backgrounds_level_4 });
    const physics = BreakoutPhysics({ levelId: 'level-4', rubeAsset: ASSETS.levels_level_4_rube });

    LivesBallRules({ onLose, checkLoseCondition });
    ExitWin({ onWin });

    const [door] = getChildrenOf(physics, Door);
    let bricksRemaining = 0;

    const openDoorWhenFewLeft = () => {
      bricksRemaining--;
      if (bricksRemaining <= 5) door?.open();
    };

    for (const brick of getChildrenOf(physics, Brick)) {
      bricksRemaining++;
      attach(brick, (b) => {
        useSubscribe(b.events, 'broken', ({ x, y, powerUp }) => {
          if (powerUp === 'blue') BlueCheese({ pos: { x, y } });
          else if (powerUp === 'green') GreenCheese({ pos: { x, y } });
          else if (powerUp === 'yellow') YellowCheese({ pos: { x, y } });
          else {
            const r = Math.random();
            if (r < 0.2) YellowCheese({ pos: { x, y } });
            else if (r < 0.5) {
              Scrap({ pos: { x: x - 0.25, y } });
              Scrap({ pos: { x: x + 0.25, y } });
            } else Scrap({ pos: { x, y } });
          }
          openDoorWhenFewLeft();
        });
      });
    }

    for (const brick of getChildrenOf(physics, StrongBrick)) {
      bricksRemaining++;
      attach(brick, (b) => {
        useSubscribe(b.events, 'broken', ({ x, y }) => {
          if (Math.random() < 0.55) YellowCheese({ pos: { x, y } });
          else {
            Scrap({ pos: { x: x - 0.25, y } });
            Scrap({ pos: { x: x + 0.25, y } });
          }
          openDoorWhenFewLeft();
        });
      });
    }

    const ctx = getGameContext();
    for (const { bodyId, tag } of physics.bodies) {
      if (tag === 'cat-piece') CatTail({ bodyId, texture: 'cat-tail#0' });
      else if (tag === 'cat-body') CatPiece({ bodyId, texture: 'cat-body#0' });
      else ctx.systems.get(PhysicsSystem).registerOrphanBody(bodyId);
    }
  });
});
