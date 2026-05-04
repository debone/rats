import { ASSETS, TILED_MAPS } from '@/assets';
import { defineEntity, getUnmount } from '@/core/entity/scope';
import { getGameContext } from '@/data/game-context';
import { GameEvent } from '@/data/events';
import { setLevelState } from '@/data/game-state';
import { ENTITY_KINDS } from '@/entities/entity-kinds';
import { useChildren } from '@/hooks/hooks';
import { t } from '@/i18n/i18n';
import { PhysicsSystem } from '@/systems/physics/system';
import { b2Body_GetPosition } from 'phaser-box2d';

import { useLevelOutcome } from '../Level';
import type { BreakoutLevelEntity } from './BreakoutLevel';
import { Background } from './entities/Background';
import { BreakoutPhysics } from './entities/BreakoutPhysics';
import { Brick, type BrickEntity } from './entities/Brick';
import { YellowCheese } from './entities/Cheese';
import { Door } from './entities/Door';
import { ExitWin } from './entities/ExitWin';
import { LivesBallRules } from './entities/LivesBallRules';
import { Scrap } from './entities/Scrap';
import { StrongBrick, type StrongBrickEntity } from './entities/StrongBrick';

export const Level3 = defineEntity((_: object): BreakoutLevelEntity => {
  const unmount = getUnmount();
  const { withChildren } = useChildren();
  const { onWin, onLose, checkLoseCondition } = useLevelOutcome('level-3');

  setLevelState({ id: 'level-3', name: t.dict['level-3.name'] });

  withChildren(() => {
    Background({ tiledMap: TILED_MAPS.backgrounds_level_3, includeBroadBg: true });

    const pg = BreakoutPhysics({ levelId: 'level-3', rubeAsset: ASSETS.levels_level_3_rube });

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
            if (r < 0.3) YellowCheese({ pos: { x, y } });
            else if (r < 0.5) { Scrap({ pos: { x: x - 0.25, y } }); Scrap({ pos: { x: x + 0.25, y } }); }
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

      if (tag === 'door') {
        const pos = b2Body_GetPosition(bodyId);
        ctx.systems.get(PhysicsSystem).queueDestruction(bodyId);
        Door({ spawnPos: { x: pos.x, y: pos.y }, length: 1 });
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
