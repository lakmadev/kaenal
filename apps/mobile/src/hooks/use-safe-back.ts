import { useRouter, type Href } from "expo-router";
import { useCallback } from "react";

/**
 * A back handler that always goes somewhere. `router.back()` is a silent no-op
 * when there is nothing to pop — a screen opened from a deep link / notification,
 * reached after a `router.replace`, or sitting as a navigator's entry route — so
 * a bare `onPress={() => router.back()}` leaves the user stuck. This pops when it
 * can and otherwise `replace`s to a sensible parent, so every back affordance
 * works from every entry point.
 */
export function useSafeBack(fallback: Href = "/(app)/home"): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  }, [router, fallback]);
}
