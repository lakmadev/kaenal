import { ShieldCheck } from "lucide-react";
import { Chip } from "@/components/ui";

/**
 * Model governance disclosure (P5, DESIGN-03B-predictive.md §2.3) — replaces
 * the jsx's "Tune model" header button (`predictive.jsx` line 193), a fake
 * permission-gated `kToast` (CLAUDE.md rule 10: never fake a feature). No
 * spec describes a real tuning surface and §3B's v1 has no tunable
 * parameters, so the control is removed rather than disabled (a disabled
 * button would falsely imply someone has this capability). Static 4-field
 * `DetailRow`-style panel below the model banner, neutral "Read-only" chip,
 * no button, no chevron, no hover state.
 */
export function GovernancePanel(): React.ReactElement {
  const rows: { label: string; value: string }[] = [
    { label: "Model & version", value: "NC-Forecast v1 (statistical baseline)" },
    { label: "Retrain cadence", value: "Recomputed nightly (predict-risk.sweep)" },
    { label: "Inputs", value: "Trailing 6-month NC volume by production line / supplier" },
    { label: "Tunable parameters", value: "None" },
  ];

  return (
    <div className="k-surface mb-6">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span
            className="inline-flex shrink-0 items-center justify-center rounded-lg p-1.5"
            style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}
          >
            <ShieldCheck size={14} />
          </span>
          <span className="text-[13px] font-semibold">Model governance</span>
        </div>
        <Chip bg="var(--bg-subtle)" fg="var(--text-muted)">
          Read-only
        </Chip>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 px-4 py-3.5 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-subtle">{r.label}</dt>
            <dd className="mt-0.5 text-[12.5px] text-text">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
