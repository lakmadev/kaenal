"use client";

import { useEffect } from "react";
import { usePreferences } from "@/hooks/use-preferences";
import { PREFS_CACHE_KEY } from "@/lib/theme";

/**
 * Applies the signed-in user's accent, density and keyboard-hint preferences to
 * <html> (CSS in `styles/preferences.css` keys off the attributes) and caches
 * them so the pre-paint script in `lib/theme.tsx` can apply them on the next
 * load without a flash. Renders nothing.
 */
export function PreferencesApplier(): null {
  const { data } = usePreferences();

  // Effect is required: <html> lives outside React, so this syncs an external
  // system (the document element and localStorage) with query data.
  useEffect(() => {
    if (data === undefined) return;
    const root = document.documentElement;
    root.setAttribute("data-accent", data.accent);
    root.setAttribute("data-density", data.density);
    root.setAttribute("data-hints", data.showKeyboardHints ? "on" : "off");
    try {
      localStorage.setItem(
        PREFS_CACHE_KEY,
        JSON.stringify({ accent: data.accent, density: data.density, hints: data.showKeyboardHints }),
      );
    } catch {
      /* private mode: applied for this session only */
    }
  }, [data]);

  return null;
}
