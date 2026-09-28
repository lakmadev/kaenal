import { ArrowRight, X } from "lucide-react";
import type { EntityKind, NodeDto } from "@kaenal/types";
import { StatusBadge } from "@/components/ui";
import { GRAPH_KINDS, GRAPH_NODE_KINDS, fmt } from "./graph-kinds";
import type { NeighborTotals } from "./graph-types";

/** Detail drawer (jsx 546-606): header, fields grid, connections list, footer CTA. No synthetic-footer branch — G3 ships no synthetic data. */
export function GraphDetailDrawer({
  node,
  neighborTotals,
  onClose,
  onExpandType,
  onOpenFullRecord,
}: {
  node: NodeDto;
  neighborTotals: NeighborTotals;
  onClose: () => void;
  onExpandType: (kind: EntityKind) => void;
  onOpenFullRecord: () => void;
}): React.ReactElement {
  const meta = GRAPH_KINDS[node.kind];
  const groups = GRAPH_NODE_KINDS.map((kind) => ({ kind, totals: neighborTotals[kind] }))
    .filter((g): g is { kind: EntityKind; totals: { total: number; onCanvas: number } } => g.totals !== undefined)
    .sort((a, b) => GRAPH_KINDS[a.kind].layer - GRAPH_KINDS[b.kind].layer);
  const totalConns = groups.reduce((s, g) => s + g.totals.total, 0);
  const Icon = meta.icon;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        width: 372,
        background: "var(--surface)",
        borderLeft: "1px solid var(--border)",
        boxShadow: "var(--shadow-xl)",
        display: "flex",
        flexDirection: "column",
        zIndex: 30,
      }}
    >
      <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: "var(--r-md)", background: meta.soft, color: meta.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon size={19} strokeWidth={2} aria-hidden />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: meta.color }}>{meta.label}</div>
            <div className="mono" style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)", marginTop: 1 }}>
              {node.fields.find((f) => f.label === "Code")?.value ?? node.id}
            </div>
          </div>
          <button type="button" onClick={onClose} className="k-btn-plain" style={{ padding: 6, borderRadius: "var(--r-md)", display: "flex" }} aria-label="Close">
            <X size={16} strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, marginTop: 10 }}>{node.title}</div>
        {node.status !== null && (
          <div style={{ marginTop: 8 }}>
            <StatusBadge status={node.status} />
          </div>
        )}
      </div>

      <div style={{ flex: 1, padding: "16px 18px", minHeight: 0, overflowY: "auto" }}>
        {node.summary !== null && <p style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5, margin: "0 0 16px" }}>{node.summary}</p>}
        <div className="k-overline" style={{ marginBottom: 8 }}>
          Details
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px", marginBottom: 20 }}>
          {node.fields.map((f, i) => (
            <div key={i}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, color: "var(--text-subtle)" }}>{f.label}</div>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text)", marginTop: 1 }}>{f.value}</div>
            </div>
          ))}
        </div>

        <div className="k-overline" style={{ marginBottom: 8 }}>
          Connections · {fmt(totalConns)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {groups.length === 0 && <div style={{ fontSize: 12, color: "var(--text-subtle)" }}>No linked records.</div>}
          {groups.map(({ kind, totals }) => {
            const ot = GRAPH_KINDS[kind];
            const OtIcon = ot.icon;
            return (
              <button
                key={kind}
                type="button"
                onClick={() => onExpandType(kind)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--border)", background: "var(--surface)", textAlign: "left", width: "100%" }}
              >
                <div style={{ width: 26, height: 26, borderRadius: "var(--r-sm)", background: ot.soft, color: ot.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <OtIcon size={14} strokeWidth={2} aria-hidden />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>
                    {ot.label}
                    {totals.total !== 1 ? "s" : ""}
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{totals.onCanvas > 0 ? `${totals.onCanvas} on graph · ` : ""}reveal on graph</div>
                </div>
                <span className="k-chip mono" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}>
                  {fmt(totals.total)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)" }}>
        <button type="button" className="k-btn k-btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={onOpenFullRecord}>
          Open full record <ArrowRight size={15} strokeWidth={2} aria-hidden />
        </button>
      </div>
    </div>
  );
}
