import { ASSETS, TILED_MAPS } from '@/assets';
import { defineEntity, getUnmount } from '@/core/entity/scope';
import { getGameContext } from '@/data/game-context';
import { GameEvent } from '@/data/events';
import { setLevelState } from '@/data/game-state';
import { ENTITY_KINDS } from '@/entities/entity-kinds';
import { useChildren } from '@/hooks/hooks';
import { t } from '@/i18n/i18n';
import { PhysicsSystem } from '@/systems/physics/system';

import { useLevelOutcome } from '../Level';
import type { BreakoutLevelEntity } from './BreakoutLevel';
import { Background } from './entities/Background';
import { BreakoutPhysics } from './entities/BreakoutPhysics';
import { Brick, type BrickEntity } from './entities/Brick';
import { YellowCheese } from './entities/Cheese';
import { ExitWin } from './entities/ExitWin';
import { LivesBallRules } from './entities/LivesBallRules';
import { Scrap } from './entities/Scrap';
import { StrongBrick, type StrongBrickEntity } from './entities/StrongBrick';

export const Level2 = defineEntity((_: object): BreakoutLevelEntity => {
  const unmount = getUnmount();
  const { withChildren } = useChildren();
  const { onWin, onLose, checkLoseCondition } = useLevelOutcome('level-2');

  setLevelState({ id: 'level-2', name: t.dict['level-2.name'] });

  withChildren(() => {
    Background({ tiledMap: TILED_MAPS.backgrounds_level_2_split, includeBroadBg: true });

    const pg = BreakoutPhysics({ levelId: 'level-2', rubeAsset: ASSETS.levels_level_2_split_rube });

    LivesBallRules({ onLose, checkLoseCondition });
    ExitWin({ onWin });

    const ctx = getGameContext();

    pg.bodies.forEach(({ bodyId, tag }) => {
      if (tag === 'brick') {
        Brick({
          bodyId,
          debrisEmitter: pg.particles.brickDebris,
          onBreak: (brick: BrickEntity) => {
            const { x, y } = brick.spawnPos;
            ctx.events.emit(GameEvent.BRICK_DESTROYED, { brickId: String(brick.bodyId), position: { x, y }, score: 100 });
            const r = Math.random();
            if (r < 0.35) YellowCheese({ pos: { x, y } });
            else if (r < 0.7) { Scrap({ pos: { x: x - 0.25, y } }); Scrap({ pos: { x: x + 0.25, y } }); }
            else Scrap({ pos: { x, y } });
          },
        });
        return;
      }

      if (tag === 'strong-brick') {
        StrongBrick({
          bodyId,
          debrisEmitter: pg.particles.brickDebris,
          initialLife: 2,
          onBreak: (brick: StrongBrickEntity) => {
            const { x, y } = brick.spawnPos;
            ctx.events.emit(GameEvent.BRICK_DESTROYED, { brickId: String(brick.bodyId), position: { x, y }, score: 100 });
            if (Math.random() < 0.55) YellowCheese({ pos: { x, y } });
            else { Scrap({ pos: { x: x - 0.25, y } }); Scrap({ pos: { x: x + 0.25, y } }); }
          },
        });
        return;
      }

      ctx.systems.get(PhysicsSystem).registerOrphanBody(bodyId);
    });
  });

  return {
    kind: ENTITY_KINDS.breakoutLevel,
    destroy() {
      unmount();
    },
  };
});
