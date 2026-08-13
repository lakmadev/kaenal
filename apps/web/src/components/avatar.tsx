/**
 * A person avatar: initials on a stable per-person tint. Names resolve through
 * the members directory (`useMemberLookup`); when a name is unknown we still
 * render a neutral placeholder rather than leaking a raw id. Mirrors the
 * prototype's `Avatar` — a coloured initials disc — since no photo pipeline
 * exists yet.
 */
export function Avatar({ name, size = 24 }: { name?: string | null | undefined; size?: number }): React.ReactElement {
  const initials = name
    ? name
        .split(/\s+/)
        .slice(0, 2)
        .map((s) => s[0] ?? "")
        .join("")
        .toUpperCase()
    : "·";
  const hue = hashHue(name ?? "");
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `hsl(${hue} 52% 90%)`,
        color: `hsl(${hue} 45% 32%)`,
        fontSize: Math.round(size * 0.4),
        fontWeight: 700,
        letterSpacing: "-0.02em",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {initials}
    </span>
  );
}

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}
