import { TEXT_STYLE_DEFAULT } from '@/consts';
import { DroppableManager } from '@/core/dnd/DroppableManager';
import { getRunState } from '@/data/game-state';
import type { Container } from 'pixi.js';
import { panelLayout } from '../styles';
import { ActiveMemberSlot, getAvatarSprite } from '../widgets/ActiveMemberSlot';
import { BenchContainer } from '../widgets/BenchContainer';

interface CrewSectionProps {
  surface: Container;
}

export function CrewSection({ surface }: CrewSectionProps) {
  const droppableManager = new DroppableManager();

  const primarySlot = new ActiveMemberSlot(getRunState().firstMember, droppableManager, surface);
  droppableManager.addDroppable(primarySlot);

  const secondarySlot = new ActiveMemberSlot(getRunState().secondMember, droppableManager, surface);
  droppableManager.addDroppable(secondarySlot);

  const bench = new BenchContainer({
    droppableManager,
    label: 'bench',
    layout: {
      gap: 10,
      flexDirection: 'row',
      flexWrap: 'wrap',
      width: 200,
      height: 160,
      padding: 20,
      alignContent: 'flex-start',
    },
  });

  getRunState()
    .crewMembers.getAll()
    .forEach((crew) => {
      const avatar = getAvatarSprite(crew, droppableManager, surface);
      avatar.on('dragcancel', () => {
        avatar.layout = true;
      });
      bench.addChild(avatar);
    });

  const cleanupBatchChange = getRunState().crewMembers.onBatchChange.subscribe((change) => {
    if (!change) return;
    change.adds.forEach((add) => {
      const avatar = getAvatarSprite(add.item.get(), droppableManager, surface);
      avatar.on('dragcancel', () => {
        avatar.layout = true;
      });
      bench.addChild(avatar);
    });
  }, false);

  const section = (
    <layoutContainer layout={panelLayout}>
      <text text="Crew" style={TEXT_STYLE_DEFAULT} layout={true} />
      <layoutContainer layout={{ ...panelLayout, flexDirection: 'row', gap: 10 }}>
        <layoutContainer layout={{ ...panelLayout, gap: 20 }}>
          <text text="Active Members" style={TEXT_STYLE_DEFAULT} layout={true} />
          {primarySlot}
          {secondarySlot}
        </layoutContainer>
        <layoutContainer layout={{ ...panelLayout, flexGrow: 1 }}>
          <text text="Passive Members" style={TEXT_STYLE_DEFAULT} layout={true} />
          {bench}
        </layoutContainer>
      </layoutContainer>
    </layoutContainer>
  );

  section.on('destroyed', cleanupBatchChange);

  return section;
}
