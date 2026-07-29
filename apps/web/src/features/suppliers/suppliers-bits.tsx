import { Sparkles, Star, Clock, type LucideIcon } from "lucide-react";
import type { RiskLevel, SupplierProfile } from "@kaenal/types";
import { Chip } from "@/components/ui";

/**
 * Supplier risk tiers. The API models the manual grade on the shared
 * `RiskLevel` scale (low…critical); the visual spec (`suppliers.jsx`) labels the
 * same four bands A…D (A = preferred … D = critical). This map is the single
 * translation point — the letter, colour, and label all come from here so the
 * list, detail, matrix, and scorecard read identically.
 */
export type SupplierTier = "A" | "B" | "C" | "D";

export const RISK_LEVEL_TO_TIER: Record<RiskLevel, SupplierTier> = {
  low: "A",
  medium: "B",
  high: "C",
  critical: "D",
};

interface TierStyle {
  label: string;
  dot: string;
  bg: string;
  fg: string;
}

export const RISK_TIER: Record<SupplierTier, TierStyle> = {
  A: { label: "A · Preferred", dot: "#16a34a", bg: "rgba(34,197,94,0.10)", fg: "#15803d" },
  B: { label: "B · Approved", dot: "#3b82f6", bg: "rgba(59,130,246,0.10)", fg: "var(--primary-700)" },
  C: { label: "C · Conditional", dot: "#f59e0b", bg: "rgba(245,158,11,0.12)", fg: "#92400e" },
  D: { label: "D · Critical", dot: "#dc2626", bg: "rgba(220,38,38,0.10)", fg: "#b91c1c" },
};

/** Resolve a supplier's letter tier from its (nullable) manual `riskTier`. */
export function tierOf(riskTier: RiskLevel | null): SupplierTier {
  return riskTier === null ? "B" : RISK_LEVEL_TO_TIER[riskTier];
}

export function RiskTierBadge({
  riskTier,
  ai = false,
  confidence,
}: {
  riskTier: RiskLevel | null;
  ai?: boolean;
  confidence?: number | null;
}): React.ReactElement {
  const t = RISK_TIER[tierOf(riskTier)];
  return (
    <Chip
      bg={t.bg}
      fg={t.fg}
      dot={t.dot}
      style={{ fontWeight: 600 }}
      title={ai && confidence != null ? `AI confidence ${confidence}%` : undefined}
    >
      {t.label}
      {ai && <Sparkles size={10} />}
    </Chip>
  );
}

/**
 * Supplier monogram. The API has no logo asset, so we render the code on a
 * stable colour derived from the code itself (never a fabricated brand colour) —
 * `profile.color` overrides it when an import supplies one.
 */
const LOGO_PALETTE = ["#0f172a", "#1d4ed8", "#0e7490", "#4338ca", "#b45309", "#15803d", "#9a3412", "#7c3aed"];

/** Up to two initials from a business name (skips filler words like "and"). */
function initials(name: string): string {
  const words = name
    .split(/\s+/)
    .filter((w) => w.length > 0 && !["and", "the", "of", "&"].includes(w.toLowerCase()));
  const letters = words.slice(0, 2).map((w) => w[0] ?? "");
  return letters.join("").toUpperCase();
}

function colorFor(code: string, profile: SupplierProfile): string {
  const fromProfile = profile["color"];
  if (typeof fromProfile === "string" && fromProfile !== "") return fromProfile;
  let hash = 0;
  for (let i = 0; i < code.length; i++) hash = (hash * 31 + code.charCodeAt(i)) | 0;
  return LOGO_PALETTE[Math.abs(hash) % LOGO_PALETTE.length] ?? "#0f172a";
}

export function SupplierLogo({
  name,
  code,
  profile,
  size = 32,
  rounded = 6,
}: {
  name: string;
  code: string;
  profile: SupplierProfile;
  size?: number;
  rounded?: number;
}): React.ReactElement {
  // Monogram from the name's initials (Bharat Forge → "BF"); the colour is still
  // keyed off the stable code so it never shifts on a rename.
  const mono = initials(name) || code.replace(/[^A-Za-z0-9]/g, "").slice(0, 2);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        background: colorFor(code, profile),
        color: "white",
        fontWeight: 700,
        fontSize: size * 0.32,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        letterSpacing: "0.04em",
      }}
      aria-hidden
    >
      {mono.toUpperCase()}
    </div>
  );
}

/** Inline sparkline (SVG polyline) — matches `suppliers.jsx` MiniSpark. */
export function MiniSpark({
  data,
  color = "var(--accent)",
  w = 56,
  h = 18,
}: {
  data: number[] | null | undefined;
  color?: string;
  w?: number;
  h?: number;
}): React.ReactElement | null {
  if (data == null || data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block" }} aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * A KPI value against its target: green when meeting target, red when missing.
 * The pass/fail is a display comparison only — the weighted score that actually
 * grades the supplier is computed server-side (`SupplierDto.score`).
 */
export function KpiCell({
  value,
  target,
  lowerIsBetter = false,
  suffix = "",
  spark,
  mini = false,
}: {
  value: number | null | undefined;
  target: number | null | undefined;
  lowerIsBetter?: boolean;
  suffix?: string;
  spark?: number[] | null | undefined;
  mini?: boolean;
}): React.ReactElement {
  if (value == null) return <span className="text-subtle">—</span>;
  const bad = target == null ? false : lowerIsBetter ? value > target : value < target;
  const color = target == null ? "var(--text)" : bad ? "#dc2626" : "#16a34a";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontWeight: 600, fontSize: mini ? 12 : 13, color, fontVariantNumeric: "tabular-nums" }}>
        {value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
        {suffix}
      </span>
      {spark != null && <MiniSpark data={spark} color={color} />}
    </div>
  );
}

/**
 * Supplier flag chips (cert-expiring, audit-overdue, ppm-breach, chargeback-high,
 * preferred, benchmark, no-iatf). Unknown flags render as neutral chips so the
 * server can add flags without a UI change.
 */
const FLAG_STYLES: Record<string, { label: string; bg: string; fg: string; icon?: LucideIcon }> = {
  preferred: { label: "Preferred", bg: "rgba(34,197,94,0.10)", fg: "#15803d", icon: Star },
  benchmark: { label: "Benchmark", bg: "rgba(99,102,241,0.10)", fg: "#4338ca" },
  "cert-expiring": { label: "Cert expiring", bg: "rgba(245,158,11,0.12)", fg: "#92400e", icon: Clock },
  "audit-overdue": { label: "Audit overdue", bg: "rgba(220,38,38,0.10)", fg: "#b91c1c" },
  "ppm-breach": { label: "PPM breach", bg: "rgba(220,38,38,0.10)", fg: "#b91c1c" },
  "chargeback-high": { label: "Chargebacks high", bg: "rgba(124,58,237,0.10)", fg: "#6d28d9" },
  "no-iatf": { label: "No IATF cert", bg: "rgba(220,38,38,0.10)", fg: "#b91c1c" },
};

export function FlagChip({ flag }: { flag: string }): React.ReactElement {
  const s = FLAG_STYLES[flag] ?? { label: flag, bg: "var(--bg-subtle)", fg: "var(--text-muted)" };
  const Icon = s.icon;
  return (
    <Chip bg={s.bg} fg={s.fg}>
      {Icon !== undefined && <Icon size={10} />}
      {s.label}
    </Chip>
  );
}

// --- Typed accessors over the open `profile` jsonb -------------------------
// The profile carries display-only bulk (spend, parts, contact, insights). It
// is an open record, so read it defensively and degrade to null when absent —
// never fabricate a value.

export function profileNum(profile: SupplierProfile, key: string): number | null {
  const v = profile[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function profileStr(profile: SupplierProfile, key: string): string | null {
  const v = profile[key];
  return typeof v === "string" && v !== "" ? v : null;
}

export function profileArr(profile: SupplierProfile, key: string): unknown[] {
  const v = profile[key];
  return Array.isArray(v) ? v : [];
}

export interface AiInsight {
  kind: string;
  text: string;
}

export function aiInsights(profile: SupplierProfile): AiInsight[] {
  return profileArr(profile, "aiInsights").filter(
    (i): i is AiInsight => typeof i === "object" && i !== null && "text" in i && typeof i.text === "string",
  );
}
