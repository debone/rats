import { getEntitiesOfKind } from '@/core/entity/entity';
import { changeCheese, getRunState } from '@/data/game-state';
import { ENTITY_KINDS } from '@/entities/entity-kinds';
import { Cheese } from '@/systems/level/levels/entities/Cheese';
import { b2Body_GetPosition } from 'phaser-box2d';
import type { CrewMemberDef } from './Crew';

export const RatoulieCrewMember: CrewMemberDef = {
  type: 'ratoulie',
  name: 'Ratoulie',
  textureName: 'avatars-new_tile_17#0',
  hiringCost: 10,
  activeAbility: {
    name: 'Drop all boat cheese',
    cost: 1,
    effect: (runState) => {
      const amount = runState.cheeseCounter.get();
      if (amount <= 0) return;
      changeCheese(-amount);
      // Drop cheese at paddle position
      const paddles = getEntitiesOfKind(ENTITY_KINDS.paddle);
      const spawnPos = paddles.length > 0
        ? b2Body_GetPosition(paddles[0].bodyId)
        : { x: 15, y: 35 };
      for (let i = 0; i < amount; i++) {
        Cheese({
          pos: { x: spawnPos.x + (Math.random() - 0.5) * 2, y: spawnPos.y - 1 },
          type: 'yellow',
          onCollected: () => changeCheese(1),
        });
      }
    },
  },
  passiveAbility: {
    name: 'Abilities consume balls',
    mount: (runState) => {
      runState.crewBoons.ratoulie_abilitiesConsumeBalls.set(true);
    },
    unmount: (runState) => {
      runState.crewBoons.ratoulie_abilitiesConsumeBalls.set(false);
    },
  },
};
