// Kaenal mobile — design tokens.
// Ported verbatim from the binding design kit (project_brain/mobile/src/mobile-kit.jsx
// `mkTheme`), which itself mirrors the web `styles/tokens.css` (ink accent, Archivo,
// zinc neutrals). The palette is resolved per theme (light/dark) and threaded through
// `ThemeProvider` as `theme` — swap the palette and the whole tree recolors, which is
// exactly what "easy theme switching later" needs.

export type ThemeMode = "light" | "dark" | "system";

/** Font-family names. Loaded via expo-font in the app root; see `theme/fonts.ts`. */
export const fonts = {
  sans: "Archivo_400Regular",
  sansMedium: "Archivo_500Medium",
  sansSemibold: "Archivo_600SemiBold",
  sansBold: "Archivo_700Bold",
  mono: "JetBrainsMono_500Medium",
} as const;

/** 4px base spacing scale. */
export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

/** Tight radii, matching tokens.css `--r-sm … --r-2xl` + full pill. */
export const radius = {
  sm: 3,
  md: 6,
  lg: 9,
  xl: 12,
  "2xl": 16,
  full: 999,
} as const;

export interface Palette {
  dark: boolean;
  bg: string;
  bgSubtle: string;
  surface: string;
  raised: string;
  border: string;
  borderStrong: string;
  text: string;
  muted: string;
  subtle: string;
  accent: string;
  accentHover: string;
  accentFg: string;
  accentSoft: string;
  ring: string;
  success: string;
  successBg: string;
  successFg: string;
  warn: string;
  warnBg: string;
  warnFg: string;
  danger: string;
  dangerBg: string;
  dangerFg: string;
  info: string;
  infoBg: string;
}

/** Resolve the palette for a light or dark theme. */
export function makePalette(dark: boolean): Palette {
  return {
    dark,
    bg: dark ? "#131315" : "#f4f4f5",
    bgSubtle: dark ? "#1c1c1f" : "#ececee",
    surface: dark ? "#1e1e21" : "#ffffff",
    raised: dark ? "#26262a" : "#ffffff",
    border: dark ? "#2e2e33" : "#e4e4e7",
    borderStrong: dark ? "#3f3f45" : "#d4d4d8",
    text: dark ? "#f4f4f5" : "#18181b",
    muted: dark ? "#a1a1aa" : "#6b7280",
    subtle: dark ? "#71717a" : "#a1a1aa",
    accent: dark ? "#fafafa" : "#18181b",
    accentHover: dark ? "#d4d4d8" : "#3f3f46",
    accentFg: dark ? "#18181b" : "#ffffff",
    accentSoft: dark ? "rgba(250,250,250,0.10)" : "#f1f1f3",
    ring: dark ? "rgba(250,250,250,0.28)" : "rgba(24,24,27,0.16)",
    success: "#16a34a",
    successBg: dark ? "rgba(34,197,94,0.16)" : "#f0fdf4",
    successFg: dark ? "#4ade80" : "#15803d",
    warn: "#d97706",
    warnBg: dark ? "rgba(245,158,11,0.16)" : "#fffbeb",
    warnFg: dark ? "#fbbf24" : "#b45309",
    danger: "#dc2626",
    dangerBg: dark ? "rgba(239,68,68,0.16)" : "#fef2f2",
    dangerFg: dark ? "#f87171" : "#b91c1c",
    info: dark ? "#93c5fd" : "#1d4ed8",
    infoBg: dark ? "rgba(59,130,246,0.16)" : "#eff6ff",
  };
}

export interface Theme {
  palette: Palette;
  fonts: typeof fonts;
  space: typeof space;
  radius: typeof radius;
}
