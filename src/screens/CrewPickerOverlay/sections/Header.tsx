import { TEXT_STYLE_DEFAULT } from '@/consts';
import type { Signal } from '@/core/reactivity/signals/types';
import { buttonLayout, panelLayout } from '../styles';

interface HeaderProps {
  scrapsCounter: Signal<number>;
  onAddScraps: () => void;
  onClose: () => void;
}

export function Header({ scrapsCounter, onAddScraps, onClose }: HeaderProps) {
  const scrapsText = (<text text="0 Scraps" style={TEXT_STYLE_DEFAULT} layout={true} />) as import('pixi.js').Text;

  const cleanupScraps = scrapsCounter.subscribe((count) => {
    scrapsText.text = `${count} Scraps`;
  });

  const header = (
    <layoutContainer layout={{ ...panelLayout, flexDirection: 'row', justifyContent: 'space-between' }}>
      <button layout={buttonLayout} onPress={onAddScraps}>
        <text text="Add Scraps" style={TEXT_STYLE_DEFAULT} layout={true} />
      </button>
      {scrapsText}
      <button layout={buttonLayout} onPress={onClose}>
        <text text="Close" style={TEXT_STYLE_DEFAULT} layout={true} />
      </button>
    </layoutContainer>
  );

  header.on('destroyed', cleanupScraps);

  return header;
}
