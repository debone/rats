import { defineEntity, getUnmount } from '@/core/entity/scope';
import { ENTITY_KINDS, type EntityBase } from '@/entities/entity-kinds';
import { useImmediateUpdate } from '@/hooks/hooks';
import { InputDevice } from 'pixijs-input-devices';

/** Keyboard codes supported by `pixijs-input-devices` on `InputDevice.keyboard.key`. */
export type KeyboardKeyCode = keyof typeof InputDevice.keyboard.key;

export interface KeyListenerProps {
  key: KeyboardKeyCode;
  onPress: () => void;
  debounceMs?: number;
}

export interface KeyListenerEntity extends EntityBase<typeof ENTITY_KINDS.keyListener> {
  destroy(): void;
}

/**
 * Per-binding edge state for debounced key handling.
 */
function useKeyListenerBindings(props: KeyListenerProps): void {
  const key = props.key;
  const debounceMs = props.debounceMs ?? 50;

  const pressed = InputDevice.keyboard.key[key];
  const onPress = props.onPress;

  let isDown = false;
  let lastDownTime = 0;

  useImmediateUpdate(() => {
    if (pressed && !isDown) {
      isDown = true;
      lastDownTime = performance.now();
      onPress();
    } else if (!pressed && isDown) {
      if (performance.now() - lastDownTime > debounceMs) {
        isDown = false;
      }
    }
  });
}

/**
 * Generic edge-triggered keyboard listener (debounced release).
 */
export const KeyListener = defineEntity((props: KeyListenerProps): KeyListenerEntity => {
  useKeyListenerBindings(props);

  const unmount = getUnmount();

  return {
    kind: ENTITY_KINDS.keyListener,
    destroy() {
      unmount();
    },
  };
});
