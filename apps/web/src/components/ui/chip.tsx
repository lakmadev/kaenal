import { cn } from "@/lib/cn";

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** A leading dot in this colour (status semantics without relying on colour alone). */
  dot?: string;
  bg?: string;
  fg?: string;
}

/**
 * Base pill/badge (the `.k-chip` token class). Colour is passed in because chip
 * palettes are semantic maps (status/priority/risk) — see {@link ../ui/badge}.
 * Text is always present, so colour is never the only signal (04 §8).
 */
export function Chip({ dot, bg, fg, className, style, children, ...props }: ChipProps): React.ReactElement {
  return (
    <span
      className={cn("k-chip", className)}
      style={{ ...(bg !== undefined ? { background: bg } : {}), ...(fg !== undefined ? { color: fg } : {}), ...style }}
      {...props}
    >
      {dot !== undefined && (
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot }} aria-hidden />
      )}
      {children}
    </span>
  );
}
