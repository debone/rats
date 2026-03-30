import { TEXT_STYLE_DEFAULT } from '@/consts';
import { useContext } from '@/core/reactivity/context';
import type { CrewMemberDef } from '@/entities/crew/Crew';
import type { LayoutContainer } from '@pixi/layout/components';
import type { Sprite, Text } from 'pixi.js';
import { buyCrewMember, getCrewTexture, getScrapsTexture } from '../actions';
import { CREW_PICKER_CTX, type CrewPickerCtx } from '../context';
import { buttonLayout, panelLayoutBordered } from '../styles';

interface ShopCardProps {
  crewMember: CrewMemberDef;
  onPurchased?: () => void;
}

export function ShopCard({ crewMember, onPurchased }: ShopCardProps) {
  const { hoverIntent } = useContext<CrewPickerCtx>(CREW_PICKER_CTX);
  let cardRef: LayoutContainer | undefined;
  let scrapsRef: Sprite | undefined;
  let scrapsTextRef: Text | undefined;
  let sold = false;

  return (
    <layoutContainer
      layout={{
        ...panelLayoutBordered,
        width: 110,
      }}
      interactive
      onPointerover={() => hoverIntent.hoverEnter(crewMember)}
      onPointerout={() => hoverIntent.hoverLeave()}
      ref={(el) => (cardRef = el)}
    >
      <text text={crewMember.name} style={TEXT_STYLE_DEFAULT} layout={true} />
      <sprite texture={getCrewTexture(crewMember.type)} layout={true} />
      <button
        layout={{ ...buttonLayout, width: 96 }}
        onPress={() => {
          if (!sold && buyCrewMember(crewMember)) {
            cardRef!.background.tint = 0x00ff00;
            scrapsTextRef!.text = 'Sold';
            scrapsRef!.visible = false;
            sold = true;
            onPurchased?.();
          }
        }}
      >
        <sprite texture={getScrapsTexture()} layout={true} ref={(el) => (scrapsRef = el)} />
        <text
          text={`${crewMember.hiringCost} Clay Balls`}
          style={TEXT_STYLE_DEFAULT}
          layout={true}
          ref={(el) => (scrapsTextRef = el)}
        />
      </button>
    </layoutContainer>
  );
}
