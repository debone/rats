import { ASSETS } from '@/assets';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { typedAssets } from '@/core/assets/typed-assets';
import type { Ref } from '@/core/reactivity/refs/ref';
import { createRefCollection, type Strategy } from '@/core/reactivity/refs/ref-collection';
import { activateCrewMember, getRunState } from '@/data/game-state';
import { LayoutContainer } from '@pixi/layout/components';
import { Button } from '@pixi/ui';
import { animate } from 'animejs';
import { Sprite, Text } from 'pixi.js';

export type CrewMemberType = 'faster' | 'doubler' | 'captain' | 'empty';

export abstract class CrewMember {
  public readonly key: string;
  public readonly name: string;
  public readonly description: string;
  public readonly type: CrewMemberType;
  public readonly textureName: string;

  constructor({
    key,
    name,
    description,
    type,
    textureName,
  }: {
    key: string;
    name: string;
    description: string;
    type: CrewMemberType;
    textureName: string;
  }) {
    this.key = key;
    this.name = name;
    this.textureName = textureName;
    this.description = description;
    this.type = type;
  }
}

export class FasterCrewMember extends CrewMember {
  constructor(key: string) {
    super({ key, name: 'Faster', description: 'balls go brrr', type: 'faster', textureName: 'avatars_tile_2#0' });
  }
}

export class DoublerCrewMember extends CrewMember {
  constructor(key: string) {
    super({ key, name: 'Doubler', description: 'double the balls', type: 'doubler', textureName: 'avatars_tile_3#0' });
  }
}

export class CaptainCrewMember extends CrewMember {
  constructor(key: string) {
    super({ key, name: 'Captain', description: 'ship is faster', type: 'captain', textureName: 'avatars_tile_4#0' });
  }
}

export class EmptyCrewMember extends CrewMember {
  constructor(key: string) {
    super({ key, name: '', description: '', type: 'empty', textureName: 'avatars_tile_1#0' });
  }
}

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

export class CrewIndicator extends LayoutContainer {
  private _crewMembers: CrewMember[] = [];

  constructor() {
    super();

    const crewMembersCollection = getRunState().crewMembers;

    this.layout = {
      borderWidth: 1,
      borderRadius: 2,
      gap: 3,
      marginTop: 'auto',
      flexDirection: 'column',
    };

    const strategy: Strategy = async (parent, { adds, removes, moves }) => {
      removes.forEach(({ element }) => element.destroy());
      adds.forEach(({ element }) => parent.addChild(element));

      if (moves.length === 0) return;

      const firstToBack = moves.find((m) => m.from === 0);

      //moves.forEach((m) => (m.element.y = 0));
      if (firstToBack) {
        // Special choreography
        animate(firstToBack.element.scale, { x: 2, y: 2, duration: 200, easing: 'easeInOutQuad' });
        await animate(firstToBack.element, { alpha: 0, duration: 200, easing: 'easeInOutQuad' });
        const others = moves.filter((m) => m !== firstToBack);
        await Promise.all(others.map((m) => animate(m.element, { y: -34, duration: 200, easing: 'easeInOutQuad' })));

        parent.removeChild(firstToBack.element);
        others.map((m) => {
          m.element.y = 0;
        });
        parent.addChildAt(firstToBack.element, firstToBack.to);

        firstToBack.element.scale = 1;

        await animate(firstToBack.element, { alpha: 1, duration: 200, easing: 'easeInOutQuad' });
      } else {
        // Default: just slide everything awful to signal broken
        moves.forEach((m) => animate(m.element, { x: 100 }));
      }
    };

    createRefCollection({
      path: 'crewMembers',
      template: (ref: Ref<CrewMember>) => getBadge(ref).view!,
      data: crewMembersCollection,
      parent: this,
      strategy,
    });
  }
}
