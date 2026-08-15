import { Text as RNText, type TextProps as RNTextProps } from "react-native";

import { useTheme } from "../theme";
import type { Palette, Theme } from "../theme";

export type TextWeight = "regular" | "medium" | "semibold" | "bold";
export type TextTone = "text" | "muted" | "subtle" | "accent" | "inverse";

function fontFor(fonts: Theme["fonts"], weight: TextWeight): string {
  switch (weight) {
    case "bold":
      return fonts.sansBold;
    case "semibold":
      return fonts.sansSemibold;
    case "medium":
      return fonts.sansMedium;
    default:
      return fonts.sans;
  }
}

function colorFor(palette: Palette, tone: TextTone): string {
  switch (tone) {
    case "muted":
      return palette.muted;
    case "subtle":
      return palette.subtle;
    case "accent":
      return palette.accent;
    case "inverse":
      return palette.accentFg;
    default:
      return palette.text;
  }
}

export interface TextProps extends RNTextProps {
  size?: number;
  weight?: TextWeight;
  tone?: TextTone;
  color?: string;
}

/** Themed text — always uses the Archivo faces + a palette tone. */
export function Text({ size = 14, weight = "regular", tone = "text", color, style, ...rest }: TextProps) {
  const { palette, fonts } = useTheme();
  return (
    <RNText
      {...rest}
      style={[
        { fontFamily: fontFor(fonts, weight), fontSize: size, color: color ?? colorFor(palette, tone) },
        style,
      ]}
    />
  );
}

/** Monospace text for record codes (NCR-2026-0142) and timestamps. */
export function Mono({ size = 12, tone = "text", color, style, ...rest }: TextProps) {
  const { palette, fonts } = useTheme();
  return (
    <RNText
      {...rest}
      style={[{ fontFamily: fonts.mono, fontSize: size, color: color ?? colorFor(palette, tone) }, style]}
    />
  );
}
