/**
 * Navigation System
 *
 * Wraps the navigation singleton and integrates it with the scheduler.
 */

import type { System } from '@/core/game/System';
import type { GameContext } from '@/data/game-context';
import { navigation } from '@/core/window/navigation';

export class NavigationSystem implements System {
  static SYSTEM_ID = 'navigation';

  private context!: GameContext;
  private resizeHandler = this.resize.bind(this);
  private pauseHandler = this.blur.bind(this);
  private resumeHandler = this.focus.bind(this);

  init(context: GameContext) {
    this.context = context;

    navigation.setContext(context);

    // Register navigation lifecycle with scheduler
    context.systems.register('resize', this.resizeHandler);
    context.systems.register('pause', this.pauseHandler);
    context.systems.register('resume', this.resumeHandler);
  }

  private resize(w: number, h: number) {
    navigation.resize(w, h);
  }

  private blur() {
    navigation.blur();
  }

  private focus() {
    navigation.focus();
  }

  destroy() {
    this.context.systems.unregister('resize', this.resizeHandler);
    this.context.systems.unregister('pause', this.pauseHandler);
    this.context.systems.unregister('resume', this.resumeHandler);
  }
}
