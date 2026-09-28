"use client";

import { useTranslations } from "next-intl";
import { BarChart3 } from "lucide-react";
import type { AuditType } from "@kaenal/types";
import { useAuditFrequency } from "@/hooks/use-audits";
import { EmptyState, Skeleton } from "@/components/ui";
import { AUDIT_TYPES } from "./audit-types";

/** Stack order matches the legend (`audits.jsx` line 111 + DESIGN-02-audits.md
 *  §7 addendum's 5th `gap` series). */
const SERIES: AuditType[] = ["internal", "supplier", "customer", "certification", "gap"];

const W = 720;
const H = 180;
const PAD_L = 30;
const PAD_B = 24;

/** `audits.jsx` `AuditFrequencyChart` (lines 179-208) — a stacked bar SVG over
 *  `GET /v1/audits/frequency`'s real last-6-months counts, never mock data.
 *  Loading/error get generic primitives (this chart has its own query,
 *  independent of the list's). */
export function AuditFrequencyChart(): React.ReactElement {
  const t = useTranslations("audits");
  const query = useAuditFrequency();

  if (query.isLoading) return <Skeleton className="h-[180px] w-full rounded-md" />;

  if (query.isError) {
    return (
      <div className="py-6">
        <EmptyState icon={BarChart3} title={t("errorTitle")} />
      </div>
    );
  }

  const data = query.data?.points ?? [];
  const totalOf = (counts: Record<string, number>): number => SERIES.reduce((sum, k) => sum + (counts[k] ?? 0), 0);
  const maxStack = Math.max(1, ...data.map((d) => totalOf(d.counts)));
  const barW = data.length > 0 ? (W - PAD_L - 16) / data.length - 8 : 0;
  const plotH = H - PAD_B - 16;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[180px] w-full" role="img" aria-label={t("frequencyTitle")}>
      {[0, 0.5, 1].map((frac) => (
        <line
          key={frac}
          x1={PAD_L}
          x2={W - 8}
          y1={PAD_B + plotH * frac}
          y2={PAD_B + plotH * frac}
          stroke="var(--border)"
          strokeDasharray={frac === 1 ? "0" : "2 4"}
        />
      ))}
      {data.map((d, i) => {
        const x = PAD_L + i * (barW + 8) + 4;
        let y = H - PAD_B;
        const total = totalOf(d.counts);
        return (
          <g key={d.month}>
            {SERIES.map((k) => {
              const v = d.counts[k] ?? 0;
              const barH = (v / maxStack) * (H - PAD_B - 20);
              y -= barH;
              return v > 0 ? <rect key={k} x={x} y={y} width={barW} height={barH} fill={AUDIT_TYPES[k].color} opacity={0.9} /> : null;
            })}
            <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--text-muted)">
              {d.month}
            </text>
            <text
              x={x + barW / 2}
              y={H - PAD_B - (total * (H - PAD_B - 20)) / maxStack - 4}
              textAnchor="middle"
              fontSize={10}
              fontWeight={600}
              fill="var(--text)"
            >
              {total}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
