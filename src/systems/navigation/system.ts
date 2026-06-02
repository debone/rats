/**
 * Navigation System
 *
 * Wraps the navigation singleton and integrates it with the scheduler.
 */

import type { System } from '@/core/game/System';
import { navigation } from '@/core/window/navigation';
import type { GameContext } from '@/data/game-context';

export class NavigationSystem implements System {
  static SYSTEM_ID = 'navigation';

  private context!: GameContext;
  private resizeHandler = this.resize.bind(this);

  init(context: GameContext) {
    this.context = context;

    navigation.setContext(context);

    context.systems.register('resize', this.resizeHandler);
  }

  private resize(w: number, h: number) {
    navigation.resize(w, h);
  }

  destroy() {
    this.context.systems.unregister('resize', this.resizeHandler);
  }
}
