import { Sparkles } from "lucide-react";

const PRED_ACTUAL = "var(--text-muted)";
const PRED_FORE = "#d97706";
const PRED_FORE_FILL = "rgba(217,119,6,0.13)";

/**
 * Model banner + legend (`predictive.jsx` 213-237). Copy corrected per §3B —
 * ships the real v1 baseline description, never the jsx's fabricated
 * "v3 gradient-boosted / 91% backtested" language. Layout/icon/legend markup
 * unchanged from the jsx.
 */
export function ModelBanner(): React.ReactElement {
  return (
    <div className="k-surface mb-4 flex flex-wrap items-center gap-4 p-3.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className="inline-flex shrink-0 items-center justify-center rounded-lg p-1.5"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          <Sparkles size={15} />
        </span>
        <div className="min-w-0">
          <div className="text-[12.5px] font-semibold">NC-Forecast v1 · statistical baseline (trend + seasonal-naive)</div>
          <div className="text-[11px] text-muted">Recomputed nightly · feature: trailing NC volume by area/supplier</div>
        </div>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <svg width={22} height={8} aria-hidden>
            <line x1={1} y1={4} x2={21} y2={4} stroke={PRED_ACTUAL} strokeWidth={2} />
          </svg>
          Actual
        </span>
        <span className="flex items-center gap-1.5">
          <svg width={22} height={8} aria-hidden>
            <line x1={1} y1={4} x2={21} y2={4} stroke={PRED_FORE} strokeWidth={2} strokeDasharray="4 2.5" />
          </svg>
          Predicted
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block rounded-sm"
            style={{ width: 16, height: 10, background: PRED_FORE_FILL, border: `1px solid ${PRED_FORE}55` }}
            aria-hidden
          />
          80% band
        </span>
        <span className="flex items-center gap-1.5">
          <svg width={10} height={12} aria-hidden>
            <line x1={5} y1={0} x2={5} y2={12} stroke="var(--border-strong)" strokeWidth={1} strokeDasharray="2 2" />
          </svg>
          Now
        </span>
      </div>
    </div>
  );
}
