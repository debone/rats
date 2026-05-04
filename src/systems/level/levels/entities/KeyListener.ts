import { defineEntity } from '@/core/entity/scope';
import { useImmediateUpdate } from '@/hooks/hooks';
import { InputDevice } from 'pixijs-input-devices';

/** Keyboard codes supported by `pixijs-input-devices` on `InputDevice.keyboard.key`. */
export type KeyboardKeyCode = keyof typeof InputDevice.keyboard.key;

export interface KeyListenerProps {
  key: KeyboardKeyCode;
  onPress: () => void;
  debounceMs?: number;
}

/**
 * Per-binding edge state for debounced key handling.
 */
function useKeyListenerBindings(props: KeyListenerProps): void {
  const key = props.key;
  const debounceMs = props.debounceMs ?? 50;

  const onPress = props.onPress;

  let isDown = false;
  let lastDownTime = 0;

  useImmediateUpdate(() => {
    const pressed = InputDevice.keyboard.key[key];
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
export const KeyListener = defineEntity((props: KeyListenerProps) => {
  useKeyListenerBindings(props);

  return {};
});

export type KeyListenerEntity = ReturnType<typeof KeyListener>;
