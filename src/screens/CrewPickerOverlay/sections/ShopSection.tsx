import { TEXT_STYLE_DEFAULT } from '@/consts';
import { pickRandomCrewMember } from '@/entities/crew/Crew';
import { panelLayout } from '../styles';
import { ShopCard } from './ShopCard';

export function ShopSection() {
  return (
    <layoutContainer layout={panelLayout}>
      <text text="Hire crew" style={{ ...TEXT_STYLE_DEFAULT, fontSize: 16 }} layout={true} />
      <layoutContainer layout={{ ...panelLayout, flexDirection: 'row', gap: 10 }}>
        <ShopCard crewMember={pickRandomCrewMember()} />
        <ShopCard crewMember={pickRandomCrewMember()} />
        <ShopCard crewMember={pickRandomCrewMember()} />
      </layoutContainer>
    </layoutContainer>
  );
}
