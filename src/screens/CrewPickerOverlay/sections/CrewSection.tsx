import { TEXT_STYLE_DEFAULT } from '@/consts';
import { DroppableManager } from '@/core/dnd/DroppableManager';
import { useContext } from '@/core/reactivity/context';
import { getRunState } from '@/data/game-state';
import type { Container } from 'pixi.js';
import { CREW_PICKER_CTX, type CrewPickerCtx } from '../context';
import { panelLayout, panelLayoutBordered } from '../styles';
import { ActiveMemberSlot, getAvatarSprite } from '../widgets/ActiveMemberSlot';
import { BenchContainer } from '../widgets/BenchContainer';

interface CrewSectionProps {
  surface: Container;
}

export function CrewSection({ surface }: CrewSectionProps) {
  const { hoverIntent } = useContext<CrewPickerCtx>(CREW_PICKER_CTX);
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
      padding: 10,
      alignContent: 'flex-start',
    },
  });

  const setupBenchAvatar = (avatar: ReturnType<typeof getAvatarSprite>) => {
    avatar.on('dragcancel', () => {
      avatar.layout = true;
    });
    avatar.on('dragstart', () => {
      hoverIntent.clearImmediate();
    });
    avatar.on('pointerover', () => {
      if (avatar.data) {
        hoverIntent.hoverEnter(avatar.data);
      }
    });
    avatar.on('pointerout', () => {
      hoverIntent.hoverLeave();
    });
    return avatar;
  };

  getRunState()
    .crewMembers.getAll()
    .forEach((crew) => {
      bench.addChild(setupBenchAvatar(getAvatarSprite(crew, droppableManager, surface)));
    });

  const cleanupBatchChange = getRunState().crewMembers.onBatchChange.subscribe((change) => {
    if (!change) return;
    change.adds.forEach((add) => {
      bench.addChild(setupBenchAvatar(getAvatarSprite(add.item.get(), droppableManager, surface)));
    });
  }, false);

  const section = (
    <layoutContainer layout={panelLayout}>
      <text text="Crew" style={{ ...TEXT_STYLE_DEFAULT, fontSize: 16 }} layout={true} />
      <text
        text="Drag and drop to make changes, active crew can use abilities"
        style={{ ...TEXT_STYLE_DEFAULT, fontSize: 10 }}
        layout={true}
      />
      <layoutContainer layout={{ ...panelLayoutBordered, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <layoutContainer layout={{ ...panelLayout, gap: 20 }}>
          <text text="Captain" style={TEXT_STYLE_DEFAULT} layout={true} />
          {primarySlot}
          <text text="First Mate" style={TEXT_STYLE_DEFAULT} layout={true} />
          {secondarySlot}
        </layoutContainer>
        <layoutContainer layout={{ ...panelLayoutBordered, flexGrow: 1 }}>
          <text text="Deck" style={TEXT_STYLE_DEFAULT} layout={true} />
          {bench}
        </layoutContainer>
      </layoutContainer>
    </layoutContainer>
  );

  section.on('destroyed', () => {
    cleanupBatchChange();
    hoverIntent.clearImmediate();
  });

  return section;
}
