import type { Signal } from './signals/types';

export interface HoverIntentOptions {
  switchDebounceMs?: number;
  leaveDelayMs?: number;
}

export interface HoverIntent<T> {
  hoverEnter(value: T): void;
  hoverLeave(): void;
  clearImmediate(): void;
  dispose(): void;
}

export function createHoverIntent<T>(
  target: Signal<T | null>,
  options?: HoverIntentOptions,
): HoverIntent<T> {
  const SWITCH_DEBOUNCE_MS = options?.switchDebounceMs ?? 32;
  const LEAVE_DELAY_MS = options?.leaveDelayMs ?? 140;

  let leaveTimer: ReturnType<typeof setTimeout> | null = null;
  let switchTimer: ReturnType<typeof setTimeout> | null = null;
  let pending: T | null = null;

  function clearTimers() {
    if (leaveTimer) {
      clearTimeout(leaveTimer);
      leaveTimer = null;
    }
    if (switchTimer) {
      clearTimeout(switchTimer);
      switchTimer = null;
    }
  }

  return {
    hoverEnter(value: T) {
      pending = value;

      if (leaveTimer) {
        clearTimeout(leaveTimer);
        leaveTimer = null;
      }

      const current = target.get();

      if (!current) {
        target.set(value);
        pending = null;
        if (switchTimer) {
          clearTimeout(switchTimer);
          switchTimer = null;
        }
        return;
      }

      if (current === value) {
        pending = null;
        if (switchTimer) {
          clearTimeout(switchTimer);
          switchTimer = null;
        }
        return;
      }

      if (switchTimer) {
        clearTimeout(switchTimer);
      }
      switchTimer = setTimeout(() => {
        if (pending) {
          target.set(pending);
        }
        pending = null;
        switchTimer = null;
      }, SWITCH_DEBOUNCE_MS);
    },

    hoverLeave() {
      pending = null;
      if (switchTimer) {
        clearTimeout(switchTimer);
        switchTimer = null;
      }
      if (leaveTimer) {
        clearTimeout(leaveTimer);
      }
      leaveTimer = setTimeout(() => {
        target.set(null);
        leaveTimer = null;
      }, LEAVE_DELAY_MS);
    },

    clearImmediate() {
      clearTimers();
      pending = null;
      target.set(null);
    },

    dispose() {
      clearTimers();
      pending = null;
    },
  };
}
