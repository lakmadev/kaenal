import { Check, GitBranch, Search, Sparkles, X, Zap } from "lucide-react";
import { fmt } from "./graph-kinds";
import type { WhyResult } from "./graph-types";

export interface QueryChip {
  readonly id: string;
  readonly chip: string;
}

/**
 * Query bar (jsx 364-406): search input + Ask + 4 canned-query chips in the
 * default state, or interpreted chips + summary + truncated warning + "Why
 * these results" toggle + Clear once a query has run.
 */
export function GraphQueryBar({
  totalIndexed,
  shownCount,
  query,
  onQueryChange,
  onAsk,
  queries,
  onRunChip,
  result,
  showWhy,
  onToggleWhy,
  onClear,
  disabled = false,
}: {
  totalIndexed: string;
  shownCount: number;
  query: string;
  onQueryChange: (v: string) => void;
  onAsk: () => void;
  queries: readonly QueryChip[];
  onRunChip: (id: string) => void;
  result: WhyResult | null;
  showWhy: boolean;
  onToggleWhy: () => void;
  onClear: () => void;
  disabled?: boolean;
}): React.ReactElement {
  return (
    <div style={{ padding: "18px 28px 14px", borderBottom: "1px solid var(--border)", background: "var(--surface)", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <GitBranch size={18} strokeWidth={1.9} style={{ color: "var(--accent)" }} aria-hidden />
        <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em", margin: 0 }}>Knowledge graph</h1>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Query-first explorer across every quality module.</span>
        <span className="k-chip mono" style={{ marginLeft: "auto", background: "var(--bg-subtle)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
          {totalIndexed}
        </span>
        {shownCount > 0 && (
          <span className="k-chip" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            Showing {shownCount}
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", maxWidth: 920 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--accent)", display: "flex" }}>
            <Sparkles size={16} strokeWidth={1.9} aria-hidden />
          </span>
          <label htmlFor="graph-query-input" className="sr-only">
            Ask the knowledge graph
          </label>
          <input
            id="graph-query-input"
            value={query}
            disabled={disabled}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onAsk();
            }}
            placeholder="show all NCs from supplier X that triggered a D8 in the last year"
            className="k-input"
            style={{ width: "100%", height: 44, padding: "0 14px 0 40px", borderRadius: "var(--r-lg)" }}
          />
        </div>
        <button type="button" className="k-btn k-btn-primary" style={{ height: 44, padding: "0 18px", borderRadius: "var(--r-lg)" }} onClick={onAsk} disabled={disabled}>
          <Sparkles size={15} strokeWidth={2} aria-hidden /> Ask
        </button>
      </div>

      {result === null ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11.5, color: "var(--text-subtle)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>Try</span>
          {queries.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => onRunChip(q.id)}
              disabled={disabled}
              style={{
                fontSize: 12.5,
                fontWeight: 500,
                color: "var(--text)",
                background: "var(--bg-subtle)",
                border: "1px solid var(--border)",
                padding: "6px 12px",
                borderRadius: "var(--r-full)",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Search size={12} strokeWidth={2} aria-hidden /> {q.chip}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Interpreted as</span>
          {result.interpreted.map((t, i) => (
            <span
              key={i}
              className="mono"
              style={{ fontSize: 11.5, color: "var(--text)", background: "var(--bg-subtle)", border: "1px solid var(--border)", padding: "3px 8px", borderRadius: "var(--r-sm)" }}
            >
              {t}
            </span>
          ))}
          <span style={{ width: 1, height: 18, background: "var(--border)" }} aria-hidden />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>
            <Check size={13} strokeWidth={2.5} style={{ color: "var(--success-600)", verticalAlign: "-2px", marginRight: 4 }} aria-hidden />
            {result.summary}
          </span>
          {result.truncated && (
            <span className="k-chip" style={{ background: "var(--warning-50)", color: "var(--warning-700)", border: "1px solid var(--warning-100)" }}>
              showing first {fmt(shownCount)} — refine to narrow
            </span>
          )}
          <button
            type="button"
            onClick={onToggleWhy}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "5px 11px",
              borderRadius: "var(--r-full)",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: showWhy ? "var(--accent)" : "var(--accent-soft)",
              color: showWhy ? "white" : "var(--accent)",
              border: `1px solid ${showWhy ? "var(--accent)" : "transparent"}`,
            }}
          >
            <Zap size={12} strokeWidth={2} aria-hidden /> Why these results
          </button>
          <button type="button" onClick={onClear} className="k-btn-plain" style={{ fontSize: 12, fontWeight: 500, padding: "5px 10px", borderRadius: "var(--r-md)", display: "inline-flex", alignItems: "center", gap: 5 }}>
            <X size={13} strokeWidth={2} aria-hidden /> Clear
          </button>
        </div>
      )}
    </div>
  );
}
