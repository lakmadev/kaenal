"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trophy } from "lucide-react";
import { DEFAULT_SCORE_WEIGHTS } from "@kaenal/core";
import type { SupplierDto } from "@kaenal/types";
import { Card, EmptyState, Skeleton } from "@/components/ui";
import { useSupplierScorecard } from "@/hooks/use-suppliers";
import { RISK_TIER, SupplierLogo, KpiCell } from "./suppliers-bits";

/** The four weight axes, as integer percentages for the sliders. */
interface WeightPct {
  ppm: number;
  otd: number;
  oqe: number;
  scar: number;
}

const DEFAULT_PCT: WeightPct = {
  ppm: Math.round(DEFAULT_SCORE_WEIGHTS.ppm * 100),
  otd: Math.round(DEFAULT_SCORE_WEIGHTS.otd * 100),
  oqe: Math.round(DEFAULT_SCORE_WEIGHTS.oqe * 100),
  scar: Math.round(DEFAULT_SCORE_WEIGHTS.scar * 100),
};

const AXES: { key: keyof WeightPct; label: string }[] = [
  { key: "ppm", label: "PPM defects" },
  { key: "otd", label: "On-time delivery" },
  { key: "oqe", label: "Overall quality eval" },
  { key: "scar", label: "SCAR responsiveness" },
];

function gradeColor(grade: SupplierDto["grade"]): string {
  return grade === null ? "var(--text-muted)" : RISK_TIER[grade].fg;
}

export function SupplierScorecardsView(): React.ReactElement {
  const router = useRouter();
  const [pct, setPct] = useState<WeightPct>(DEFAULT_PCT);

  // Fractions the server re-ranks under. The query key includes the weights, so
  // moving a slider re-fetches a server-computed ranking (rule 5 — no client re-score).
  const query = useSupplierScorecard({
    wPpm: pct.ppm / 100,
    wOtd: pct.otd / 100,
    wOqe: pct.oqe / 100,
    wScar: pct.scar / 100,
  });

  const rows = useMemo(() => query.data?.items ?? [], [query.data]);
  const total = pct.ppm + pct.otd + pct.oqe + pct.scar;
  const isDefault = AXES.every((a) => pct[a.key] === DEFAULT_PCT[a.key]);

  return (
    <div className="grid gap-4 lg:[grid-template-columns:280px_1fr]">
      <Card className="h-fit p-4">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-text">Scoring weights</h3>
          {!isDefault && (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-text"
              onClick={() => setPct(DEFAULT_PCT)}
            >
              <RotateCcw size={11} /> Reset
            </button>
          )}
        </div>
        <p className="mb-3 text-[11.5px] text-muted">
          The server re-ranks under these weights — the composite is never persisted, so any weighting is a read.
        </p>
        <div className="flex flex-col gap-3.5">
          {AXES.map((a) => (
            <div key={a.key}>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-[12.5px] font-medium">{a.label}</span>
                <span className="mono text-[12px] text-muted">{pct[a.key]}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={pct[a.key]}
                onChange={(e) => setPct((p) => ({ ...p, [a.key]: Number(e.target.value) }))}
                className="w-full"
                aria-label={`${a.label} weight`}
              />
            </div>
          ))}
        </div>
        <div className="mt-3 border-t border-border pt-2 text-[11.5px] text-muted">
          Weights sum to <span className="mono font-semibold text-text">{total}%</span> — the server normalises over
          the metrics each supplier actually reports.
        </div>
      </Card>

      <Card className="overflow-x-auto p-0">
        {query.isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : query.isError ? (
          <EmptyState icon={Trophy} title="Couldn't load the scorecard" body="Something went wrong ranking suppliers." />
        ) : rows.length === 0 ? (
          <EmptyState icon={Trophy} title="No suppliers to rank" body="Add suppliers to see them ranked by score." />
        ) : (
          <table className="k-table w-full">
            <thead>
              <tr>
                <th style={{ width: 44 }}>#</th>
                <th>Supplier</th>
                <th style={{ width: 120 }}>Score</th>
                <th style={{ width: 90 }}>PPM</th>
                <th style={{ width: 90 }}>OTD %</th>
                <th style={{ width: 80 }}>OQE</th>
                <th style={{ width: 100 }}>SCAR resp.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s, i) => (
                <tr
                  key={s.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/suppliers/${s.id}`)}
                >
                  <td className="mono text-[12px] text-muted">{i + 1}</td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <SupplierLogo name={s.name} code={s.code} profile={s.profile} size={28} />
                      <div>
                        <div className="text-[13px] font-semibold">{s.name}</div>
                        <div className="text-[10.5px] text-muted">
                          <span className="mono">{s.code}</span>
                          {s.category !== null && ` · ${s.category}`}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {s.score === null ? (
                      <span className="text-subtle">—</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span
                          className="mono text-[15px] font-bold"
                          style={{ color: gradeColor(s.grade), fontVariantNumeric: "tabular-nums" }}
                        >
                          {s.score}
                        </span>
                        <ScoreBar score={s.score} grade={s.grade} />
                      </div>
                    )}
                  </td>
                  <td>
                    <KpiCell value={s.scorecard.ppm} target={s.scorecard.ppmTarget} lowerIsBetter mini />
                  </td>
                  <td>
                    <KpiCell value={s.scorecard.otd} target={s.scorecard.otdTarget} suffix="%" mini />
                  </td>
                  <td>
                    <KpiCell value={s.scorecard.oqe} target={s.scorecard.oqeTarget} mini />
                  </td>
                  <td>
                    <KpiCell value={s.scorecard.scarHours} target={s.scorecard.scarTarget} suffix="h" lowerIsBetter mini />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function ScoreBar({ score, grade }: { score: number; grade: SupplierDto["grade"] }): React.ReactElement {
  return (
    <div className="h-1.5 w-16 overflow-hidden rounded-full" style={{ background: "var(--bg-subtle)" }}>
      <div style={{ width: `${score}%`, height: "100%", background: gradeColor(grade) }} />
    </div>
  );
}
