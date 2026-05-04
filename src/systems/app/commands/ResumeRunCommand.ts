import { Command, execute } from '@/core/game/Command';
import type { Coroutine } from '@/core/game/Coroutine';
import type { RunState } from '@/data/game-state';
import { GameScreen } from '@/screens/GameScreen/GameScreen';
import { Campaign } from '@/systems/campaign/Campaign';
import { CAMPAIGN_LEVELS } from '@/systems/campaign/campaign-def';
import { LoadLevelCommand } from '../../level/commands/LoadLevelCommand';
import { ShowScreenCommand } from '../../navigation/commands/ShowScreenCommand';

export class ResumeRunCommand extends Command<{ run: RunState }> {
  *execute({ run }: { run: RunState }): Coroutine {
    console.log('[Command] Resume Run');

    yield execute(ShowScreenCommand, { screen: GameScreen });
    Campaign({ levels: CAMPAIGN_LEVELS });
    yield execute(LoadLevelCommand, { levelId: run.currentLevelId });
  }
}
