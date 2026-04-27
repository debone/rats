import { InputDevice } from 'pixijs-input-devices';

/**
 * A single focusable item in a keyboard-navigable group.
 *
 * Minimal requirement: `onPress`. Provide `onFocus`/`onBlur` to drive
 * visual feedback (highlight the item when it becomes the active selection).
 *
 * @example
 * nav.add({
 *   onFocus: () => { cardRef.filters = [focusGlow]; },
 *   onBlur:  () => { cardRef.filters = []; },
 *   onPress: () => buyCrewMember(crewMember),
 * });
 */
export interface KeyboardNavItem {
  onFocus?: () => void;
  onBlur?: () => void;
  onPress: () => void;
}

export interface KeyboardNavOptions {
  /**
   * Which axis the arrow keys navigate along.
   * - `'horizontal'` (default) — Left/Right arrows
   * - `'vertical'`             — Up/Down arrows
   */
  direction?: 'horizontal' | 'vertical';

  /**
   * Whether focus wraps around at the ends of the list. Default: `true`.
   */
  wrap?: boolean;

  /** Called when the Escape key is pressed. */
  onEscape?: () => void;
}

/**
 * Lightweight keyboard-navigation manager for menus and overlays.
 *
 * ## Developer usage (3 steps)
 *
 * 1. Create an instance and register focusable items with `add()`.
 * 2. Call `nav.update()` inside the screen / overlay's `update()` method.
 * 3. Call `nav.enable()` once the screen has finished its entrance animation,
 *    and `nav.disable()` before its exit animation begins.
 *    Call `nav.reset()` in the screen's `reset()` method to clean up.
 *
 * @example
 * // In an AppScreen / overlay:
 * private _nav = new KeyboardNav({ onEscape: () => this.close() });
 *
 * async show() {
 *   await animate(...);
 *   this._nav.enable();
 * }
 * async hide() {
 *   this._nav.disable();
 *   await animate(...);
 * }
 * update(_t: Ticker) {
 *   this._nav.update();
 * }
 * reset() {
 *   this._nav.reset();
 * }
 */
export class KeyboardNav {
  private _items: KeyboardNavItem[] = [];
  private _focusedIndex = 0;
  private _enabled = false;
  private _prev = { prev: false, next: false, confirm: false, escape: false };

  constructor(private _options: KeyboardNavOptions = {}) {}

  /**
   * Register a focusable item. Items are navigated in registration order.
   * The first registered item automatically receives `onFocus()`.
   */
  add(item: KeyboardNavItem): void {
    const isFirst = this._items.length === 0;
    this._items.push(item);
    if (isFirst) item.onFocus?.();
  }

  /** Start responding to keyboard input. */
  enable(): void {
    this._enabled = true;
  }

  /** Stop responding to keyboard input (focus visuals remain). */
  disable(): void {
    this._enabled = false;
  }

  /**
   * Remove all items, clear focus, and disable navigation.
   * Call this in the screen's `reset()` method *before* destroying UI elements,
   * so `onBlur` can safely clear filters / tints on live containers.
   */
  reset(): void {
    this._items[this._focusedIndex]?.onBlur?.();
    this._items = [];
    this._focusedIndex = 0;
    this._enabled = false;
    this._prev = { prev: false, next: false, confirm: false, escape: false };
  }

  /**
   * Poll keyboard state and fire navigation callbacks.
   * Must be called every frame from the screen / overlay's `update()`.
   */
  update(): void {
    if (!this._enabled || this._items.length === 0) return;

    const keys = InputDevice.keyboard.key;
    const isHorizontal = (this._options.direction ?? 'horizontal') === 'horizontal';

    const isPrev = isHorizontal ? !!keys.ArrowLeft : !!keys.ArrowUp;
    const isNext = isHorizontal ? !!keys.ArrowRight : !!keys.ArrowDown;
    const isConfirm = !!(keys.Enter || keys.Space);
    const isEscape = !!keys.Escape;

    if (isPrev && !this._prev.prev) this._move(-1);
    if (isNext && !this._prev.next) this._move(1);
    if (isConfirm && !this._prev.confirm) this._items[this._focusedIndex]?.onPress();
    if (isEscape && !this._prev.escape) this._options.onEscape?.();

    this._prev = { prev: isPrev, next: isNext, confirm: isConfirm, escape: isEscape };
  }

  /** Index of the currently focused item (-1 only if the list is empty). */
  get focusedIndex(): number {
    return this._items.length === 0 ? -1 : this._focusedIndex;
  }

  private _move(delta: -1 | 1): void {
    const count = this._items.length;
    this._items[this._focusedIndex]?.onBlur?.();

    if (this._options.wrap ?? true) {
      this._focusedIndex = ((this._focusedIndex + delta) % count + count) % count;
    } else {
      this._focusedIndex = Math.max(0, Math.min(count - 1, this._focusedIndex + delta));
    }

    this._items[this._focusedIndex]?.onFocus?.();
  }
}
