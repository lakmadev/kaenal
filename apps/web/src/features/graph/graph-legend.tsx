import { ChevronDown, ChevronRight, Filter } from "lucide-react";
import type { EntityKind } from "@kaenal/types";
import { GRAPH_KINDS, GRAPH_NODE_KINDS } from "./graph-kinds";

/** Legend / filter popover (jsx 504-526) — click a kind to hide/show it on the canvas. */
export function GraphLegend({
  open,
  onToggle,
  hidden,
  onToggleHidden,
}: {
  open: boolean;
  onToggle: () => void;
  hidden: Partial<Record<EntityKind, boolean>>;
  onToggleHidden: (kind: EntityKind) => void;
}): React.ReactElement {
  const anyHidden = Object.values(hidden).some(Boolean);
  return (
    <div style={{ position: "absolute", left: 16, top: 16, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
      <button
        type="button"
        onClick={onToggle}
        className="k-btn-ghost"
        style={{
          height: 34,
          padding: "0 12px",
          borderRadius: "var(--r-md)",
          boxShadow: "var(--shadow-sm)",
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          fontSize: 12.5,
          fontWeight: 600,
          color: open ? "var(--accent)" : "var(--text)",
          borderColor: open ? "var(--accent)" : "var(--border)",
        }}
        aria-expanded={open}
      >
        <Filter size={14} strokeWidth={2} aria-hidden /> Legend &amp; filters
        {anyHidden && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} aria-hidden />}
        {open ? <ChevronDown size={13} strokeWidth={2} style={{ color: "var(--text-muted)" }} aria-hidden /> : <ChevronRight size={13} strokeWidth={2} style={{ color: "var(--text-muted)" }} aria-hidden />}
      </button>
      {open && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-lg)", padding: "10px 12px", maxWidth: 210 }}>
          <div className="k-overline" style={{ marginBottom: 8, fontSize: 10 }}>
            Node types · click to filter
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {GRAPH_NODE_KINDS.map((k) => {
              const t = GRAPH_KINDS[k];
              const isHidden = hidden[k] === true;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => onToggleHidden(k)}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 4px", borderRadius: "var(--r-sm)", opacity: isHidden ? 0.4 : 1, textAlign: "left" }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: t.color, flexShrink: 0 }} aria-hidden />
                  <span style={{ fontSize: 12, color: "var(--text)", textDecoration: isHidden ? "line-through" : "none" }}>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
