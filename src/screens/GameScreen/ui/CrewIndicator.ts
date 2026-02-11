import { ASSETS } from '@/assets';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { typedAssets } from '@/core/assets/typed-assets';
import type { Ref } from '@/core/reactivity/refs/ref';
import { createRefCollection, type RefCollection, type Strategy } from '@/core/reactivity/refs/ref-collection';
import { debouncedStrategy } from '@/core/reactivity/refs/strategies/Debounced';
import { getRunState } from '@/data/game-state';
import type { CrewMember } from '@/entities/crew/Crew';
import { t } from '@/i18n/i18n';
import { LayoutContainer } from '@pixi/layout/components';
import { Button } from '@pixi/ui';
import { Sprite, Text } from 'pixi.js';

function getBadge(crewMember: Ref<CrewMember>): Button {
  const name = crewMember.name.get();
  const textureName = crewMember.textureName.get();

  const texture = typedAssets.get(ASSETS.prototype).textures[textureName];

  const container = new LayoutContainer({
    layout: {
      gap: 7,
      flexDirection: 'row',
    },
  });

  const sprite = new Sprite({ texture, layout: { width: 32, height: 32 } });
  container.addChild(sprite);

  const hoverContainer = new LayoutContainer({
    visible: false,
    layout: {
      gap: 3,
      flexDirection: 'column',
      backgroundColor: 0x272736,
      borderColor: 0x57294b,
      borderWidth: 1,
      borderRadius: 3,
      padding: 5,
    },
  });

  if (name) {
    const text = new Text({
      text: name,
      style: {
        ...TEXT_STYLE_DEFAULT,
        fontSize: 14,
      },
      layout: true,
    });
    hoverContainer.addChild(text);

    container.addChild(hoverContainer);
  }

  const button = new Button(container);

  button.onHover.connect(() => {
    sprite.tint = 0xffff00;
    if (name) {
      hoverContainer.visible = true;
    }
  });

  button.onOut.connect(() => {
    sprite.tint = 0xffffff;
    if (name) {
      hoverContainer.visible = false;
    }
  });

  return button;
}

const crewSwapIcon = () => {
  const texture = typedAssets.get(ASSETS.prototype).textures['avatars_tile_5#0'];
  const container = new LayoutContainer({
    layout: {
      gap: 7,
      flexDirection: 'row',
    },
  });

  const sprite = new Sprite({ texture, layout: { width: 32, height: 32 } });
  container.addChild(sprite);

  const hoverContainer = new LayoutContainer({
    visible: false,
    layout: {
      gap: 3,
      flexDirection: 'column',
      backgroundColor: 0x272736,
      borderColor: 0x57294b,
      borderWidth: 1,
      borderRadius: 3,
      padding: 5,
    },
  });

  const text = new Text({
    text: t.dict['crew-swap'],
    style: {
      ...TEXT_STYLE_DEFAULT,
      fontSize: 14,
    },
    layout: true,
  });
  hoverContainer.addChild(text);

  container.addChild(hoverContainer);

  const button = new Button(container);

  button.onHover.connect(() => {
    hoverContainer.visible = true;
  });

  button.onOut.connect(() => {
    hoverContainer.visible = false;
  });

  return button.view!;
};

export class CrewIndicator extends LayoutContainer {
  constructor() {
    super();

    const crewMembersCollection = getRunState().crewMembers;

    this.layout = {
      gap: 5,
      flexDirection: 'column',
    };

    this.addChild(new Text({ text: 'Crew', style: TEXT_STYLE_DEFAULT, layout: true }));
    this.addChild(crewSwapIcon());

    const crewContainer = new LayoutContainer({
      layout: {
        gap: 3,
        flexDirection: 'column',
      },
    });
    this.addChild(crewContainer);

    const strategy: Strategy = debouncedStrategy();

    this._crewMembers = createRefCollection({
      path: 'crewMembers',
      template: (ref: Ref<CrewMember>) => getBadge(ref).view!,
      data: crewMembersCollection,
      parent: crewContainer,
      strategy,
    });
  }

  private _crewMembers: RefCollection<CrewMember>;

  destroy() {
    super.destroy();
    this._crewMembers.destroy();
  }
}
