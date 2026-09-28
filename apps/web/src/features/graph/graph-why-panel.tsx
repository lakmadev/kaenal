import { Zap } from "lucide-react";

/** "Why these results" numbered-steps panel (jsx 528-544). Shifts left when the detail drawer is open (jsx's `right: sel ? 388 : 16`). */
export function GraphWhyPanel({ steps, drawerOpen }: { steps: readonly string[]; drawerOpen: boolean }): React.ReactElement {
  return (
    <div
      style={{
        position: "absolute",
        right: drawerOpen ? 388 : 16,
        bottom: 16,
        width: 336,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        boxShadow: "var(--shadow-lg)",
        padding: "14px 16px",
        transition: "right 200ms",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 26, height: 26, borderRadius: "var(--r-md)", background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Zap size={14} strokeWidth={2} aria-hidden />
        </div>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Why these results</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 9 }}>
            <span
              className="mono"
              style={{
                width: 18,
                height: 18,
                flexShrink: 0,
                borderRadius: "50%",
                background: "var(--accent)",
                color: "white",
                fontSize: 10.5,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 1,
              }}
            >
              {i + 1}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
