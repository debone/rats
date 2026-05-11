import { defineEntity } from '@/core/entity/scope';
import { activateCrewAbility } from '@/data/game-state';
import { useChildren } from '@/hooks/hooks';
import { KeyListener } from '@/systems/keyboard/KeyListener';

export const CrewAbilities = defineEntity(() => {
  const { withChildren } = useChildren();

  withChildren(() => {
    KeyListener({ key: 'KeyQ', onPress: () => activateCrewAbility(0) });
    KeyListener({ key: 'KeyW', onPress: () => activateCrewAbility(1) });
  });
});
