"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  TriangleAlert,
  Sparkles,
  ThumbsUp,
  Zap,
  TrendingUp,
  Users,
  User,
  Link2,
  ChevronRight,
  Download,
  ClipboardCheck,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { weightedSupplierScore, type ScoreWeights, type SupplierMetrics } from "@kaenal/core";
import type { EntityKind, EntityLinkDto, PpapSubmissionDto, ScarDto, SupplierDto } from "@kaenal/types";
import type { UseQueryResult } from "@tanstack/react-query";
import type { Page } from "@kaenal/types";
import { longDate, shortDate, titleCase } from "@/lib/format";
import { useSupplier } from "@/hooks/use-suppliers";
import { useEntityLinks } from "@/hooks/use-entity-links";
import { usePpapList } from "@/hooks/use-ppap";
import { useScarList } from "@/hooks/use-scar";
import { PageHeader } from "@/components/page-header";
import { Button, Card, Chip, StatusBadge, EmptyState, Skeleton } from "@/components/ui";
import { PpapStatusBadge, LevelChip, AiPredictionPill } from "../ppap/ppap-bits";
import { ScarStatusBadge, SeverityChip, stageLabel } from "../scar/scar-bits";
import {
  RISK_TIER,
  RiskTierBadge,
  SupplierLogo,
  FlagChip,
  profileNum,
  profileStr,
  profileArr,
  aiInsights,
  type AiInsight,
} from "./suppliers-bits";

type Tab = "overview" | "scorecard" | "ppap" | "events" | "audits" | "parts" | "docs";

export function SupplierDetail({ id }: { id: string }): React.ReactElement {
  const router = useRouter();
  const { data: supplier, isLoading, isError } = useSupplier(id);

  if (isLoading) return <DetailSkeleton />;
  if (isError || supplier === undefined) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <BackLink onClick={() => router.push("/suppliers")} />
        <div className="k-surface mt-4">
          <EmptyState
            icon={TriangleAlert}
            title="Supplier not found"
            body="It may have been removed, or you may not have access."
          />
        </div>
      </div>
    );
  }

  return <SupplierDetailView s={supplier} />;
}

/** The end of a supplier link opposite this supplier. */
function oppositeEnd(l: EntityLinkDto, supplierId: string): { kind: EntityKind; id: string } {
  const isFrom = l.fromKind === "supplier" && l.fromId === supplierId;
  return isFrom ? { kind: l.toKind, id: l.toId } : { kind: l.fromKind, id: l.fromId };
}

interface LinkRow {
  key: string;
  kind: EntityKind;
  id: string;
  relation: string;
}

function SupplierDetailView({ s }: { s: SupplierDto }): React.ReactElement {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const insights = aiInsights(s.profile);

  // Real supplier-scoped records for the split tabs. PPAP and SCARs have their
  // own filtered endpoints (rich rows); NCRs/8Ds/audits/documents come through
  // the entity-link graph (id-level), grouped by the opposite end's kind.
  const ppap = usePpapList({ supplierId: s.id });
  const scars = useScarList({ supplierId: s.id });
  const links = useEntityLinks("supplier", s.id);

  const groups = useMemo(() => {
    const events: LinkRow[] = [];
    const audits: LinkRow[] = [];
    const docs: LinkRow[] = [];
    for (const l of links.data?.items ?? []) {
      const o = oppositeEnd(l, s.id);
      const row: LinkRow = { key: l.id, kind: o.kind, id: o.id, relation: l.relation };
      if (o.kind === "ncr" || o.kind === "eight_d" || o.kind === "capa") events.push(row);
      else if (o.kind === "audit" || o.kind === "inspection") audits.push(row);
      else if (o.kind === "document") docs.push(row);
      // `scar` edges are omitted here — SCARs render richly from their own list.
    }
    return { events, audits, docs };
  }, [links.data, s.id]);

  const ppapCount = ppap.data?.items.length ?? 0;
  const scarCount = scars.data?.items.length ?? 0;
  const partsCount = profileArr(s.profile, "parts").length;
  const onOpen = (kind: EntityKind, oid: string): void => navigateToEntity(router, kind, oid);

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "scorecard", label: "Scorecard" },
    { id: "ppap", label: `PPAP (${ppapCount})` },
    { id: "events", label: `Quality events (${scarCount + groups.events.length})` },
    { id: "audits", label: `Audits (${groups.audits.length})` },
    { id: "parts", label: `Parts (${partsCount})` },
    { id: "docs", label: "Documents" },
  ];
  const contact = s.contact ?? {};
  const contactName = typeof contact["name"] === "string" ? contact["name"] : null;
  const contactRole = typeof contact["role"] === "string" ? contact["role"] : null;
  const contactEmail = typeof contact["email"] === "string" ? contact["email"] : null;

  const loc = [s.city, s.country].filter((v): v is string => v !== null && v !== "").join(", ");
  const desc = [s.code, s.tier !== null ? `Tier ${s.tier}` : null, s.category, loc || null]
    .filter((v): v is string => v !== null && v !== "")
    .join(" · ");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
      <BackLink onClick={() => router.push("/suppliers")} />
      <PageHeader
        title={s.name}
        description={desc}
        actions={
          <Button>
            <Download size={14} /> Scorecard PDF
          </Button>
        }
      />

      {/* 360 header strip */}
      <Card className="grid items-center gap-4 p-4 md:[grid-template-columns:auto_1fr_auto]">
        <SupplierLogo name={s.name} code={s.code} profile={s.profile} size={64} rounded={12} />
        <div>
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <RiskTierBadge riskTier={s.riskTier} />
            {s.aiRiskTier !== null && s.aiRiskTier !== s.riskTier && (
              <RiskTierBadge riskTier={s.aiRiskTier} ai confidence={s.aiRiskConfidence} />
            )}
            <StatusBadge status={s.status} />
            {s.flags.map((f) => (
              <FlagChip key={f} flag={f} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            <Mini360
              label="PPM (YTD)"
              value={s.scorecard.ppm}
              target={s.scorecard.ppmTarget}
              lowerIsBetter
            />
            <Mini360 label="On-time delivery" value={s.scorecard.otd} target={s.scorecard.otdTarget} suffix="%" />
            <Mini360 label="OQE score" value={s.scorecard.oqe} target={s.scorecard.oqeTarget} />
            <Mini360
              label="SCAR response"
              value={s.scorecard.scarHours}
              target={s.scorecard.scarTarget}
              suffix="h"
              lowerIsBetter
            />
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-[11.5px] text-muted">
          {contactName !== null && (
            <div className="flex items-center gap-1">
              <User size={11} /> {contactName}
              {contactRole !== null && ` · ${contactRole}`}
            </div>
          )}
          {contactEmail !== null && <div className="mono text-[11px]">{contactEmail}</div>}
          {s.certExpires !== null && <div>Cert exp {longDate(s.certExpires)}</div>}
          {s.nextAudit !== null && <div>Next audit {longDate(s.nextAudit)}</div>}
        </div>
      </Card>

      {/* AI insight banner */}
      {insights.length > 0 && <AiInsightBanner insights={insights} confidence={s.aiRiskConfidence} />}

      {/* Tabs */}
      <div className="k-tabs">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`k-tab ${tab === t.id ? "active" : ""}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab s={s} />}
      {tab === "scorecard" && <ScorecardTab s={s} />}
      {tab === "ppap" && <PpapTab query={ppap} onOpenPpap={(pid) => router.push(`/ppap/${pid}`)} />}
      {tab === "events" && <EventsTab scars={scars} linked={groups.events} onOpen={onOpen} />}
      {tab === "audits" && (
        <LinkList
          query={links}
          rows={groups.audits}
          onOpen={onOpen}
          empty={{ icon: ShieldCheck, title: "No audits linked", body: "Audits and inspections of this supplier will appear here." }}
        />
      )}
      {tab === "parts" && <PartsTab s={s} />}
      {tab === "docs" && (
        <LinkList
          query={links}
          rows={groups.docs}
          onOpen={onOpen}
          empty={{ icon: FileText, title: "No documents linked", body: "Documents referencing this supplier will appear here." }}
        />
      )}
    </div>
  );
}

// --- Header pieces ---------------------------------------------------------

function Mini360({
  label,
  value,
  target,
  suffix = "",
  lowerIsBetter = false,
}: {
  label: string;
  value: number | null | undefined;
  target: number | null | undefined;
  suffix?: string;
  lowerIsBetter?: boolean;
}): React.ReactElement {
  const good = value == null || target == null ? true : lowerIsBetter ? value <= target : value >= target;
  const targetLabel =
    target == null ? "" : `${lowerIsBetter ? "≤" : "≥"} ${target.toLocaleString(undefined, { maximumFractionDigits: 1 })}${suffix}`;
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div
        className="mt-0.5 text-[20px] font-bold"
        style={{ color: value == null ? "var(--text-muted)" : good ? "#15803d" : "#b91c1c", fontVariantNumeric: "tabular-nums" }}
      >
        {value == null ? "—" : `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}${suffix}`}
      </div>
      <div className="text-[10.5px] text-muted">{targetLabel || "no target"}</div>
    </div>
  );
}

const INSIGHT_ICON: Record<string, { icon: typeof ThumbsUp; color: string }> = {
  positive: { icon: ThumbsUp, color: "#16a34a" },
  risk: { icon: TriangleAlert, color: "#dc2626" },
  anomaly: { icon: Zap, color: "#dc2626" },
  similar: { icon: Users, color: "#6366f1" },
  trend: { icon: TrendingUp, color: "#6366f1" },
};

function AiInsightBanner({ insights, confidence }: { insights: AiInsight[]; confidence: number | null }): React.ReactElement {
  return (
    <div
      className="rounded-lg p-3.5"
      style={{
        background: "linear-gradient(135deg, rgba(99,102,241,0.06), rgba(168,85,247,0.04))",
        border: "1px solid rgba(99,102,241,0.18)",
      }}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <Sparkles size={14} style={{ color: "#6366f1" }} />
        <strong className="text-[12px] text-text">
          AI insights{confidence !== null ? ` — confidence ${confidence}%` : ""}
        </strong>
      </div>
      <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        {insights.slice(0, 3).map((insight, i) => {
          const meta = INSIGHT_ICON[insight.kind] ?? INSIGHT_ICON["trend"]!;
          const Icon = meta.icon;
          return (
            <div key={i} className="flex gap-2 rounded-md p-2.5" style={{ background: "var(--surface)" }}>
              <Icon size={14} style={{ color: meta.color, flexShrink: 0, marginTop: 2 }} />
              <div className="text-[11.5px] leading-relaxed">{insight.text}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Overview tab ----------------------------------------------------------

function OverviewTab({ s }: { s: SupplierDto }): React.ReactElement {
  const trend = s.scorecard.ppmTrend;
  return (
    <div className="grid gap-4 lg:[grid-template-columns:2fr_1fr]">
      <Card className="p-5">
        <h3 className="text-[15px] font-semibold text-text">PPM trend — 12 mo</h3>
        <p className="mb-3 text-[12px] text-muted">
          {s.scorecard.ppmTarget != null ? `Target ≤ ${s.scorecard.ppmTarget} ppm` : "No target set"}
        </p>
        {trend != null && trend.length > 0 ? (
          <BigSpark data={trend} target={s.scorecard.ppmTarget} lowerIsBetter />
        ) : (
          <EmptyState icon={TrendingUp} title="No trend data" body="PPM history will chart here once metrics are recorded." />
        )}
      </Card>
      <Card className="h-fit p-5">
        <h3 className="mb-2 text-[15px] font-semibold text-text">Profile</h3>
        <dl className="flex flex-col gap-2 text-[12.5px]">
          <ProfileRow label="Category" value={s.category} />
          <ProfileRow label="Location" value={[s.city, s.country].filter(Boolean).join(", ") || null} />
          <ProfileRow label="Tier" value={s.tier !== null ? `Tier ${s.tier}` : null} />
          <ProfileRow label="Spend YTD" value={fmtSpend(profileNum(s.profile, "spendYtd"))} />
          <ProfileRow label="Chargebacks YTD" value={fmtChargeback(profileNum(s.profile, "chargebacksYtd"))} />
          <ProfileRow label="Cert" value={profileStr(s.profile, "iatfCert")} />
          <ProfileRow label="Last audit" value={s.lastAudit !== null ? longDate(s.lastAudit) : null} />
          <ProfileRow label="Next audit" value={s.nextAudit !== null ? longDate(s.nextAudit) : null} />
        </dl>
      </Card>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string | null }): React.ReactElement {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value ?? <span className="text-subtle">—</span>}</dd>
    </div>
  );
}

// --- Scorecard tab ---------------------------------------------------------

type NumericTargetKey = "ppmTarget" | "otdTarget" | "oqeTarget" | "scarTarget";
type NumericMetricKey = "ppm" | "otd" | "oqe" | "scarHours";

const AXES: {
  key: keyof ScoreWeights;
  label: string;
  metricKey: NumericMetricKey;
  targetKey: NumericTargetKey;
  lowerIsBetter: boolean;
  suffix: string;
}[] = [
  { key: "ppm", label: "PPM defects", metricKey: "ppm", targetKey: "ppmTarget", lowerIsBetter: true, suffix: " ppm" },
  { key: "otd", label: "On-time delivery", metricKey: "otd", targetKey: "otdTarget", lowerIsBetter: false, suffix: "%" },
  { key: "oqe", label: "Overall quality eval", metricKey: "oqe", targetKey: "oqeTarget", lowerIsBetter: false, suffix: "" },
  { key: "scar", label: "SCAR responsiveness", metricKey: "scarHours", targetKey: "scarTarget", lowerIsBetter: true, suffix: "h" },
];

/** One-hot weight vector isolating a single axis, so `weightedSupplierScore`
 *  returns that axis's normalized 0–100 goodness — normalization stays in core. */
function axisScore(metrics: SupplierMetrics, key: keyof ScoreWeights): number {
  const weights: ScoreWeights = { ppm: 0, otd: 0, oqe: 0, scar: 0, [key]: 1 };
  return weightedSupplierScore(metrics, weights);
}

function ScorecardTab({ s }: { s: SupplierDto }): React.ReactElement {
  const metrics: SupplierMetrics = s.scorecard;
  const gradeColor = s.grade === null ? "var(--text-muted)" : RISK_TIER[s.grade].fg;

  return (
    <div className="grid gap-4 lg:[grid-template-columns:1.2fr_1fr]">
      <Card className="p-5">
        <h3 className="text-[15px] font-semibold text-text">Scorecard breakdown</h3>
        <p className="mb-3.5 text-[12px] text-muted">
          Weighted composite across the four KPI axes. Tune weights in the Scorecards view.
        </p>
        <div className="flex flex-col gap-3.5">
          {AXES.map((a) => {
            const value = metrics[a.metricKey];
            const target = s.scorecard[a.targetKey];
            const score = axisScore(metrics, a.key);
            const has = value != null && target != null;
            return (
              <ScoreBar
                key={a.key}
                label={a.label}
                score={has ? score : null}
                actual={value == null ? "—" : `${value}${a.suffix}`}
                target={target == null ? "—" : `${a.lowerIsBetter ? "≤" : "≥"} ${target}${a.suffix}`}
              />
            );
          })}
        </div>
        <div className="mt-5 rounded-md p-3.5" style={{ background: "var(--bg-subtle)" }}>
          <div className="mb-1 text-[11px] font-semibold uppercase text-muted">Composite score</div>
          <div className="flex items-baseline gap-3">
            <span className="text-[40px] font-extrabold" style={{ color: gradeColor, fontVariantNumeric: "tabular-nums" }}>
              {s.score ?? "—"}
            </span>
            <span className="text-[12px] text-muted">/ 100</span>
            {s.grade !== null && (
              <span className="ml-auto">
                <Chip bg={RISK_TIER[s.grade].bg} fg={gradeColor} style={{ fontWeight: 600 }}>
                  Grade {s.grade}
                </Chip>
              </span>
            )}
          </div>
          <p className="mt-2 text-[11.5px] text-muted">
            Computed server-side under the default weights; the Scorecards view re-ranks under custom weights.
          </p>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="mb-1 text-[15px] font-semibold text-text">Performance radar</h3>
        <p className="mb-2 text-[12px] text-muted">Normalized 0–100 goodness per axis</p>
        <Radar metrics={metrics} />
      </Card>
    </div>
  );
}

function ScoreBar({
  label,
  score,
  actual,
  target,
}: {
  label: string;
  score: number | null;
  actual: string;
  target: string;
}): React.ReactElement {
  const color = score === null ? "var(--border)" : score >= 85 ? "#16a34a" : score >= 70 ? "#3b82f6" : score >= 50 ? "#f59e0b" : "#dc2626";
  return (
    <div>
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-[12.5px] font-semibold">{label}</span>
        <span className="ml-auto text-[12px] text-muted">
          {actual} · target {target}
        </span>
        <span className="min-w-[36px] text-right text-[13px] font-bold" style={{ color, fontVariantNumeric: "tabular-nums" }}>
          {score === null ? "—" : score}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded" style={{ background: "var(--bg-subtle)" }}>
        <div style={{ width: `${score ?? 0}%`, height: "100%", background: color, transition: "width 300ms" }} />
      </div>
    </div>
  );
}

function Radar({ metrics }: { metrics: SupplierMetrics }): React.ReactElement {
  const axes = AXES.map((a) => ({ label: a.label.split(" ")[0]!.toUpperCase(), value: axisScore(metrics, a.key) }));
  const cx = 130;
  const cy = 130;
  const r = 86;
  const angle = (i: number): number => (Math.PI * 2 * i) / axes.length - Math.PI / 2;
  const point = (i: number, v: number): [number, number] => [
    cx + Math.cos(angle(i)) * ((r * v) / 100),
    cy + Math.sin(angle(i)) * ((r * v) / 100),
  ];
  return (
    <svg width="100%" viewBox="0 0 260 260">
      {[20, 40, 60, 80, 100].map((p) => (
        <polygon
          key={p}
          points={axes.map((_, i) => point(i, p).join(",")).join(" ")}
          fill="none"
          stroke="var(--border)"
          strokeWidth="0.5"
        />
      ))}
      {axes.map((a, i) => {
        const [x, y] = point(i, 116);
        return (
          <g key={a.label}>
            <line x1={cx} y1={cy} x2={point(i, 100)[0]} y2={point(i, 100)[1]} stroke="var(--border)" strokeWidth="0.5" />
            <text x={x} y={y} fontSize="10" fill="var(--text-muted)" textAnchor="middle" dominantBaseline="middle">
              {a.label}
            </text>
          </g>
        );
      })}
      <polygon
        points={axes.map((a, i) => point(i, a.value).join(",")).join(" ")}
        fill="rgba(37,99,235,0.15)"
        stroke="#2563eb"
        strokeWidth="1.5"
      />
      {axes.map((a, i) => {
        const [px, py] = point(i, a.value);
        return <circle key={a.label} cx={px} cy={py} r="3" fill="#2563eb" />;
      })}
    </svg>
  );
}

// --- PPAP tab --------------------------------------------------------------

function PpapTab({
  query,
  onOpenPpap,
}: {
  query: UseQueryResult<Page<PpapSubmissionDto>>;
  onOpenPpap: (id: string) => void;
}): React.ReactElement {
  if (query.isLoading) return <Skeleton className="h-40" />;
  if (query.isError) {
    return (
      <Card>
        <EmptyState icon={ClipboardCheck} title="Couldn't load PPAP submissions" />
      </Card>
    );
  }
  const rows = query.data?.items ?? [];
  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState icon={ClipboardCheck} title="No PPAP submissions" body="Part-approval packages for this supplier will appear here." />
      </Card>
    );
  }
  return (
    <Card className="overflow-x-auto p-0">
      <table className="k-table w-full">
        <thead>
          <tr>
            <th style={{ width: 120 }}>PPAP</th>
            <th>Part / Program</th>
            <th style={{ width: 80 }}>Level</th>
            <th style={{ width: 120 }}>Customer</th>
            <th style={{ width: 110 }}>Status</th>
            <th style={{ width: 120 }}>AI</th>
            <th style={{ width: 90 }}>Due</th>
            <th style={{ width: 28 }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="cursor-pointer" onClick={() => onOpenPpap(p.id)}>
              <td className="mono text-[11.5px] font-semibold" style={{ color: "var(--accent)" }}>
                {p.code ?? p.id.slice(0, 8)}
              </td>
              <td>
                <div className="text-[12.5px] font-medium">{p.partNumber}</div>
                {p.programName !== null && <div className="text-[10.5px] text-muted">{p.programName}</div>}
              </td>
              <td>
                <LevelChip level={p.level} />
              </td>
              <td className="text-[12px]">{p.customer ?? "—"}</td>
              <td>
                <PpapStatusBadge status={p.status} />
              </td>
              <td>
                <AiPredictionPill
                  willMissDeadline={p.aiPrediction.willMissDeadline}
                  confidence={p.aiPrediction.confidence}
                  daysLikelyOver={p.aiPrediction.daysLikelyOver}
                />
              </td>
              <td className="whitespace-nowrap text-[12px] text-muted">{shortDate(p.dueDate)}</td>
              <td>
                <ChevronRight size={14} className="text-subtle" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// --- Quality events tab (SCARs + linked NCRs/8Ds) --------------------------

function EventsTab({
  scars,
  linked,
  onOpen,
}: {
  scars: UseQueryResult<Page<ScarDto>>;
  linked: LinkRow[];
  onOpen: (kind: EntityKind, id: string) => void;
}): React.ReactElement {
  if (scars.isLoading) return <Skeleton className="h-40" />;
  const scarRows = scars.data?.items ?? [];
  if (scarRows.length === 0 && linked.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={TriangleAlert}
          title="No quality events"
          body="SCARs raised against this supplier, plus linked NCRs and 8Ds, will appear here."
        />
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {scarRows.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <div className="border-b border-border px-4 py-2.5 text-[12px] font-semibold text-muted">SCARs</div>
          <table className="k-table w-full">
            <thead>
              <tr>
                <th style={{ width: 130 }}>SCAR</th>
                <th>Title</th>
                <th style={{ width: 100 }}>Severity</th>
                <th style={{ width: 150 }}>Stage</th>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ width: 90 }}>Due</th>
                <th style={{ width: 28 }} />
              </tr>
            </thead>
            <tbody>
              {scarRows.map((sc) => (
                <tr key={sc.id} className="cursor-pointer" onClick={() => onOpen("scar", sc.id)}>
                  <td className="mono text-[11.5px] font-semibold" style={{ color: "var(--accent)" }}>
                    {sc.code}
                  </td>
                  <td className="text-[12.5px] font-medium">{sc.title ?? "—"}</td>
                  <td>
                    <SeverityChip severity={sc.severity} />
                  </td>
                  <td className="text-[12px] text-muted">{stageLabel(sc.currentD)}</td>
                  <td>
                    <ScarStatusBadge status={sc.status} />
                  </td>
                  <td className="whitespace-nowrap text-[12px] text-muted">{shortDate(sc.dueDate)}</td>
                  <td>
                    <ChevronRight size={14} className="text-subtle" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {linked.length > 0 && <LinkTable title="Linked NCRs & 8Ds" rows={linked} onOpen={onOpen} />}
    </div>
  );
}

// --- Linked-record tables (audits, documents, linked NCRs/8Ds) -------------

/** A tab that renders entity-link rows of one bucket, with its own load/empty
 *  states (the link query is shared across the audits/docs tabs). */
function LinkList({
  query,
  rows,
  onOpen,
  empty,
}: {
  query: UseQueryResult<Page<EntityLinkDto>>;
  rows: LinkRow[];
  onOpen: (kind: EntityKind, id: string) => void;
  empty: { icon: typeof Link2; title: string; body: string };
}): React.ReactElement {
  if (query.isLoading) return <Skeleton className="h-40" />;
  if (query.isError) {
    return (
      <Card>
        <EmptyState icon={Link2} title="Couldn't load linked records" />
      </Card>
    );
  }
  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState icon={empty.icon} title={empty.title} body={empty.body} />
      </Card>
    );
  }
  return <LinkTable rows={rows} onOpen={onOpen} />;
}

/** The id-level linked-record table shared by every entity-link bucket. */
function LinkTable({
  title,
  rows,
  onOpen,
}: {
  title?: string;
  rows: LinkRow[];
  onOpen: (kind: EntityKind, id: string) => void;
}): React.ReactElement {
  return (
    <Card className="overflow-x-auto p-0">
      {title !== undefined && <div className="border-b border-border px-4 py-2.5 text-[12px] font-semibold text-muted">{title}</div>}
      <table className="k-table w-full">
        <thead>
          <tr>
            <th style={{ width: 140 }}>Type</th>
            <th>Record</th>
            <th style={{ width: 160 }}>Relation</th>
            <th style={{ width: 28 }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="cursor-pointer" onClick={() => onOpen(r.kind, r.id)}>
              <td>
                <Chip bg="var(--bg-subtle)">{titleCase(r.kind)}</Chip>
              </td>
              <td className="mono text-[12px]">{r.id.slice(0, 8)}</td>
              <td className="text-[12px] text-muted">{titleCase(r.relation)}</td>
              <td>
                <ChevronRight size={14} className="text-subtle" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// --- Parts tab -------------------------------------------------------------

function PartsTab({ s }: { s: SupplierDto }): React.ReactElement {
  const parts = profileArr(s.profile, "parts").filter(
    (p): p is Record<string, unknown> => typeof p === "object" && p !== null,
  );
  if (parts.length === 0) {
    return (
      <Card>
        <EmptyState icon={Link2} title="No parts on file" body="Parts supplied by this vendor will list here." />
      </Card>
    );
  }
  return (
    <Card className="overflow-x-auto p-0">
      <table className="k-table w-full">
        <thead>
          <tr>
            <th>Part</th>
            <th>Number</th>
            <th>Program</th>
          </tr>
        </thead>
        <tbody>
          {parts.map((p, i) => (
            <tr key={i}>
              <td className="font-medium">{str(p["name"]) ?? "—"}</td>
              <td className="mono text-[12px]">{str(p["number"]) ?? "—"}</td>
              <td className="text-[12px] text-muted">{str(p["program"]) ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// --- helpers ---------------------------------------------------------------

function str(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}

function fmtSpend(v: number | null): string | null {
  return v === null ? null : `$${(v / 1_000_000).toFixed(2)}M`;
}

function fmtChargeback(v: number | null): string | null {
  return v === null ? null : `$${(v / 1000).toFixed(1)}k`;
}

function navigateToEntity(router: ReturnType<typeof useRouter>, kind: EntityKind, id: string): void {
  const path: Partial<Record<EntityKind, string>> = {
    ncr: "/ncrs",
    eight_d: "/8d",
    audit: "/audits",
    capa: "/capa",
    inspection: "/inspections",
    document: "/documents",
    supplier: "/suppliers",
    scar: "/scars",
  };
  const base = path[kind];
  if (base !== undefined) router.push(`${base}/${id}`);
}

/** Big sparkline with a dashed target line — the detail PPM trend chart. */
function BigSpark({
  data,
  target,
  lowerIsBetter = false,
}: {
  data: number[];
  target: number | null | undefined;
  lowerIsBetter?: boolean;
}): React.ReactElement {
  const w = 560;
  const h = 160;
  const pad = 24;
  const values = target != null ? [...data, target] : data;
  const max = Math.max(...values);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const x = (i: number): number => pad + (i / (data.length - 1)) * (w - pad * 2);
  const y = (v: number): number => pad + (1 - (v - min) / range) * (h - pad * 2);
  const pts = data.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const last = data[data.length - 1]!;
  const good = target == null ? true : lowerIsBetter ? last <= target : last >= target;
  const stroke = good ? "#16a34a" : "#dc2626";
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      {target != null && (
        <g>
          <line x1={pad} x2={w - pad} y1={y(target)} y2={y(target)} stroke="#f59e0b" strokeWidth="1" strokeDasharray="4,3" />
          <text x={w - pad} y={y(target) - 4} fontSize="10" fill="#b45309" textAnchor="end">
            target {target}
          </text>
        </g>
      )}
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="2.5" fill={stroke} />
      ))}
    </svg>
  );
}

function BackLink({ onClick }: { onClick: () => void }): React.ReactElement {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-text">
      <ArrowLeft size={14} /> Suppliers
    </button>
  );
}

function DetailSkeleton(): React.ReactElement {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-24" />
      <Skeleton className="h-10" />
      <Skeleton className="h-64" />
    </div>
  );
}
