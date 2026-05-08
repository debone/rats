import { Command, execute } from '@/core/game/Command';
import type { Coroutine } from '@/core/game/Coroutine';
import { setCurrentLevelId } from '@/data/game-state';
import { GameScreen } from '@/screens/GameScreen/GameScreen';
import { Campaign } from '@/systems/campaign/Campaign';
import { LoadLevelCommand } from '@/systems/level/commands/LoadLevelCommand';
import { CAMPAIGN_LEVELS } from '@/systems/level/levels/campaign-def';
import { ShowScreenCommand } from '@/systems/navigation/commands/ShowScreenCommand';

export class LevelSelectedCommand extends Command<{ levelId: string }> {
  *execute({ levelId }: { levelId: string }): Coroutine {
    console.log('[Command] Level Selected', levelId);

    setCurrentLevelId(levelId);
    yield execute(ShowScreenCommand, { screen: GameScreen });
    // Start the first level
    Campaign({ levels: CAMPAIGN_LEVELS });
    yield execute(LoadLevelCommand, { levelId });
  }
}
