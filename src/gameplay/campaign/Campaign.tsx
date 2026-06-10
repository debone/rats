import { defineEntity, getUnmount } from '@/core/entity/scope';
import { addCompletedLevel } from '@/data/game-state';
import { useGameEvent } from '@/hooks/hooks';
import { execute } from '@/core/game/Command';
import { GameEvent } from '@/data/events';
import { GameOverCommand } from '@/gameplay/levels/commands/GameOverCommand';
import { LevelTransitionCommand } from '@/gameplay/levels/commands/LevelTransitionCommand';
import { state } from '@/core/state/state';

export interface CampaignProps {
  levels: string[];
}

export const Campaign = defineEntity(({ levels }: CampaignProps) => {
  const destroy = getUnmount();

  let currentLevelId: string = levels[0];

  const campaign = state<['initial', 'shop', 'next-level']>(
    {
      initial: () => {
        //execute(LevelTransitionCommand, { nextLevelId: levels[0] });
        execute(LevelTransitionCommand, { nextLevelId: 'shop-level-0' });
        return 'shop';
      },
      shop: () => {
        execute(LevelTransitionCommand, { nextLevelId: 'shop-level-0' });
        return 'next-level';
      },
      'next-level': () => {
        const nextLevelId = levels[levels.indexOf(currentLevelId) + 1];

        if (!nextLevelId) {
          execute(GameOverCommand);
          destroy();
          return;
        }

        currentLevelId = nextLevelId;
        execute(LevelTransitionCommand, { nextLevelId });
        return 'shop';
      },
    },
    'initial',
  );

  campaign.next();

  useGameEvent(GameEvent.CAMPAIGN_LEVEL_COMPLETED, ({ levelId }) => {
    addCompletedLevel(levelId);

    if (levels.indexOf(levelId) === levels.length - 1) {
      // TODO: show campaign complete screen
      throw new Error('Campaign completed');
    }

    campaign.next();
  });

  useGameEvent(GameEvent.CAMPAIGN_LEVEL_FAILED, () => {
    execute(GameOverCommand);
    destroy();
  });

  return {};
});
