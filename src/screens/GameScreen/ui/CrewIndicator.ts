import { ASSETS } from '@/assets';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { typedAssets } from '@/core/assets/typed-assets';
import { signal } from '@/core/reactivity/signals/signals';
import { LayoutContainer } from '@pixi/layout/components';
import { Button } from '@pixi/ui';
import { animate } from 'animejs';
import { Container, Sprite, Text } from 'pixi.js';

// There is a crew array
// The tip of this crew is the one "active"
// When some event (pick cheese) comes, we activate this crew ability
// and shuffle it to back end of the pack
const activeCrew = signal(null);

abstract class CrewMember {
  public readonly name: string;
  public readonly textureName: string;
  public badge: Button;

  constructor({ name, textureName }: { name: string; textureName: string }) {
    this.name = name;
    this.textureName = textureName;
    this.badge = this.getBadge();
  }

  //  abstract activate(): void;

  getBadge(): Button {
    const texture = typedAssets.get(ASSETS.prototype).textures[this.textureName];

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

    if (this.name) {
      const text = new Text({
        text: this.name,
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
      if (this.name) {
        hoverContainer.visible = true;
      }
    });

    button.onOut.connect(() => {
      sprite.tint = 0xffffff;
      if (this.name) {
        hoverContainer.visible = false;
      }
    });

    return button;
  }
}

class FasterCrewMember extends CrewMember {
  constructor() {
    super({ name: 'Faster', textureName: 'avatars_tile_2#0' });
  }
}

class DoublerCrewMember extends CrewMember {
  constructor() {
    super({ name: 'Doubler', textureName: 'avatars_tile_3#0' });
  }
}

class CaptainCrewMember extends CrewMember {
  constructor() {
    super({ name: 'Captain', textureName: 'avatars_tile_4#0' });
  }
}

class EmptyCrewMember extends CrewMember {
  constructor() {
    super({ name: '', textureName: 'avatars_tile_1#0' });
  }
}

export class CrewIndicator extends LayoutContainer {
  private _crewMembers: CrewMember[] = [];

  constructor() {
    super();

    this.layout = {
      borderWidth: 1,
      borderRadius: 2,
      gap: 3,
      marginTop: 'auto',
      flexDirection: 'column',
    };

    const fasterCrewMember = new FasterCrewMember();
    this._crewMembers.push(fasterCrewMember);
    this.addChild(fasterCrewMember.badge.view!);

    const doublerCrewMember = new DoublerCrewMember();
    this._crewMembers.push(doublerCrewMember);
    this.addChild(doublerCrewMember.badge.view!);

    const captainCrewMember = new CaptainCrewMember();
    this._crewMembers.push(captainCrewMember);
    this.addChild(captainCrewMember.badge.view!);

    const emptyCrewMember = new EmptyCrewMember();
    this._crewMembers.push(emptyCrewMember);
    this.addChild(emptyCrewMember.badge.view!);

    setTimeout(() => {
      //this.rotateCrew();
    }, 1000);
  }
  //animate(crewMember1, { x: 0, alpha: 1, duration: 200, easing: 'easeInOutQuad' });

  private async rotateCrewToBack() {
    animate(crewMember1.view!, { x: -10, alpha: 0, duration: 200, easing: 'easeInOutQuad' }).then(() => {
      Promise.all(
        this._crewMembers.map((child) =>
          animate(child, {
            y: -34,
            duration: 500,
            easing: 'easeInOutQuad',
          }),
        ),
      ).then(() => {
        this.removeChild(crewMember1.view!);
        this._crewMembers.map((child) => (child.y = 0));
        this.addChild(crewMember1.view!);
        animate(crewMember1.view!, { x: 0, alpha: 1, duration: 200, easing: 'easeInOutQuad' });
      });
    });
  }

  private async rotateCrew() {
    if (this.children.length === 0) return;

    const oldPositions = this._crewMembers.map((child) => ({
      x: child.layout?.realX ?? 0,
      y: child.layout?.realY ?? 0,
    }));

    console.log('[CrewIndicator] oldPositions', oldPositions);

    // Disable layout, reorder, then let layout calculate new positions
    for (const child of this.children) {
      child.layout = false;
    }

    const firstChild = this.removeChildAt(0);
    this.addChild(firstChild);

    // Re-enable layout to calculate target positions
    for (const child of this.children) {
      child.layout = true;
    }
    const targetPositions = this._crewMembers.map((child) => ({
      x: child.layout?.realX ?? 0,
      y: child.layout?.realY ?? 0,
    }));

    // Set back to old positions and disable layout for animation
    for (let i = 0; i < this._crewMembers.length; i++) {
      const child = this._crewMembers[i];
      //child.x = oldPositions[i].x;
      //child.y = oldPositions[i].y;
      //child.layout = false;
    }
    /**

    await Promise.all(
      this._crewMembers.map((child, i) =>
        animate(child, {
          x: targetPositions[i].x + 100,
          y: targetPositions[i].y,
          duration: 500,
          easing: 'easeInOutQuad',
        }),
      ),
    );
    /*

    // Animate
    await Promise.all(
    );

    // Re-enable layout
    /**
    for (let i = 0; i < this._crewMembers.length; i++) {
      const child = this._crewMembers[i];
      child.x = 0;
      child.y = 0;
      child.layout = true;
    }
    /**/
  }
}
