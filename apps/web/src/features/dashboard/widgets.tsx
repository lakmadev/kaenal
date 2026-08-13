"use client";

import type { useRouter } from "next/navigation";
import {
  ClipboardCheck,
  TriangleAlert,
  Brain,
  Clock,
  Check,
  BarChart3,
  Layers,
  Shield,
  Truck,
  User,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Zap,
  ThumbsUp,
  type LucideIcon,
} from "lucide-react";
import { PriorityBadge, StatusBadge } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { BarChart, LineChart } from "./charts";
import {
  NCR_TREND,
  RISK_DIST,
  SEVERITY_INK,
  ACTIVITY,
  HEATMAP,
  ASSIGNMENTS,
} from "./dashboard-data";

/** Live KPI values injected by the dashboard (fall back to the design's demo values). */
export interface WidgetCtx {
  router: ReturnType<typeof useRouter>;
  kpis: Partial<Record<"inspections" | "ncrs" | "eightds" | "overdue", string>>;
}

export type WidgetSize = "small" | "half" | "wide" | "full";

export interface WidgetDef {
  label: string;
  size: WidgetSize;
  defaultSize?: WidgetSize;
  icon: LucideIcon;
  color: string;
  description: string;
  render: (ctx: WidgetCtx) => React.ReactElement;
}

// ——— KPI ———
function KPIWidget({
  value,
  trend,
  trendDir,
}: {
  value: string;
  trend: string;
  trendDir: "up" | "down";
}): React.ReactElement {
  return (
    <div
      style={{
        padding: "18px 16px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        height: "100%",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          fontSize: 40,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
          color: "var(--text)",
        }}
      >
        {value}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text)" }}>
          {trendDir === "up" ? "↑" : "↓"} {trend}
        </span>
        <span style={{ color: "var(--text-subtle)" }}>vs prior 30d</span>
      </div>
    </div>
  );
}

// ——— NCR trend ———
function NCRTrendWidget(): React.ReactElement {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", gap: 16, fontSize: 11, fontWeight: 500, marginBottom: 6, color: "var(--text-muted)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 12, height: 2, background: "var(--text)", borderRadius: 2 }} />
          Created
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 12, height: 2, background: "var(--text-subtle)", borderRadius: 2 }} />
          Resolved
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 12, height: 2, background: "#d97706", borderRadius: 2 }} />
          Open
        </span>
      </div>
      <LineChart
        data={NCR_TREND}
        series={[
          { key: "created", color: "var(--text)" },
          { key: "resolved", color: "var(--text-subtle)" },
          { key: "open", color: "#d97706", emphasis: true },
        ]}
        height={200}
      />
    </div>
  );
}

// ——— Risk distribution ———
function RiskDistWidget(): React.ReactElement {
  const total = RISK_DIST.reduce((s, r) => s + r.value, 0);
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
          {total}
        </span>
        <span className="k-overline">Open NCRs by severity</span>
      </div>
      <div style={{ display: "flex", height: 8, borderRadius: "var(--r-sm)", overflow: "hidden", gap: 1.5 }}>
        {RISK_DIST.map((r) => (
          <div key={r.label} title={`${r.label}: ${r.value}`} style={{ flex: r.value, background: SEVERITY_INK[r.label] ?? r.color }} />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {RISK_DIST.map((r) => (
          <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: SEVERITY_INK[r.label] ?? r.color, flexShrink: 0 }} />
            <span style={{ flex: 1, color: "var(--text-muted)" }}>{r.label}</span>
            <span className="mono" style={{ fontWeight: 600, color: "var(--text)" }}>{r.value}</span>
            <span className="mono" style={{ fontSize: 11, color: "var(--text-subtle)", width: 34, textAlign: "right" }}>
              {Math.round((r.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Demo entity ids aren't real rows — route to the relevant list. */
function entityHref(target: string): string {
  if (target.startsWith("NCR")) return "/ncrs";
  if (target.startsWith("8D")) return "/8d";
  if (target.startsWith("INS")) return "/inspections";
  return "/dashboard";
}

// ——— Recent activity ———
function ActivityWidget({ ctx }: { ctx: WidgetCtx }): React.ReactElement {
  return (
    <div style={{ padding: "4px 0", maxHeight: 320, overflowY: "auto" }}>
      {ACTIVITY.slice(0, 6).map((a) => (
        <div key={a.id} style={{ display: "flex", gap: 10, padding: "8px 14px", alignItems: "flex-start" }}>
          <Avatar name={a.actor} size={26} />
          <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.45 }}>
            <span style={{ fontWeight: 600 }}>{a.actor}</span>{" "}
            <span style={{ color: "var(--text-muted)" }}>{a.action}</span>{" "}
            <button
              onClick={() => ctx.router.push(entityHref(a.target))}
              className="mono k-link"
              style={{ fontSize: 11.5, fontWeight: 600 }}
            >
              {a.target}
            </button>
            <div style={{ fontSize: 10.5, color: "var(--text-subtle)", marginTop: 2 }}>{a.time}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ——— My assignments ———
function AssignmentsWidget({ ctx }: { ctx: WidgetCtx }): React.ReactElement {
  return (
    <div style={{ padding: "4px 0", maxHeight: 320, overflowY: "auto" }}>
      {ASSIGNMENTS.map((n) => (
        <button
          key={n.id}
          onClick={() => ctx.router.push("/ncrs")}
          style={{ display: "block", width: "100%", padding: "10px 16px", borderBottom: "1px solid var(--border)", textAlign: "left" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-subtle)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{n.id}</span>
            <PriorityBadge priority={n.priority} />
            <StatusBadge status={n.status} />
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 2 }}>{n.title}</div>
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 12 }}>
            <span>Due {n.due}</span>
            <span>·</span>
            <span>{n.area}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

// ——— Risk heatmap ———
function HeatmapWidget(): React.ReactElement {
  const colors = ["#e2e8f0", "#fef3c7", "#fed7aa", "#fecaca", "#fca5a5"];
  const fg = ["#94a3b8", "#92400e", "#9a3412", "#991b1b", "#7f1d1d"];
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: `80px repeat(${HEATMAP.cols.length}, 1fr)`, gap: 3, fontSize: 10 }}>
        <div />
        {HEATMAP.cols.map((c) => (
          <div
            key={c}
            style={{ fontSize: 9, color: "var(--text-muted)", textAlign: "center", padding: "0 2px", writingMode: "vertical-rl", transform: "rotate(180deg)", height: 50 }}
          >
            {c}
          </div>
        ))}
        {HEATMAP.rows.map((row, ri) => (
          <div key={row} style={{ display: "contents" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", alignSelf: "center", fontWeight: 500 }}>{row}</div>
            {HEATMAP.values[ri]!.map((v, ci) => (
              <div
                key={ci}
                title={`${row} × ${HEATMAP.cols[ci]}: ${v}`}
                style={{
                  height: 28,
                  background: colors[v],
                  color: fg[v],
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 600,
                }}
              >
                {v > 0 ? v : ""}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ——— Compliance posture ———
function ComplianceWidget(): React.ReactElement {
  const items = [
    { label: "ISO 9001:2015", score: 94, color: "#16a34a" },
    { label: "IATF 16949", score: 88, color: "#16a34a" },
    { label: "FDA 21 CFR 820", score: 76, color: "#f59e0b" },
    { label: "AS9100D", score: 91, color: "#16a34a" },
  ];
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((c) => (
        <div key={c.label}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
            <span style={{ fontWeight: 500 }}>{c.label}</span>
            <span className="mono" style={{ color: c.color, fontWeight: 600 }}>{c.score}%</span>
          </div>
          <div style={{ height: 6, background: "var(--bg-subtle)", borderRadius: "var(--r-sm)", overflow: "hidden" }}>
            <div style={{ width: `${c.score}%`, height: "100%", background: c.color, borderRadius: "var(--r-sm)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ——— Pareto ———
function ParetoWidget(): React.ReactElement {
  return (
    <div style={{ padding: 16 }}>
      <BarChart
        data={[
          { label: "Weld defect", value: 24, color: "#ea580c" },
          { label: "Dimensional", value: 18, color: "#f59e0b" },
          { label: "Surface", value: 14, color: "#eab308" },
          { label: "Material", value: 9, color: "#3b82f6" },
          { label: "Assembly", value: 6, color: "#6366f1" },
          { label: "Other", value: 4, color: "#94a3b8" },
        ]}
      />
    </div>
  );
}

// ——— 8D pipeline ———
function PipelineWidget(): React.ReactElement {
  const stages = [
    { l: "D0–D1", v: 12, c: "#ddd6fe" },
    { l: "D2", v: 9, c: "#c4b5fd" },
    { l: "D3", v: 7, c: "#a78bfa" },
    { l: "D4", v: 5, c: "#8b5cf6" },
    { l: "D5", v: 4, c: "#7c3aed" },
    { l: "D6", v: 3, c: "#6d28d9" },
    { l: "D7–D8", v: 2, c: "#5b21b6" },
  ];
  const max = stages[0]!.v;
  return (
    <div style={{ padding: 16, display: "flex", alignItems: "flex-end", gap: 4, height: 180 }}>
      {stages.map((s) => (
        <div key={s.l} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: s.c, fontVariantNumeric: "tabular-nums" }}>{s.v}</div>
          <div style={{ width: "100%", height: `${(s.v / max) * 130}px`, background: s.c, borderRadius: "4px 4px 0 0" }} />
          <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 500 }}>{s.l}</div>
        </div>
      ))}
    </div>
  );
}

// ——— Supplier scorecard ———
function SupplierWidget(): React.ReactElement {
  const rows = [
    { name: "Acme Forging", score: 96, trend: "up" },
    { name: "Apex Plastics", score: 92, trend: "flat" },
    { name: "Nexus Steel", score: 88, trend: "down" },
    { name: "Crown Bearings", score: 84, trend: "up" },
    { name: "Vega Castings", score: 71, trend: "down" },
  ];
  return (
    <div style={{ padding: "8px 0" }}>
      {rows.map((s, i) => (
        <div
          key={s.name}
          style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 16px", borderBottom: i < 4 ? "1px solid var(--border)" : "none" }}
        >
          <div
            style={{ width: 26, height: 26, borderRadius: "var(--r-sm)", background: "var(--bg-subtle)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}
          >
            <Truck size={14} />
          </div>
          <div style={{ flex: 1, fontSize: 12.5, fontWeight: 500 }}>{s.name}</div>
          <div
            className="mono"
            style={{ fontSize: 13, fontWeight: 600, color: s.score >= 90 ? "var(--success-600)" : s.score >= 80 ? "var(--warning-600)" : "var(--danger-600)" }}
          >
            {s.score}
          </div>
          {s.trend === "up" ? (
            <ArrowUp size={12} style={{ color: "var(--success-600)" }} />
          ) : s.trend === "down" ? (
            <ArrowDown size={12} style={{ color: "var(--danger-600)" }} />
          ) : (
            <Check size={12} style={{ color: "var(--text-muted)" }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ——— Inspector workload ———
function InspectorLoadWidget(): React.ReactElement {
  return (
    <div style={{ padding: 16 }}>
      <BarChart
        data={[
          { label: "Lin Wei", value: 8, color: "#dc2626" },
          { label: "Sara Chen", value: 6, color: "#f59e0b" },
          { label: "Marco T.", value: 5, color: "#f59e0b" },
          { label: "Aria K.", value: 3, color: "#16a34a" },
          { label: "Diego R.", value: 2, color: "#16a34a" },
        ]}
      />
    </div>
  );
}

// ——— AI insights ———
function AIInsightsWidget(): React.ReactElement {
  const items: { icon: LucideIcon; color: string; txt: React.ReactNode }[] = [
    {
      icon: TriangleAlert,
      color: "#dc2626",
      txt: (
        <>
          <strong>Plant A — Line 3</strong> shows a 28% spike in weld-bead NCRs vs last 30d. Likely root cause: torch wire feed (similar to NCR-0118).
        </>
      ),
    },
    { icon: Zap, color: "#9333ea", txt: <>Welder #14 has 4 open NCRs — recommend a TIG re-cert audit before peak shift Tuesday.</> },
    { icon: ThumbsUp, color: "#16a34a", txt: <>Containment on 8D-0015 is on track — corrective action D5 ready for QA approval.</> },
  ];
  return (
    <div style={{ padding: "8px 0", display: "flex", flexDirection: "column" }}>
      {items.map((it, i) => {
        const ItIcon = it.icon;
        return (
          <div key={i} style={{ display: "flex", gap: 10, padding: "10px 14px", borderBottom: i < 2 ? "1px solid var(--border)" : "none" }}>
            <div
              style={{ width: 26, height: 26, borderRadius: "var(--r-sm)", background: it.color + "18", color: it.color, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <ItIcon size={13} strokeWidth={2} />
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.5 }}>{it.txt}</div>
          </div>
        );
      })}
    </div>
  );
}

// ——— Registry (matches dashboard.jsx WIDGET_REGISTRY) ———
export const WIDGET_REGISTRY: Record<string, WidgetDef> = {
  kpi_inspections: {
    label: "Open Inspections", size: "small", icon: ClipboardCheck, color: "#2563eb",
    description: "KPI card with 30-day trend",
    render: (ctx) => <KPIWidget value={ctx.kpis.inspections ?? "14"} trend="+12%" trendDir="up" />,
  },
  kpi_ncrs: {
    label: "Open NCRs", size: "small", icon: TriangleAlert, color: "#ea580c",
    description: "KPI card with 30-day trend",
    render: (ctx) => <KPIWidget value={ctx.kpis.ncrs ?? "52"} trend="+8%" trendDir="up" />,
  },
  kpi_8ds: {
    label: "Active 8Ds", size: "small", icon: Brain, color: "#6366f1",
    description: "KPI card with 30-day trend",
    render: (ctx) => <KPIWidget value={ctx.kpis.eightds ?? "7"} trend="-14%" trendDir="down" />,
  },
  kpi_overdue: {
    label: "Overdue Items", size: "small", icon: Clock, color: "#dc2626",
    description: "Items past due date",
    render: (ctx) => <KPIWidget value={ctx.kpis.overdue ?? "5"} trend="+2" trendDir="up" />,
  },
  kpi_passrate: {
    label: "Pass Rate (7d)", size: "small", icon: Check, color: "#16a34a",
    description: "Percent passed this week",
    render: () => <KPIWidget value="94%" trend="+2%" trendDir="down" />,
  },
  kpi_copq: {
    label: "COPQ (MTD)", size: "small", icon: BarChart3, color: "#9333ea",
    description: "Quality-related cost trend",
    render: () => <KPIWidget value="$48k" trend="-6%" trendDir="down" />,
  },
  ncr_trend: {
    label: "NCR Trend", size: "wide", defaultSize: "wide", icon: BarChart3, color: "#3b82f6",
    description: "Created vs resolved over 12 months",
    render: () => <NCRTrendWidget />,
  },
  risk_dist: {
    label: "Risk Distribution", size: "half", icon: TriangleAlert, color: "#f59e0b",
    description: "Severity breakdown of open NCRs",
    render: () => <RiskDistWidget />,
  },
  activity: {
    label: "Recent Activity", size: "half", icon: Clock, color: "#64748b",
    description: "Live feed of team actions",
    render: (ctx) => <ActivityWidget ctx={ctx} />,
  },
  assignments: {
    label: "My Assignments", size: "half", icon: User, color: "#2563eb",
    description: "Items owned by current user",
    render: (ctx) => <AssignmentsWidget ctx={ctx} />,
  },
  heatmap: {
    label: "Risk Heatmap", size: "half", icon: Layers, color: "#dc2626",
    description: "Severity by area × category",
    render: () => <HeatmapWidget />,
  },
  compliance: {
    label: "Compliance Posture", size: "half", icon: Shield, color: "#16a34a",
    description: "ISO / IATF / FDA readiness",
    render: () => <ComplianceWidget />,
  },
  pareto: {
    label: "Top Defect Pareto", size: "half", icon: BarChart3, color: "#ea580c",
    description: "Most frequent defect categories",
    render: () => <ParetoWidget />,
  },
  pipeline_8d: {
    label: "8D Pipeline", size: "half", icon: Brain, color: "#6366f1",
    description: "D0 → D8 funnel",
    render: () => <PipelineWidget />,
  },
  supplier_score: {
    label: "Supplier Scorecard", size: "half", icon: Truck, color: "#0d9488",
    description: "Top 5 suppliers by quality",
    render: () => <SupplierWidget />,
  },
  inspector_load: {
    label: "Inspector Workload", size: "half", icon: User, color: "#9333ea",
    description: "Open items per inspector",
    render: () => <InspectorLoadWidget />,
  },
  ai_insights: {
    label: "AI Insights", size: "half", icon: Sparkles, color: "#a855f7",
    description: "Suggestions based on recent data",
    render: () => <AIInsightsWidget />,
  },
};

export interface PresetDef {
  label: string;
  description: string;
  icon: LucideIcon;
  layout: string[];
}

export const PRESETS: Record<string, PresetDef> = {
  default: {
    label: "Default", description: "Balanced view set by your admin", icon: Layers,
    layout: ["kpi_inspections", "kpi_ncrs", "kpi_8ds", "kpi_overdue", "ncr_trend", "risk_dist", "activity", "assignments", "heatmap", "compliance"],
  },
  executive: {
    label: "Executive", description: "High-level KPIs and trends", icon: BarChart3,
    layout: ["kpi_ncrs", "kpi_copq", "kpi_passrate", "kpi_overdue", "ncr_trend", "risk_dist", "compliance", "supplier_score"],
  },
  qa_manager: {
    label: "QA Manager", description: "Day-to-day quality operations", icon: ClipboardCheck,
    layout: ["kpi_ncrs", "kpi_8ds", "kpi_passrate", "kpi_overdue", "ncr_trend", "pareto", "activity", "assignments", "heatmap", "pipeline_8d", "ai_insights"],
  },
  inspector: {
    label: "Inspector", description: "Field-focused, my work", icon: User,
    layout: ["kpi_inspections", "kpi_passrate", "kpi_overdue", "assignments", "activity"],
  },
  plant_lead: {
    label: "Plant Lead", description: "Site-level operations", icon: Shield,
    layout: ["kpi_inspections", "kpi_ncrs", "kpi_overdue", "kpi_copq", "heatmap", "inspector_load", "pareto", "activity", "compliance"],
  },
};

export const SIZE_TO_COLS: Record<WidgetSize, number> = { small: 3, half: 6, wide: 8, full: 12 };
