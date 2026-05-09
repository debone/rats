import { ASSETS, TILED_MAPS } from '@/assets';
import { attach, defineEntity, getChildrenOf } from '@/core/entity/scope';
import { GameEvent } from '@/data/events';
import { getGameContext } from '@/data/game-context';
import { setLevelState } from '@/data/game-state';
import { Background } from '@/gameplay/entities/Background';
import { BreakoutPhysics } from '@/gameplay/entities/BreakoutPhysics';
import { Brick } from '@/gameplay/entities/Brick';
import { YellowCheese } from '@/gameplay/entities/Cheese';
import { ExitWin } from '@/gameplay/entities/ExitWin';
import { LivesBallRules } from '@/gameplay/entities/LivesBallRules';
import { Scrap } from '@/gameplay/entities/Scrap';
import { StrongBrick } from '@/gameplay/entities/StrongBrick';
import { useLevelOutcome } from '@/gameplay/levels/hooks/useLevelOutcome';
import { useChildren, useSubscribe } from '@/hooks/hooks';
import { t } from '@/i18n/i18n';

export const Level3 = defineEntity(() => {
  const { withChildren } = useChildren();
  const { onWin, onLose, checkLoseCondition } = useLevelOutcome('level-3');

  setLevelState({ id: 'level-3', name: t.dict['level-3.name'] });

  withChildren(() => {
    Background({ tiledMap: TILED_MAPS.backgrounds_level_3, includeBroadBg: true });
    const physics = BreakoutPhysics({ levelId: 'level-3', rubeAsset: ASSETS.levels_level_3_rube });

    LivesBallRules({ onLose, checkLoseCondition });
    ExitWin({ onWin });

    const ctx = getGameContext();

    for (const brick of getChildrenOf(physics, Brick)) {
      attach(brick, (b) => {
        useSubscribe(b.events, 'broken', ({ x, y }) => {
          ctx.events.emit(GameEvent.BRICK_DESTROYED, { brickId: String(b.bodyId), position: { x, y }, score: 100 });
          const r = Math.random();
          if (r < 0.3) YellowCheese({ pos: { x, y } });
          else if (r < 0.5) {
            Scrap({ pos: { x: x - 0.25, y } });
            Scrap({ pos: { x: x + 0.25, y } });
          } else Scrap({ pos: { x, y } });
        });
      });
    }

    for (const brick of getChildrenOf(physics, StrongBrick)) {
      attach(brick, (b) => {
        useSubscribe(b.events, 'broken', ({ x, y }) => {
          ctx.events.emit(GameEvent.BRICK_DESTROYED, { brickId: String(b.bodyId), position: { x, y }, score: 100 });
          if (Math.random() < 0.55) YellowCheese({ pos: { x, y } });
          else {
            Scrap({ pos: { x: x - 0.25, y } });
            Scrap({ pos: { x: x + 0.25, y } });
          }
        });
      });
    }
  });
});
