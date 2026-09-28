import type { GraphSeedDto } from "@kaenal/types";
import { GRAPH_KINDS } from "./graph-kinds";

/**
 * "Start from a record" seed chips (jsx `SEEDS`, lines 242-247 + 419-424).
 * Real data from `GET /v1/graph/seeds` (G2 AC1) — a kind with zero live
 * records is simply absent from `seeds`, never a broken chip (G3).
 */
export function GraphSeedPicker({
  seeds,
  onPick,
}: {
  seeds: readonly GraphSeedDto[];
  onPick: (seed: GraphSeedDto) => void;
}): React.ReactElement | null {
  if (seeds.length === 0) return null;
  return (
    <>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-subtle)",
          marginBottom: 8,
        }}
      >
        Start from a record
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", maxWidth: 560 }}>
        {seeds.map((s) => {
          const meta = GRAPH_KINDS[s.kind];
          return (
            <button
              key={`${s.kind}:${s.id}`}
              type="button"
              onClick={() => onPick(s)}
              className="k-btn-ghost"
              style={{ height: 34, padding: "0 12px", borderRadius: "var(--r-md)", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 500 }}
            >
              <span style={{ width: 9, height: 9, borderRadius: 3, background: meta.color }} aria-hidden />
              {s.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
