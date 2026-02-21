import { ASSETS, type PrototypeTextures } from '@/assets';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { typedAssets } from '@/core/assets/typed-assets';
import { computed } from '@/core/reactivity/signals/signals';
import { getRunState } from '@/data/game-state';
import { CREW_DEFS, CrewMemberInstance } from '@/entities/crew/Crew';
import { LayoutContainer } from '@pixi/layout/components';
import { Button } from '@pixi/ui';
import { Sprite, Text } from 'pixi.js';

class BadgeButton extends Button {
  private _crewMember: CrewMemberInstance;
  private _sprite: Sprite;
  private _hoverContainer: LayoutContainer;
  private _nameText: Text;

  constructor(crewMember: CrewMemberInstance | undefined) {
    const member = crewMember ?? new CrewMemberInstance('empty', 'empty');

    const def = CREW_DEFS[member.defKey];

    const texture = typedAssets.get(ASSETS.prototype).textures[def.textureName];

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
      text: `${def.name} - ${def.ability.cost}`,
      style: {
        ...TEXT_STYLE_DEFAULT,
        fontSize: 14,
      },
      layout: true,
    });
    hoverContainer.addChild(nameText);
    container.addChild(hoverContainer);

    const costContainer = new LayoutContainer({
      layout: {
        width: 20,
        height: 20,
        backgroundColor: 0x272736,
        borderColor: 0x57294b,
        borderWidth: 3,
        borderRadius: 10,
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
        top: 0,
        right: 0,
      },
    });

    const cheeseSprite = new Sprite({
      texture: typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures['cheese_tile_1#0'],
    });

    cheeseSprite.layout = {
      objectFit: 'none',
      width: 16,
      height: 16,
    };

    const costText = new Text({
      text: `${def.ability.cost}`,
      style: {
        ...TEXT_STYLE_DEFAULT,
        fontSize: 14,
      },
      layout: {
        width: 20,
        height: 20,
      },
    });

    costContainer.addChild(cheeseSprite);
    costContainer.addChild(costText);
    container.addChild(costContainer);

    super(container);

    this._crewMember = member;
    this._sprite = sprite;
    this._hoverContainer = hoverContainer;
    this._nameText = nameText;

    this.onHover.connect(() => {
      this._sprite.tint = 0xffff00;
      if (CREW_DEFS[this._crewMember.defKey].name) {
        this._hoverContainer.visible = true;
      }
    });

    this.onOut.connect(() => {
      this._sprite.tint = 0xffffff;
      this._hoverContainer.visible = false;
    });
  }

  get crewMember(): CrewMemberInstance {
    return this._crewMember;
  }

  get sprite(): Sprite {
    return this._sprite;
  }

  setCrewMember(crewMember: CrewMemberInstance | undefined): void {
    const member = crewMember ?? new CrewMemberInstance('empty', 'empty');
    this._crewMember = member;
    const def = CREW_DEFS[member.defKey];

    // Update sprite texture
    this._sprite.texture = typedAssets.get(ASSETS.prototype).textures[def.textureName];

    // Update name text
    this._nameText.text = `${def.name} - ${def.ability.cost}`;
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
        paddingTop: 5,
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
