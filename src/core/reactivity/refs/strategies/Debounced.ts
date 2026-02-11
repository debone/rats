import { animate } from 'animejs';
import type { Elements, TransitionBatch } from '../ref-collection';

export function debouncedStrategy() {
  const BASE_DURATION = 200;
  const MIN_DURATION = 5; // Never faster than this

  let running = false;
  let pendingQueue: TransitionBatch[] = [];

  return async (parent: Elements, batch: TransitionBatch) => {
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
}
