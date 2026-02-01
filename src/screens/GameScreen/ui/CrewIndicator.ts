import { ASSETS } from '@/assets';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { typedAssets } from '@/core/assets/typed-assets';
import { delay } from '@/core/game/Coroutine';
import type { Ref } from '@/core/reactivity/refs/ref';
import {
  createRefCollection,
  type Elements,
  type RefCollection,
  type Strategy,
  type TransitionBatch,
} from '@/core/reactivity/refs/ref-collection';
import { getRunState } from '@/data/game-state';
import { t } from '@/i18n/i18n';
import { LayoutContainer } from '@pixi/layout/components';
import { Button } from '@pixi/ui';
import { animate, utils } from 'animejs';
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

    const strategy: Strategy = (() => {
      const BASE_DURATION = 200;
      const MIN_DURATION = 5; // Never faster than this

      let running = false;
      let pendingQueue: TransitionBatch[] = [];

      return async (parent, batch) => {
        if (running) {
          pendingQueue.push(batch);
          return;
        }

        running = true;
        await runAnimation(parent, batch, getDuration());

        while (pendingQueue.length > 0) {
          const next = pendingQueue.shift()!;
          await runAnimation(parent, next, getDuration());
        }

        running = false;
      };

      function getDuration(): number {
        const queueLength = pendingQueue.length;

        if (queueLength === 0) return BASE_DURATION;
        if (queueLength >= 5) return MIN_DURATION;

        // Linear interpolation: queue 1 = 170ms, queue 4 = 80ms
        const speedUp = 1 + queueLength * 0.75; // 1x, 1.75x, 2.5x, 3.25x, 4x
        return Math.max(MIN_DURATION, BASE_DURATION / speedUp);
      }

      async function runAnimation(parent: Elements, { adds, removes, moves }: TransitionBatch, duration: number) {
        removes.forEach(({ element }) => element.destroy());
        adds.forEach(({ element }) => parent.addChild(element));

        if (moves.length === 0) return;

        const firstToBack = moves.find((m) => m.from === 0);
        if (!firstToBack) {
          moves.forEach((m) => animate(m.element, { x: 100, duration }));
          return;
        }

        if (duration === MIN_DURATION) {
          parent.removeChild(firstToBack.element);
          parent.addChildAt(firstToBack.element, firstToBack.to);
          return;
        }

        const others = moves.filter((m) => m !== firstToBack);

        animate(firstToBack.element.scale, { x: 2, y: 2, duration, easing: 'easeInOutQuad' });
        await animate(firstToBack.element, { alpha: 0, duration, easing: 'easeInOutQuad' });

        await Promise.all(others.map((m) => animate(m.element, { y: -34, duration, easing: 'easeInOutQuad' })));

        parent.removeChild(firstToBack.element);
        others.forEach((m) => {
          m.element.y = 0;
        });
        parent.addChildAt(firstToBack.element, firstToBack.to);

        firstToBack.element.scale.set(1, 1);
        await animate(firstToBack.element, { alpha: 1, duration, easing: 'easeInOutQuad' });
      }
    })();

    const strategy4: Strategy = (() => {
      let queue = Promise.resolve();

      return (parent, batch) => {
        // Queue this batch after whatever is currently running
        queue = queue.then(() => runAnimation(parent, batch));
        return queue;
      };

      async function runAnimation(parent: Elements, { adds, removes, moves }: TransitionBatch) {
        removes.forEach(({ element }) => element.destroy());
        adds.forEach(({ element }) => parent.addChild(element));

        if (moves.length === 0) return;

        const firstToBack = moves.find((m) => m.from === 0);
        if (!firstToBack) {
          moves.forEach((m) => animate(m.element, { x: 100 }));
          return;
        }

        const others = moves.filter((m) => m !== firstToBack);

        // Full choreography runs to completion
        animate(firstToBack.element.scale, { x: 2, y: 2, duration: 200, easing: 'easeInOutQuad' });
        await animate(firstToBack.element, { alpha: 0, duration: 200, easing: 'easeInOutQuad' });

        await Promise.all(others.map((m) => animate(m.element, { y: -34, duration: 200, easing: 'easeInOutQuad' })));

        parent.removeChild(firstToBack.element);
        others.forEach((m) => {
          m.element.y = 0;
        });
        parent.addChildAt(firstToBack.element, firstToBack.to);

        firstToBack.element.scale.set(1, 1);
        await animate(firstToBack.element, { alpha: 1, duration: 200, easing: 'easeInOutQuad' });
      }
    })();

    const strategy3: Strategy = (() => {
      let runId = 0;

      return async (parent, { adds, removes, moves }) => {
        const myRun = ++runId;

        // Cancel previous animations
        moves.forEach(({ element }) => {
          utils.remove(element);
          utils.remove(element.scale);
          element.y = 0;
          element.alpha = 1;
          element.scale.set(1, 1);
        });

        removes.forEach(({ element }) => element.destroy());
        adds.forEach(({ element }) => parent.addChild(element));

        if (moves.length === 0) return;

        const firstToBack = moves.find((m) => m.from === 0);
        if (!firstToBack) return;

        const others = moves.filter((m) => m !== firstToBack);

        animate(firstToBack.element.scale, { x: 2, y: 2, duration: 200 });
        await animate(firstToBack.element, { alpha: 0, duration: 200 });

        if (myRun !== runId) return; // Newer batch took over

        await Promise.all(others.map((m) => animate(m.element, { y: -34, duration: 200 })));

        if (myRun !== runId) return; // Newer batch took over

        parent.removeChild(firstToBack.element);
        others.forEach((m) => {
          m.element.y = 0;
        });
        parent.addChildAt(firstToBack.element, firstToBack.to);
        firstToBack.element.scale.set(1, 1);

        await animate(firstToBack.element, { alpha: 1, duration: 200 });
      };
    })();

    const strategy2: Strategy = async (parent, { adds, removes, moves }) => {
      removes.forEach(({ element }) => element.destroy());
      adds.forEach(({ element }) => parent.addChild(element));

      if (moves.length === 0) return;

      const firstToBack = moves.find((m) => m.from === 0);
      //moves.forEach((m) => (m.element.y = 0));
      if (firstToBack) {
        // Special choreography
        animate(firstToBack.element.scale, { x: 2, y: 2, duration: 200, easing: 'easeInOutQuad' });

        await Promise.race([
          animate(firstToBack.element, { alpha: 0, duration: 200, easing: 'easeInOutQuad' }),
          delay(200),
        ]);

        const others = moves.filter((m) => m !== firstToBack);
        await Promise.race([
          ...others.map((m) => animate(m.element, { y: -34, duration: 200, easing: 'easeInOutQuad' })),
          delay(200),
        ]);

        parent.removeChild(firstToBack.element);
        others.map((m) => {
          m.element.y = 0;
        });
        parent.addChildAt(firstToBack.element, firstToBack.to);

        firstToBack.element.scale = 1;

        await Promise.race([
          animate(firstToBack.element, { alpha: 1, duration: 200, easing: 'easeInOutQuad' }),
          delay(200),
        ]);

        others.map((m) => {
          m.element.y = 0;
        });
      } else {
        // Default: just slide everything awful to signal broken
        moves.forEach((m) => animate(m.element, { x: 100 }));
      }
    };

    /*
    parent.children.forEach((child) => {
        utils.remove(child);
      });
      if (firstToBack) {
        console.log('start animation');
        // Special choreography
        animate(firstToBack.element.scale, { x: 2, y: 2, duration: 200, easing: 'easeInOutQuad' });
        await Promise.race([
          animate(firstToBack.element, { alpha: 0, duration: 200, easing: 'easeInOutQuad' }),
          delay(200),
        ]);
        const others = moves.filter((m) => m !== firstToBack);
        await Promise.race([
          ...others.map((m) => animate(m.element, { y: -34, duration: 200, easing: 'easeInOutQuad' })),
          delay(200),
        ]);

        parent.removeChild(firstToBack.element);
        others.map((m) => {
          m.element.y = 0;
        });
        console.log('firstToBack', firstToBack.element.label, firstToBack.to);
        parent.addChildAt(firstToBack.element, firstToBack.to);

        firstToBack.element.scale = 1;

        await Promise.race([
          animate(firstToBack.element, { alpha: 1, duration: 200, easing: 'easeInOutQuad' }),
          delay(200),
        ]);

        others.map((m) => {
          m.element.y = 0;
        });
        console.log('end animation');
        */

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
