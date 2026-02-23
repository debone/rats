import { TEXT_STYLE_DEFAULT } from '@/consts';
import { panelLayout } from '../styles';

export function Footer() {
  return (
    <layoutContainer layout={{ ...panelLayout, flexDirection: 'row' }}>
      <layoutContainer layout={{ ...panelLayout, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <text text="RAT" style={TEXT_STYLE_DEFAULT} layout={true} />
      </layoutContainer>
      <layoutContainer layout={panelLayout}>
        <layoutContainer layout={panelLayout}>
          <text text="Active Ability" layout />
        </layoutContainer>
        <layoutContainer layout={panelLayout}>
          <text text="Passive Ability" layout />
        </layoutContainer>
      </layoutContainer>
    </layoutContainer>
  );
}
