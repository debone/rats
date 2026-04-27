import { TEXT_STYLE_DEFAULT } from '@/consts';
import { KeyboardNav } from '@/core/ui/KeyboardNav';
import { pickShopSelection } from '@/entities/crew/Crew';
import { panelLayout } from '../styles';
import { ShopCard } from './ShopCard';

interface ShopSectionProps {
  /** Called once after a successful hire (e.g. {@link CrewShopOverlay}). */
  onPicked?: () => void;
  /** Optional keyboard navigator — cards register themselves as nav items when provided. */
  keyboardNav?: KeyboardNav;
}

export function ShopSection({ onPicked, keyboardNav }: ShopSectionProps = {}) {
  const shopSelection = pickShopSelection();

  return (
    <layoutContainer layout={panelLayout}>
      <text text="Hire crew" style={{ ...TEXT_STYLE_DEFAULT, fontSize: 16 }} layout={true} />
      <layoutContainer layout={{ ...panelLayout, flexDirection: 'row', gap: 10 }}>
        {shopSelection.map((crewMember) => (
          <ShopCard crewMember={crewMember} onPurchased={onPicked} keyboardNav={keyboardNav} />
        ))}
      </layoutContainer>
    </layoutContainer>
  );
}
