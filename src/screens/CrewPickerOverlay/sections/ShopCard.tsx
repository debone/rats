import { TEXT_STYLE_DEFAULT } from '@/consts';
import type { CrewMemberDef } from '@/entities/crew/Crew';
import { buyCrewMember, getCrewTexture, getScrapsTexture } from '../actions';
import { buttonLayout, panelLayout } from '../styles';

interface ShopCardProps {
  crewMember: CrewMemberDef;
}

export function ShopCard({ crewMember }: ShopCardProps) {
  let cardRef: import('pixi.js').Container | undefined;

  return (
    <layoutContainer layout={panelLayout} ref={(el: import('pixi.js').Container) => (cardRef = el)}>
      <text text="Hire" style={TEXT_STYLE_DEFAULT} layout={true} />
      <sprite texture={getCrewTexture(crewMember.type)} layout={true} />
      <button
        layout={buttonLayout}
        onPress={() => {
          if (buyCrewMember(crewMember)) cardRef?.destroy({ children: true });
        }}
      >
        <sprite texture={getScrapsTexture()} layout={true} />
        <text text={`${crewMember.hiringCost} Scraps`} style={TEXT_STYLE_DEFAULT} layout={true} />
      </button>
    </layoutContainer>
  );
}
