import { defineEntity } from '@/core/entity/scope';
import { execute } from '@/core/game/Command';
import { GameEvent } from '@/data/events';
import { useGameEvent } from '@/hooks/hooks';
import { CrewPickerOverlay } from '@/screens/CrewPickerOverlay/CrewPickerOverlay';
import { ShowOverlayCommand } from '@/systems/navigation/commands/ShowOverlayCommand';

export interface ExitShopProps {
  onExit: () => void;
}

export const ExitShop = defineEntity(({ onExit }: ExitShopProps) => {
  let done = false;

  useGameEvent(GameEvent.BALL_EXITED, async () => {
    if (done) return;
    done = true;
    await execute(ShowOverlayCommand, { overlay: CrewPickerOverlay, waitForCompletion: true });
    onExit();
  });
});
