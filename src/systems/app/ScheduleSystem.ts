import { assert } from '@/core/common/assert';
import type { System } from '@/core/game/System';
import type { GameContext } from '@/data/game-context';

export const SCHEDULE_CONTEXTS = {
  RUN: 'RUN',
  LEVEL: 'LEVEL',
} as const;

export type ScheduleContexts = keyof typeof SCHEDULE_CONTEXTS;
export type ScheduledTask = {
  timeout: number;
  callback: () => void;
  cancelledCallback?: () => void;
};

/**
 * ScheduleSystem is the engine setTimeout but with a cancellable callback
 * in case the setup needs to move on. Avoids leaving setTimeouts hanging
 * when entities get removed
 */
export class ScheduleSystem implements System {
  static SYSTEM_ID = 'schedule';

  private context!: GameContext;
  private updateHandler = this.update.bind(this);
  private pauseHandler = () => {
    this.paused = true;
  };
  private resumeHandler = () => {
    this.paused = false;
  };
  private paused = false;

  private clocks = new Map<ScheduleContexts, Set<ScheduledTask>>();

  init(context: GameContext) {
    this.context = context;

    Object.keys(SCHEDULE_CONTEXTS).forEach((k) => this.clocks.set(k as ScheduleContexts, new Set()));

    this.context.systems.register('update', this.updateHandler);
    this.context.systems.register('pause', this.pauseHandler);
    this.context.systems.register('resume', this.resumeHandler);
  }

  update(delta: number) {
    if (this.paused) return;
    this.clocks.forEach((set) => {
      set.forEach((scheduledTask) => {
        scheduledTask.timeout -= delta;

        if (scheduledTask.timeout <= 0) {
          scheduledTask.callback();
          set.delete(scheduledTask);
        }
      });
    });
  }

  clearClocks(context: ScheduleContexts) {
    const ctx = this.clocks.get(context);
    ctx?.forEach((task) => {
      task.cancelledCallback?.();
    });
    ctx?.clear();
  }

  trySchedule(
    callback: () => void,
    cancelledCallback: () => void,
    duration: number,
    context: ScheduleContexts = SCHEDULE_CONTEXTS.LEVEL,
  ) {
    assert(duration >= 0, 'Duration must be positive');

    const ctx = this.clocks.get(context);
    const task: ScheduledTask = {
      timeout: duration,
      callback,
      cancelledCallback,
    };

    ctx?.add(task);

    return (cancel = true) => {
      ctx?.delete(task);

      if (cancel) {
        cancelledCallback();
      }
    };
  }

  destroy() {
    this.context.systems.unregister('update', this.updateHandler);
    this.context.systems.unregister('pause', this.pauseHandler);
    this.context.systems.unregister('resume', this.resumeHandler);
  }

  schedule(callback: () => void, duration: number, context: ScheduleContexts = SCHEDULE_CONTEXTS.LEVEL) {
    assert(duration >= 0, 'Duration must be positive');

    const ctx = this.clocks.get(context);
    const task: ScheduledTask = {
      timeout: duration,
      callback,
    };

    ctx?.add(task);

    return () => {
      ctx?.delete(task);
    };
  }
}
