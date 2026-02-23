import { DraggableSprite } from '@/core/dnd/DraggableSprite';
import { DroppableLayoutContainer } from '@/core/dnd/DroppableLayoutContainer';
import { getRunState } from '@/data/game-state';
import type { CrewMemberInstance } from '@/entities/crew/Crew';
import type { Container, FederatedPointerEvent } from 'pixi.js';

/**
 * The bench container. Extends DroppableLayoutContainer with signal and pool
 * awareness: when a member from an active slot is dropped here, it clears
 * that slot's signal and pushes the member back into crewMembers.
 * The onBatchChange subscriber then creates the bench sprite reactively.
 */
export class BenchContainer extends DroppableLayoutContainer {
  onDrop(event: FederatedPointerEvent, item: Container): boolean {
    if (item instanceof DraggableSprite && item.data) {
      const member = item.data as CrewMemberInstance;
      const runState = getRunState();

      if (!runState.crewMembers.getAll().some((m) => m.key === member.key)) {
        item.destroy();
        runState.crewMembers.push(member);
        this.resetPreview();
        return true;
      }
    }
    return super.onDrop(event, item);
  }
}
