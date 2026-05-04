import { defineEntity, getUnmount } from '@/core/entity/scope';
import { execute } from '@/core/game/Command';
import { GameEvent } from '@/data/events';
import { addCompletedLevel } from '@/data/game-state';
import { useGameEvent } from '@/hooks/hooks';
import { GameOverCommand } from '@/systems/app/commands/GameOverCommand';
import { LevelTransitionCommand } from '@/systems/level/commands/LevelTransitionCommand';

export interface CampaignProps {
  levels: string[];
}

export const Campaign = defineEntity(({ levels }: CampaignProps) => {
  const destroy = getUnmount();

  useGameEvent(GameEvent.LEVEL_WON, async ({ levelId }) => {
    addCompletedLevel(levelId);
    const nextLevelId = levels[levels.indexOf(levelId) + 1];
    if (nextLevelId) {
      await execute(LevelTransitionCommand, { nextLevelId });
    } else {
      destroy();
      await execute(GameOverCommand);
    }
  });

  useGameEvent(GameEvent.LEVEL_LOST, async () => {
    destroy();
    await execute(GameOverCommand);
  });

  return {};
});
