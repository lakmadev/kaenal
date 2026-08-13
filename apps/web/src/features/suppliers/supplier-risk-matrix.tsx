"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Grid3x3 } from "lucide-react";
import type { SupplierDto } from "@kaenal/types";
import { Card, EmptyState } from "@/components/ui";
import { RISK_TIER, RiskTierBadge, SupplierLogo, tierOf, profileNum } from "./suppliers-bits";

const W = 760;
const H = 440;
const PAD = { l: 60, r: 24, t: 24, b: 40 };

/** Grade → composite-score band the jsx cuts the plot at (A ≥ 90 … C ≥ 60). */
const CUT = { A: 90, B: 75, C: 60 };

export function SupplierRiskMatrix({ suppliers }: { suppliers: SupplierDto[] }): React.ReactElement {
  const router = useRouter();
  const [hover, setHover] = useState<SupplierDto | null>(null);

  // Only score-bearing suppliers can be plotted on the quality axis.
  const scored = useMemo(() => suppliers.filter((s) => s.score !== null), [suppliers]);

  const spends = scored.map((s) => profileNum(s.profile, "spendYtd")).filter((v): v is number => v !== null && v > 0);
  const hasSpend = new Set(spends).size >= 2;

  const layout = useMemo(() => {
    const xLog = (s: SupplierDto): number => {
      const v = profileNum(s.profile, "spendYtd");
      return v !== null && v > 0 ? Math.log10(v / 1000) : 0;
    };
    const xs = scored.map(xLog);
    const xMin = Math.min(...xs, 0) - 0.2;
    const xMax = Math.max(...xs, 1) + 0.2;
    const xRange = xMax - xMin || 1;

    return scored.map((s, i) => {
      // Fall back to even horizontal spacing when spend isn't populated, so the
      // plot never collapses to a single vertical line.
      const fx = hasSpend
        ? PAD.l + ((xLog(s) - xMin) / xRange) * (W - PAD.l - PAD.r)
        : PAD.l + ((i + 0.5) / Math.max(scored.length, 1)) * (W - PAD.l - PAD.r);
      const score = s.score ?? 0;
      const fy = PAD.t + ((100 - score) / 100) * (H - PAD.t - PAD.b);
      const parts = profileNum(s.profile, "partsPerMonth");
      const r = Math.max(9, Math.min(28, Math.sqrt((parts ?? 1000) / 1000) * 1.5));
      return { s, x: fx, y: fy, r, color: RISK_TIER[tierOf(s.riskTier)].dot };
    });
  }, [scored, hasSpend]);

  const py = (score: number): number => PAD.t + ((100 - score) / 100) * (H - PAD.t - PAD.b);

  if (scored.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Grid3x3}
          title="No scored suppliers to plot"
          body="Suppliers need scorecard metrics before they appear on the risk matrix."
        />
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:[grid-template-columns:1fr_280px]">
      <Card className="p-5">
        <h3 className="text-[15px] font-semibold text-text">Risk × spend</h3>
        <p className="mb-2 text-[12px] text-muted">
          Composite quality score vs spend. Upper band = healthy; lower band = priority.
          {!hasSpend && " Spend isn't populated yet — bubbles are spaced evenly on X."}
        </p>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
          {/* Grade band guide-lines (A/B/C composite cuts) */}
          {(["A", "B", "C"] as const).map((g) => {
            const y = py(CUT[g]);
            return (
              <g key={g}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="var(--border)" strokeWidth="1" strokeDasharray="3,3" />
                <text x={PAD.l - 8} y={y + 3} fontSize="10" fill="var(--text-muted)" textAnchor="end">
                  {g}
                </text>
              </g>
            );
          })}
          {/* Axes */}
          <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="var(--border)" />
          <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={H - PAD.b} stroke="var(--border)" />
          <text x={(W + PAD.l - PAD.r) / 2} y={H - 8} fontSize="11" fill="var(--text-muted)" textAnchor="middle">
            {hasSpend ? "Spend (log scale, $k YTD →)" : "Suppliers"}
          </text>
          <text
            x={14}
            y={(H - PAD.b + PAD.t) / 2}
            fontSize="11"
            fill="var(--text-muted)"
            transform={`rotate(-90 14 ${(H - PAD.b + PAD.t) / 2})`}
            textAnchor="middle"
          >
            Composite quality score ↑
          </text>
          {/* Bubbles */}
          {layout.map(({ s, x, y, r, color }) => (
            <g
              key={s.id}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHover(s)}
              onMouseLeave={() => setHover(null)}
              onClick={() => router.push(`/suppliers/${s.id}`)}
            >
              <circle cx={x} cy={y} r={r} fill={color} fillOpacity={0.4} stroke={color} strokeWidth="1.5" />
              <text x={x} y={y + 3} fontSize="9" fill={color} fontWeight="700" textAnchor="middle">
                {s.code.replace(/[^A-Za-z0-9]/g, "").slice(-4)}
              </text>
            </g>
          ))}
        </svg>
      </Card>

      <Card className="h-fit p-4">
        <h3 className="mb-2 text-[14px] font-semibold text-text">Hovering</h3>
        {hover === null ? (
          <p className="py-6 text-center text-[11.5px] text-muted">Hover a bubble to see details</p>
        ) : (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <SupplierLogo name={hover.name} code={hover.code} profile={hover.profile} size={32} />
              <div>
                <div className="text-[13px] font-semibold">{hover.name}</div>
                <div className="text-[11px] text-muted">{hover.category ?? "—"}</div>
              </div>
            </div>
            <RiskTierBadge riskTier={hover.riskTier} />
            <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-[11px]">
              <Metric label="Score" value={hover.score === null ? "—" : String(hover.score)} />
              <Metric label="PPM" value={hover.scorecard.ppm == null ? "—" : String(hover.scorecard.ppm)} />
              <Metric label="OTD" value={hover.scorecard.otd == null ? "—" : `${hover.scorecard.otd}%`} />
              <Metric
                label="Spend YTD"
                value={fmtSpend(profileNum(hover.profile, "spendYtd"))}
              />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div>
      <span className="text-muted">{label}</span>
      <div className="mono font-semibold">{value}</div>
    </div>
  );
}

function fmtSpend(v: number | null): string {
  if (v === null) return "—";
  return `$${(v / 1_000_000).toFixed(2)}M`;
}
