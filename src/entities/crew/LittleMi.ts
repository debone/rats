import { getEntitiesOfKind } from '@/core/entity/entity';
import { getGameContext } from '@/data/game-context';
import { getRunState } from '@/data/game-state';
import { ENTITY_KINDS } from '@/entities/entity-kinds';
import { PhysicsSystem } from '@/systems/physics/system';
import type { CrewMemberDef } from './Crew';

export const LittleMiCrewMember: CrewMemberDef = {
  type: 'littlemi',
  name: 'Little Mi',
  textureName: 'avatars-new_tile_15#0',
  hiringCost: 10,
  activeAbility: {
    name: 'Everything floats (15s)',
    cost: 1,
    effect: () => {
      const runState = getRunState();
      const physics = getGameContext().systems.get(PhysicsSystem);

      runState.crewBoons.littlemi_everythingFloats.set(true);
      getEntitiesOfKind(ENTITY_KINDS.cheese).forEach((e) => physics.disableGravity(e.bodyId));
      getEntitiesOfKind(ENTITY_KINDS.scrap).forEach((e) => physics.disableGravity(e.bodyId));

      setTimeout(() => {
        runState.crewBoons.littlemi_everythingFloats.set(false);
        getEntitiesOfKind(ENTITY_KINDS.cheese).forEach((e) => physics.enableGravity(e.bodyId));
        getEntitiesOfKind(ENTITY_KINDS.scrap).forEach((e) => physics.enableGravity(e.bodyId));
      }, 15000);
    },
  },
  passiveAbility: {
    name: 'Longer boat',
    mount: (runState) => {
      runState.stats.boatLengthRatio.update((v) => v * 1.4);
    },
    unmount: (runState) => {
      runState.stats.boatLengthRatio.update((v) => v / 1.4);
    },
  },
};
