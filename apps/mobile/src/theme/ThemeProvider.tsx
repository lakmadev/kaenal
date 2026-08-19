import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";

import { fonts, makePalette, radius, space, type Theme, type ThemeMode } from "./tokens";

interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  /** Current preference: "light" | "dark" | "system". */
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  children: ReactNode;
  /** Initial preference (e.g. rehydrated from storage in M2). Defaults to "system". */
  initialMode?: ThemeMode;
  /** Notified whenever the preference changes, so a store/adapter can persist it. */
  onModeChange?: (mode: ThemeMode) => void;
}

export function ThemeProvider({ children, initialMode = "system", onModeChange }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(initialMode);

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState(next);
      onModeChange?.(next);
    },
    [onModeChange],
  );

  const isDark = mode === "system" ? systemScheme === "dark" : mode === "dark";

  const value = useMemo<ThemeContextValue>(
    () => ({
      isDark,
      mode,
      setMode,
      theme: { palette: makePalette(isDark), fonts, space, radius },
    }),
    [isDark, mode, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Access the resolved theme + mode controls. Throws if used outside the provider. */
export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}

/** The common hook screens use — returns the resolved Theme (palette + tokens). */
export function useTheme(): Theme {
  return useThemeContext().theme;
}
