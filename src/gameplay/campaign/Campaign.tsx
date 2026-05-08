import { defineEntity, getUnmount } from '@/core/entity/scope';
import { addCompletedLevel } from '@/data/game-state';
import { useGameEvent } from '@/hooks/hooks';
import { execute } from '@/core/game/Command';
import { GameEvent } from '@/data/events';
import { GameOverCommand } from '@/gameplay/levels/commands/GameOverCommand';
import { LevelTransitionCommand } from '@/gameplay/levels/commands/LevelTransitionCommand';

export interface CampaignProps {
  levels: string[];
}

export const Campaign = defineEntity(({ levels }: CampaignProps) => {
  const destroy = getUnmount();

  useGameEvent(GameEvent.CAMPAIGN_LEVEL_WON, ({ levelId }) => {
    addCompletedLevel(levelId);

    if (levels.indexOf(levelId) === levels.length - 1) {
      // TODO: show campaign complete screen
      throw new Error('Campaign completed');
    }

    const nextLevelId = levels[levels.indexOf(levelId) + 1];

    if (!nextLevelId) {
      execute(GameOverCommand);
      destroy();
      return;
    }

    execute(LevelTransitionCommand, { nextLevelId });
  });

  useGameEvent(GameEvent.CAMPAIGN_LEVEL_LOST, () => {
    execute(GameOverCommand);
    destroy();
  });

  return {};
});
