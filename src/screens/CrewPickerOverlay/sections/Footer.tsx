import { TEXT_STYLE_DEFAULT } from '@/consts';
import { useContext } from '@/core/reactivity/context';
import { computed } from '@/core/reactivity/signals/signals';
import { CREW_DEFS, type CrewMemberDef } from '@/entities/crew/Crew';
import { getCrewTexture, getSlotTexture } from '../actions';
import { CREW_PICKER_CTX, type CrewPickerCtx } from '../context';
import { panelLayout, panelLayoutBordered } from '../styles';

const PORTRAIT_SIZE = 64;

export function Footer() {
  const { hoveredMember } = useContext<CrewPickerCtx>(CREW_PICKER_CTX);

  const hoveredDef = computed<CrewMemberDef | null>(() => {
    const hovered = hoveredMember.get();
    if (!hovered) return null;
    if ('defKey' in hovered) return CREW_DEFS[hovered.defKey];
    return hovered;
  });

  const hoveredTexture = computed(() => {
    const def = hoveredDef.get();
    if (!def) return getSlotTexture();
    return getCrewTexture(def.type);
  });

  const hoveredName = computed(() => {
    const def = hoveredDef.get();
    if (!def) return '';
    return def.name;
  });

  const hoveredDescription = computed(() => {
    const def = hoveredDef.get();
    if (!def) return '';
    return def.description;
  });

  const hoveredAbilityName = computed(() => {
    const def = hoveredDef.get();
    if (!def) return ''; // return 'Hover a crew member';
    return def.activeAbility.name;
  });

  const hoveredAbilityCost = computed(() => {
    const def = hoveredDef.get();
    if (!def) return '';
    return `${def.activeAbility.cost} cheese`;
  });

  const hoveredAbilityDesc = computed(() => {
    const def = hoveredDef.get();
    if (!def) return '';
    return def.activeAbility.description;
  });

  const footer = (
    <box layout={{ ...panelLayout, flexDirection: 'column', width: 360 }}>
      <box layout={{ flexDirection: 'row', gap: 20, width: '100%' }}>
        <sprite
          texture={getSlotTexture()}
          bind={{ texture: hoveredTexture }}
          layout={{ width: PORTRAIT_SIZE, height: PORTRAIT_SIZE, flexShrink: 0 }}
        />
        <box layout={{ ...panelLayoutBordered, flexGrow: 1, flexShrink: 1, alignItems: 'flex-start' }}>
          <box layout={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
            <text text={hoveredAbilityName} style={{ ...TEXT_STYLE_DEFAULT, fontSize: 16 }} layout />
            <text text={hoveredAbilityCost} style={TEXT_STYLE_DEFAULT} layout />
          </box>
          <text text={hoveredAbilityDesc} style={TEXT_STYLE_DEFAULT} layout />
        </box>
      </box>
      <box layout={{ flexDirection: 'row', gap: 10, width: '100%' }}>
        <box layout={{ width: PORTRAIT_SIZE * 2, flexShrink: 0 }}>
          <text text={hoveredName} style={{ ...TEXT_STYLE_DEFAULT, fontSize: 16 }} layout />
        </box>
        <text text={hoveredDescription} style={TEXT_STYLE_DEFAULT} layout={{ flexGrow: 1 }} />
      </box>
    </box>
  );

  footer.on('destroyed', () => {
    hoveredDef.dispose();
    hoveredTexture.dispose();
    hoveredName.dispose();
    hoveredDescription.dispose();
    hoveredAbilityName.dispose();
    hoveredAbilityCost.dispose();
    hoveredAbilityDesc.dispose();
  });

  return footer;
}
