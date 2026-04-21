import { TEXT_STYLE_DEFAULT } from '@/consts';
import { CREW_DEFS } from '@/entities/crew/Crew';
import { panelLayout } from '../styles';
import { ShopCard } from './ShopCard';

interface ShopSectionProps {
  /** Called once after a successful hire (e.g. {@link CrewShopOverlay}). */
  onPicked?: () => void;
}

export function ShopSection({ onPicked }: ShopSectionProps = {}) {
  return (
    <layoutContainer layout={panelLayout}>
      <text text="Hire crew" style={{ ...TEXT_STYLE_DEFAULT, fontSize: 16 }} layout={true} />
      <layoutContainer layout={{ ...panelLayout, flexDirection: 'row', gap: 10 }}>
        {Object.values(CREW_DEFS).map((crewMember) => (
          <ShopCard crewMember={crewMember} onPurchased={onPicked} />
        ))}
      </layoutContainer>
    </layoutContainer>
  );
}
