import { defineEntity, getUnmount, onMount } from '@/core/entity/scope';
import { Command, execute } from '@/core/game/Command';
import { GameEvent } from '@/data/events';
import { getGameContext } from '@/data/game-context';
import { setCurrentLevelId } from '@/data/game-state';
import { Campaign } from '@/gameplay/campaign/Campaign';
import { CAMPAIGN_LEVELS } from '@/gameplay/campaign/campaign-def';
import { useGameEvent } from '@/hooks/hooks';
import { GameScreen } from '@/screens/GameScreen/GameScreen';
import { LoadLevelCommand } from '@/systems/level/commands/LoadLevelCommand';
import { ShowScreenCommand } from '@/systems/navigation/commands/ShowScreenCommand';

export interface GameSceneProps {
  startingLevelId: string;
  onEnd: () => void;
}

export const GameScene = defineEntity(({ startingLevelId, onEnd }: GameSceneProps) => {
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
    execute(RunGameFlowCommand, { startingLevelId });
  });

  return {};
});

// LevelSelectedCommand
export class RunGameFlowCommand extends Command<{ startingLevelId: string }> {
  *execute({ startingLevelId }: { startingLevelId: string }) {
    setCurrentLevelId(startingLevelId);
    yield execute(ShowScreenCommand, { screen: GameScreen });
    Campaign({ levels: CAMPAIGN_LEVELS });
    yield execute(LoadLevelCommand, { levelId: startingLevelId });
  }
}
