import { ASSETS } from '@/assets';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { typedAssets } from '@/core/assets/typed-assets';
import { computed } from '@/core/reactivity/signals/signals';
import { getRunState } from '@/data/game-state';
import type { CrewMember } from '@/entities/crew/Crew';
import { EmptyCrewMember } from '@/entities/crew/Empty';
import { LayoutContainer } from '@pixi/layout/components';
import { Button } from '@pixi/ui';
import { Sprite, Text } from 'pixi.js';

class BadgeButton extends Button {
  private _crewMember: CrewMember;
  private _sprite: Sprite;
  private _hoverContainer: LayoutContainer;
  private _nameText: Text;

  constructor(crewMember: CrewMember | undefined) {
    const member = crewMember ?? new EmptyCrewMember('empty');

    const texture = typedAssets.get(ASSETS.prototype).textures[member.textureName];

    const container = new LayoutContainer({
      layout: {
        gap: 7,
        flexDirection: 'row',
        width: 64,
        height: 64,
        alignItems: 'center',
      },
    });

    const sprite = new Sprite({ texture, layout: { width: 32, height: 32 } });
    container.addChild(sprite);

    const hoverContainer = new LayoutContainer({
      visible: false,
      layout: {
        position: 'absolute',
        marginTop: 'auto',
        left: '110%',
        gap: 3,
        flexDirection: 'column',
        backgroundColor: 0x272736,
        borderColor: 0x57294b,
        borderWidth: 1,
        borderRadius: 3,
        padding: 5,
      },
    });

    const nameText = new Text({
      text: member.name,
      style: {
        ...TEXT_STYLE_DEFAULT,
        fontSize: 14,
      },
      layout: true,
    });
    hoverContainer.addChild(nameText);
    container.addChild(hoverContainer);

    super(container);

    this._crewMember = member;
    this._sprite = sprite;
    this._hoverContainer = hoverContainer;
    this._nameText = nameText;

    this.onHover.connect(() => {
      this._sprite.tint = 0xffff00;
      if (this._crewMember.name) {
        this._hoverContainer.visible = true;
      }
    });

    this.onOut.connect(() => {
      this._sprite.tint = 0xffffff;
      this._hoverContainer.visible = false;
    });
  }

  get crewMember(): CrewMember {
    return this._crewMember;
  }

  get sprite(): Sprite {
    return this._sprite;
  }

  setCrewMember(crewMember: CrewMember | undefined): void {
    const member = crewMember ?? new EmptyCrewMember('empty');
    this._crewMember = member;

    // Update sprite texture
    this._sprite.texture = typedAssets.get(ASSETS.prototype).textures[member.textureName];

    // Update name text
    this._nameText.text = member.name;
  }
}

export class CrewIndicator extends LayoutContainer {
  constructor() {
    super();

    this.layout = {
      gap: 5,
      flexDirection: 'column',
    };

    this.addChild(new Text({ text: 'Crew', style: TEXT_STYLE_DEFAULT, layout: true }));

    const crewContainer = new LayoutContainer({
      layout: {
        width: 64,
        gap: 15,
        paddingTop: 15,
        flexDirection: 'column',
        alignItems: 'center',
      },
    });

    this.addChild(crewContainer);

    const firstMemberBadge = new BadgeButton(getRunState().firstMember.get());
    computed(() => {
      const crewMember = getRunState().firstMember.get();
      firstMemberBadge.setCrewMember(crewMember);
    });

    firstMemberBadge.sprite.layout = {
      width: 64,
      height: 64,
    };

    const secondMemberBadge = new BadgeButton(getRunState().secondMember.get());
    computed(() => {
      const crewMember = getRunState().secondMember.get();
      secondMemberBadge.setCrewMember(crewMember);
    });

    secondMemberBadge.sprite.layout = {
      width: 48,
      height: 48,
    };
    secondMemberBadge.view!.layout = {
      width: 48,
      height: 48,
      alignSelf: 'flex-start',
    };

    crewContainer.addChild(firstMemberBadge.view!);
    crewContainer.addChild(secondMemberBadge.view!);
  }

  destroy() {
    super.destroy();
  }
}
