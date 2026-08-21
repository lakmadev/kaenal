import { type ReactNode, useRef } from "react";
import {
  Animated,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { tapLight, tapMedium, tapSelection } from "@/services/haptics";
import { PRESS_OPACITY, PRESS_SCALE, PRESS_SPRING, useReduceMotion } from "./motion";

type HapticKind = "light" | "medium" | "selection" | "none";

export interface TouchableProps extends Omit<PressableProps, "style" | "children"> {
  children?: ReactNode | ((state: { pressed: boolean }) => ReactNode);
  style?: StyleProp<ViewStyle>;
  /** Haptic played on press-in. "light" (default) suits rows/cards; "medium" a
   *  primary action; "selection" a tab/chip; "none" opts out. */
  haptic?: HapticKind;
  /** Scale while held; pass 1 to keep size fixed (e.g. a full-width bar). */
  pressedScale?: number;
}

function fireHaptic(kind: HapticKind): void {
  if (kind === "light") tapLight();
  else if (kind === "medium") tapMedium();
  else if (kind === "selection") tapSelection();
}

/**
 * The app's standard pressable. Instead of an instant opacity flip, it springs a
 * subtle scale + opacity on press (native driver → smooth on the UI thread) and
 * plays a haptic on touch-down, so every tap feels responsive rather than snappy.
 * Honours "reduce motion" (skips the spring) and the user's haptics preference.
 */
export function Touchable({
  children,
  style,
  haptic = "light",
  pressedScale = PRESS_SCALE,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: TouchableProps) {
  const reduce = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  function spring(toScale: number, toOpacity: number): void {
    Animated.spring(scale, { toValue: toScale, useNativeDriver: true, ...PRESS_SPRING }).start();
    Animated.spring(opacity, { toValue: toOpacity, useNativeDriver: true, ...PRESS_SPRING }).start();
  }

  function handleIn(e: GestureResponderEvent): void {
    if (!disabled) {
      fireHaptic(haptic);
      if (!reduce) spring(pressedScale, PRESS_OPACITY);
    }
    onPressIn?.(e);
  }
  function handleOut(e: GestureResponderEvent): void {
    if (!reduce) spring(1, 1);
    onPressOut?.(e);
  }

  return (
    <Pressable disabled={disabled} onPressIn={handleIn} onPressOut={handleOut} {...rest}>
      {(state) => (
        <Animated.View style={[{ transform: [{ scale }], opacity }, style]}>
          {typeof children === "function" ? children(state) : children}
        </Animated.View>
      )}
    </Pressable>
  );
}
