import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Shared motion vocabulary so every interaction moves the same way instead of
 * snapping. Press micro-interactions run on the native driver (UI thread), so
 * they stay smooth even while JS is busy.
 */

/** The scale a pressable settles to while held — a subtle push-in, not a shrink. */
export const PRESS_SCALE = 0.965;
/** The opacity a pressable settles to while held. */
export const PRESS_OPACITY = 0.9;

/** Spring for press in/out — quick, lightly damped, no wobble. */
export const PRESS_SPRING = { stiffness: 380, damping: 26, mass: 0.9 } as const;

/** Timing durations (ms) for non-spring transitions. */
export const DURATION = { fast: 120, base: 200, slow: 320 } as const;

/**
 * The OS "reduce motion" accessibility setting, live. Callers skip scale/spring
 * animation when it's on (matching the existing Skeleton behaviour) and fall back
 * to an instant, still-legible state change.
 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduce(v));
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}
