"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Theme (04 §2). Light/dark is a `data-theme` attribute on `<html>`, persisted
 * per user. The initial value is set by a blocking inline script in the root
 * layout (before paint) to avoid a flash; this provider keeps React state in
 * sync and persists changes. Accent/density preferences (also per-user, from
 * `GET /v1/me`) slot in here later the same way.
 */
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "kaenal-theme";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitialTheme(): Theme {
  if (typeof document === "undefined") return "light";
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);

  const apply = useCallback((next: Theme) => {
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* private mode: fall back to in-memory only */
    }
    setThemeState(next);
  }, []);

  // Reconcile once on mount in case the pre-hydration script and state diverged.
  useEffect(() => {
    setThemeState(readInitialTheme());
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: apply,
      toggleTheme: () => apply(theme === "dark" ? "light" : "dark"),
    }),
    [theme, apply],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx === null) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}

/**
 * Blocking script injected into <head> so `data-theme` is correct before first
 * paint (no flash of the wrong theme). Kept tiny and dependency-free.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;
