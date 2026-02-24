import { TEXT_STYLE_DEFAULT } from '@/consts';
import { computed } from '@/core/reactivity/signals/signals';
import type { Signal } from '@/core/reactivity/signals/types';
import { getScrapsTexture } from '../actions';
import { buttonLayout, panelLayout, panelLayoutBordered } from '../styles';

interface HeaderProps {
  scrapsCounter: Signal<number>;
  onAddScraps: () => void;
  onClose: () => void;
}

export function Header({ scrapsCounter, onAddScraps, onClose }: HeaderProps) {
  const scrapsText = computed(() => `${scrapsCounter.get()} Scraps`);

  const header = (
    <layoutContainer
      layout={{
        ...panelLayout,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignSelf: 'stretch',
        paddingLeft: 30,
      }}
    >
      <box layout={{ ...panelLayoutBordered, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <sprite texture={getScrapsTexture()} layout={true} />
        <text text={scrapsText} style={TEXT_STYLE_DEFAULT} layout={true} />
      </box>
      <button layout={{ ...buttonLayout, backgroundColor: 0x57294b }} onPress={onClose}>
        <text text="Start Run" style={TEXT_STYLE_DEFAULT} layout={true} />
      </button>
    </layoutContainer>
  );

  header.on('destroyed', () => {
    scrapsText.dispose();
  });

  return header;
}
