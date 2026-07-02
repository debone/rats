import { defineEntity, getUnmount, onMount } from '@/core/entity/scope';
import { GameEvent } from '@/data/events';
import { getGameContext } from '@/data/game-context';
import { onboardCrewMember } from '@/data/game-state';
import { Campaign } from '@/gameplay/campaign/Campaign';
import { CAMPAIGN_LEVELS } from '@/gameplay/campaign/campaign-def';
import { useGameEvent } from '@/hooks/hooks';
import { KeyListener } from '@/systems/keyboard/KeyListener';

export interface GameSceneProps {
  onEnd: () => void;
}

export const GameScene = defineEntity(({ onEnd }: GameSceneProps) => {
  const destroy = getUnmount();

  useGameEvent(GameEvent.GAME_OVER_ACTION, (action) => {
    destroy();

    if (action === 'restart') {
      onEnd();
    } else {
      getGameContext().events.emit(GameEvent.GAME_QUIT);
    }
  });

  onMount(() => {
    onboardCrewMember('nuggets', 'first');
    Campaign({ levels: CAMPAIGN_LEVELS });
  });

  KeyListener({ key: 'KeyG', onPress: () => getGameContext().events.emit(GameEvent.BALL_EXITED) });

  return {};
});
