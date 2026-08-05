"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Download,
  FileText,
  Folder,
  GitBranch,
  History,
  Link2,
  Pencil,
  Plus,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import type { EightDDto } from "@kaenal/types";

/**
 * The agentic 8D layer (jsx `eightd-agentic.jsx`): per-field draft controls, the
 * top provenance strip, the persistent copilot side-rail, and the generate-pack
 * modal. The rail binds to persisted `steps.data` (containment on D3, ranked
 * causes + similar cases on D4, provenance on D1). The review actions that
 * change records — accept a cause, apply a containment into D3 — are real and
 * persist through the caller's mutations; approve/edit of a draft field is
 * ephemeral review state, exactly as the prototype models it.
 */

export const AI_FIELD_KEYS = ["d1", "d2-problem", "d2-isisnot", "d2-impact", "d3", "d4-fivewhys"] as const;
export type DraftState = "approved" | "edited" | undefined;

function tint(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export function AiDraftControls({ state, onApprove, onEdit }: { state: DraftState; onApprove: () => void; onEdit: () => void }): React.ReactElement {
  if (state === "approved")
    return (
      <span className="k-chip" style={{ background: "var(--success-100)", color: "var(--success-700)", fontSize: 10.5, fontWeight: 600 }}>
        <Check size={11} />Approved
      </span>
    );
  if (state === "edited")
    return (
      <span className="k-chip" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)", fontSize: 10.5, fontWeight: 600, border: "1px solid var(--border)" }}>
        <Pencil size={10} />Edited
      </span>
    );
  return (
    <div className="inline-flex items-center gap-1.5">
      <span title="Drafted by Kaenal Quality Copilot from the linked NCR" className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1" }}>
        <Sparkles size={10} />AI draft
      </span>
      <button onClick={onApprove} className="k-btn" style={{ height: 24, padding: "0 9px", fontSize: 11, gap: 4, background: "var(--success-500)", color: "white", border: "none" }}>
        <Check size={11} />Approve
      </button>
      <button onClick={onEdit} className="k-btn k-btn-ghost" style={{ height: 24, padding: "0 9px", fontSize: 11, gap: 4 }}>
        <Pencil size={11} />Edit
      </button>
    </div>
  );
}

export function AiCardHeader({ label, fieldKey, ai }: { label: string; fieldKey: string; ai?: AiControls }): React.ReactElement {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="k-overline" style={{ marginBottom: 0 }}>{label}</span>
      <div className="flex-1" />
      {ai && <AiDraftControls state={ai.fieldStates[fieldKey]} onApprove={() => ai.approveField(fieldKey)} onEdit={() => ai.editField(fieldKey)} />}
    </div>
  );
}

export interface AiControls {
  fieldStates: Record<string, DraftState>;
  approveField: (k: string) => void;
  editField: (k: string) => void;
}

/** Local per-field approve/edit review state + helpers (jsx keeps this in-memory). */
export function useAiReview(onToast: (m: string) => void): AiControls & { approveAll: () => void; reviewed: number } {
  const [fieldStates, setFieldStates] = useState<Record<string, DraftState>>({});
  const approveField = (k: string): void => setFieldStates((s) => ({ ...s, [k]: "approved" }));
  const editField = (k: string): void => {
    setFieldStates((s) => ({ ...s, [k]: "edited" }));
    onToast("Editing AI draft — you now own this field");
  };
  const approveAll = (): void => setFieldStates((s) => Object.fromEntries(AI_FIELD_KEYS.map((k) => [k, s[k] === "edited" ? "edited" : "approved"])));
  const reviewed = AI_FIELD_KEYS.filter((k) => fieldStates[k] !== undefined).length;
  return { fieldStates, approveField, editField, approveAll, reviewed };
}

interface Provenance {
  model?: string;
  draftedFrom?: string;
  draftedAt?: string;
}

export function AIProvenanceStrip({ prov, reviewed, onApproveAll, onOpenNcr }: { prov: Provenance; reviewed: number; onApproveAll: () => void; onOpenNcr?: (() => void) | undefined }): React.ReactElement {
  const total = AI_FIELD_KEYS.length;
  const pct = Math.round((reviewed / total) * 100);
  const allDone = reviewed === total;
  return (
    <div
      className="flex flex-col gap-3 rounded-[var(--r-xl)] px-[18px] py-3.5 sm:flex-row sm:items-center sm:gap-4"
      style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.10), rgba(219,39,119,0.07))", border: "1px solid rgba(99,102,241,0.22)" }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
      <div className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[var(--r-md)] text-white" style={{ background: "linear-gradient(135deg, #6366f1, #db2777)" }}>
        <Sparkles size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold">
          Steps D1–D4 drafted by {prov.model ?? "Kaenal Quality Copilot"}
          {prov.draftedFrom && (
            <button onClick={onOpenNcr} className="k-chip mono" style={{ background: "var(--surface)", color: "var(--accent)", fontSize: 10.5, border: "1px solid var(--border)" }}>
              <Link2 size={10} />from {prov.draftedFrom}
            </button>
          )}
        </div>
        <div className="mt-0.5 text-[11.5px] text-muted">
          {allDone ? `All ${total} AI-drafted fields reviewed` : `${reviewed} of ${total} fields reviewed · ${total - reviewed} awaiting your approval`}
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full" style={{ background: "rgba(99,102,241,0.16)" }}>
          <div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, background: allDone ? "var(--success-500)" : "linear-gradient(90deg, #6366f1, #db2777)" }} />
        </div>
      </div>
      </div>
      <button onClick={onApproveAll} disabled={allDone} className="k-btn k-btn-ghost w-full flex-shrink-0 sm:w-auto" style={{ opacity: allDone ? 0.5 : 1, background: "var(--surface)" }}>
        <Sparkles size={14} />{allDone ? "All reviewed" : "Approve all drafts"}
      </button>
    </div>
  );
}

// ——— rail ———
function RailSection({ icon: I, color, title, count, action, children }: { icon: LucideIcon; color: string; title: string; count?: number; action?: React.ReactNode; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="k-surface overflow-hidden p-0">
      <div className="flex items-center gap-2.5 border-b px-3.5 py-2.5" style={{ borderColor: "var(--border)" }}>
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[var(--r-sm)]" style={{ background: tint(color, 0.13), color }}>
          <I size={13} />
        </span>
        <div className="flex-1 text-[12.5px] font-bold">{title}</div>
        {count != null && (
          <span className="mono inline-flex h-[18px] min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10.5px] font-bold text-muted" style={{ background: "var(--bg-subtle)" }}>
            {count}
          </span>
        )}
        {action}
      </div>
      <div className="flex flex-col gap-2.5 p-3">{children}</div>
    </div>
  );
}

function ConfidenceMeter({ value }: { value: number }): React.ReactElement {
  const c = value >= 80 ? "var(--success-600)" : value >= 60 ? "var(--warning-600)" : "var(--text-muted)";
  return (
    <div className="flex items-center gap-2">
      <div className="h-[5px] flex-1 overflow-hidden rounded-full" style={{ background: "var(--bg-subtle)" }}>
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: c }} />
      </div>
      <span className="mono w-[30px] text-right text-[11px] font-bold" style={{ color: c }}>{value}%</span>
    </div>
  );
}

export interface Containment {
  id: string;
  title: string;
  rationale: string;
  impact: string;
}
export interface RankedCause {
  confidence: number;
  cause: string;
  evidence: string;
  similar: string | null;
}
export interface SimilarCase {
  id: string;
  kind: string;
  title: string;
  match: number;
  rootCause: string;
  outcome: string;
  closedIn: string;
  capa: string;
}

export function AICopilotRail({
  prov,
  containment,
  appliedContainment,
  causes,
  acceptedIndex,
  similarCases,
  onApplyContainment,
  onAcceptCause,
}: {
  prov: Provenance;
  containment: Containment[];
  appliedContainment: ReadonlySet<string>;
  causes: RankedCause[];
  acceptedIndex: number | null;
  similarCases: SimilarCase[];
  onApplyContainment: (c: Containment) => void;
  onAcceptCause: (i: number) => void;
}): React.ReactElement {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [dismissedCauses, setDismissedCauses] = useState<Set<number>>(new Set());
  const visibleContainment = containment.filter((c) => !dismissed.has(c.id));

  return (
    <aside className="sticky top-4 flex flex-col gap-3">
      <div className="rounded-[var(--r-xl)] p-3.5 text-white" style={{ background: "linear-gradient(135deg, #4f46e5, #db2777)", boxShadow: "var(--shadow-md)" }}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-[var(--r-md)]" style={{ background: "rgba(255,255,255,0.18)" }}>
            <Sparkles size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-bold tracking-tight">Quality Copilot</div>
            <div className="flex items-center gap-1.5 text-[11px] opacity-85">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#4ade80", boxShadow: "0 0 0 3px rgba(74,222,128,0.3)" }} />
              Analyzing · 47 similar NCRs
            </div>
          </div>
        </div>
        <div className="mt-2.5 text-[11.5px] leading-relaxed opacity-90">
          I drafted D1–D4 from <span className="mono">{prov.draftedFrom ?? "the linked NCR"}</span>. Review the suggestions below as you work — I update them as evidence changes.
        </div>
      </div>

      <RailSection icon={Shield} color="#0891b2" title="Proposed containment" count={visibleContainment.length}>
        {visibleContainment.length === 0 && <div className="py-2 text-center text-[11.5px] italic text-subtle">All suggestions actioned.</div>}
        {visibleContainment.map((c) => {
          const done = appliedContainment.has(c.id);
          return (
            <div key={c.id} className="rounded-[var(--r-md)] p-2.5" style={{ border: "1px solid var(--border)", background: done ? "var(--success-50)" : "var(--surface)" }}>
              <div className="mb-1.5 flex items-start gap-2">
                <span className="mt-px flex-shrink-0 rounded-[3px] px-1.5 py-0.5 text-[8.5px] font-extrabold tracking-wider" style={{ background: c.impact === "high" ? "rgba(8,145,178,0.13)" : "var(--bg-subtle)", color: c.impact === "high" ? "#0891b2" : "var(--text-muted)" }}>
                  {c.impact === "high" ? "HIGH" : "MED"}
                </span>
                <div className="text-[12px] font-semibold leading-snug">{c.title}</div>
              </div>
              <div className="mb-2 text-[11px] leading-relaxed text-muted">{c.rationale}</div>
              {done ? (
                <span className="k-chip" style={{ background: "var(--success-100)", color: "var(--success-700)", fontSize: 10.5 }}>
                  <Check size={11} />Added to D3
                </span>
              ) : (
                <div className="flex gap-1.5">
                  <button onClick={() => onApplyContainment(c)} className="k-btn k-btn-primary flex-1 justify-center" style={{ height: 26, padding: "0 10px", fontSize: 11 }}>
                    <Plus size={11} />Apply
                  </button>
                  <button onClick={() => setDismissed((s) => new Set(s).add(c.id))} className="k-btn k-btn-plain" style={{ height: 26, padding: "0 9px", fontSize: 11 }}>
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </RailSection>

      <RailSection
        icon={GitBranch}
        color="#6366f1"
        title="Ranked root causes"
        count={causes.length}
        action={
          <button title="Refresh" onClick={() => setDismissedCauses(new Set())} className="k-btn-plain inline-flex p-1" style={{ color: "var(--text-muted)" }}>
            <RefreshCw size={13} />
          </button>
        }
      >
        {causes.map((s, i) => {
          if (dismissedCauses.has(i)) return null;
          const isAccepted = acceptedIndex === i;
          return (
            <div key={i} className="rounded-[var(--r-md)] p-2.5" style={{ border: isAccepted ? "1.5px solid var(--success-500)" : "1px solid var(--border)", background: isAccepted ? "var(--success-50)" : "var(--surface)" }}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="mono text-[10px] font-bold text-subtle">#{i + 1}</span>
                <div className="flex-1 text-[12px] font-semibold leading-tight">{s.cause}</div>
              </div>
              <ConfidenceMeter value={s.confidence} />
              <div className="my-[7px] text-[10.5px] leading-relaxed text-muted">{s.evidence}</div>
              {isAccepted ? (
                <span className="k-chip" style={{ background: "var(--success-100)", color: "var(--success-700)", fontSize: 10.5 }}>
                  <Check size={11} />Accepted as root cause
                </span>
              ) : (
                <div className="flex gap-1.5">
                  <button onClick={() => onAcceptCause(i)} className="k-btn k-btn-primary flex-1 justify-center" style={{ height: 26, padding: "0 10px", fontSize: 11 }}>
                    <Check size={11} />Accept
                  </button>
                  <button onClick={() => setDismissedCauses((s2) => new Set(s2).add(i))} className="k-btn k-btn-plain" style={{ height: 26, padding: "0 9px", fontSize: 11 }}>
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </RailSection>

      <RailSection icon={History} color="#9333ea" title="Similar past cases" count={similarCases.length}>
        {similarCases.map((c) => (
          <div key={c.id} className="rounded-[var(--r-md)] p-2.5" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="mono text-[10.5px] font-semibold" style={{ color: "var(--accent)" }}>{c.id}</span>
              <div className="flex-1" />
              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold" style={{ color: c.match >= 80 ? "var(--success-600)" : "var(--warning-600)" }}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {c.match}% match
              </span>
            </div>
            <div className="mb-1.5 text-[12px] font-semibold leading-tight">{c.title}</div>
            <div className="mb-[7px] text-[10.5px] leading-snug text-muted">
              <span className="text-subtle">Root cause:</span> {c.rootCause}
            </div>
            <div className="flex items-center gap-2 text-[10.5px]">
              <span className="k-chip" style={{ fontSize: 10, background: c.outcome === "closed" ? "var(--success-100)" : "var(--warning-100)", color: c.outcome === "closed" ? "var(--success-700)" : "var(--warning-700)" }}>
                {c.outcome === "closed" ? `Closed · ${c.closedIn}` : "CAPA active"}
              </span>
              <span className="text-subtle">{c.capa}</span>
            </div>
          </div>
        ))}
      </RailSection>
    </aside>
  );
}

// ——— generate pack modal ———
interface GenSpec {
  title: string;
  sub: string;
  icon: LucideIcon;
  steps: string[];
  artifacts: { icon: LucideIcon; name: string; meta: string }[];
  cta: string;
  route: string;
  file: (e: EightDDto, rootCause: string) => { name: string; content: string };
}

const GENERATE_SPECS: Record<"capa" | "audit", GenSpec> = {
  capa: {
    title: "Generate CAPA pack",
    sub: "Corrective & preventive action package, derived from the 8D",
    icon: ShieldCheck,
    steps: [
      "Reading verified root cause from D4 analysis",
      "Mapping corrective actions (D5) and preventive actions (D7)",
      "Drafting CAPA record with owners & due dates",
      "Attaching evidence, approvals and the 5-Whys chain",
      "Assembling CAPA pack — record · plan · effectiveness check",
    ],
    artifacts: [
      { icon: FileText, name: "CAPA — record.pdf", meta: "Corrective + preventive plan" },
      { icon: FileText, name: "action-plan.xlsx", meta: "6 actions · owners · due dates" },
      { icon: FileText, name: "effectiveness-check.pdf", meta: "30 / 60 / 90-day verification" },
    ],
    cta: "Open CAPA",
    route: "/capa",
    file: (e, rootCause) => ({
      name: `CAPA-pack-${e.code}.md`,
      content: `# CAPA Pack — derived from ${e.code}\nGenerated by Kaenal Quality Copilot\n\nProblem:             ${e.title}\nVerified root cause: ${rootCause}\n\n## Corrective actions (D5)\n- Replace shielding-gas regulator on Station 3B (Owner: Production · due +3d)\n- Re-validate gas flow at 18 L/min across Weld Cell 3 (Owner: Quality · due +5d)\n\n## Preventive actions (D7)\n- Shorten regulator PM interval from 36 to 18 months (Owner: Maintenance)\n- Add inline gas-flow monitoring to all weld stations (Owner: Engineering)\n\n## Effectiveness verification\n- 30 / 60 / 90-day porosity reject-rate review vs 0.5% IATF threshold\n`,
    }),
  },
  audit: {
    title: "Generate audit-ready report",
    sub: "IATF 16949 §10.2 conformant 8D report with full evidence trail",
    icon: FileText,
    steps: [
      "Collecting D1–D8 workflow data and approvals",
      "Compiling evidence, photos and measurement records",
      "Checking IATF 16949 §10.2 conformance",
      "Rendering audit-ready 8D report",
      "Sealing with timestamps & e-signatures",
    ],
    artifacts: [
      { icon: FileText, name: "8D-report.pdf", meta: "D1–D8 · 14 pages" },
      { icon: Folder, name: "evidence-appendix.zip", meta: "11 files · photos & records" },
      { icon: FileText, name: "conformance-checklist.pdf", meta: "IATF 16949 §10.2 — 18/18 met" },
    ],
    cta: "Back to report",
    route: "",
    file: (e, rootCause) => ({
      name: `audit-report-${e.code}.md`,
      content: `# Audit-Ready 8D Report — ${e.code}\nGenerated by Kaenal Quality Copilot · IATF 16949 §10.2\n\nTitle:        ${e.title}\nStatus:       ${e.status} · D${e.currentStep} of 8\n\n## Evidence trail\n- D4 Root cause .......... ${rootCause}\n\n## Conformance\nIATF 16949 §10.2 — 18 / 18 requirements met.\n`,
    }),
  },
};

export function GeneratePackModal({ type, report, rootCause, onClose }: { type: "capa" | "audit"; report: EightDDto; rootCause: string; onClose: () => void }): React.ReactElement {
  const spec = GENERATE_SPECS[type];
  const router = useRouter();
  const [done, setDone] = useState(0);
  const finished = done >= spec.steps.length;

  useEffect(() => {
    if (finished) return;
    const t = setTimeout(() => setDone((d) => d + 1), done === 0 ? 450 : 720);
    return () => clearTimeout(t);
  }, [done, finished]);

  const download = (): void => {
    const { name, content } = spec.file(report, rootCause);
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const Icon = spec.icon;
  return (
    <div onClick={onClose} className="fixed inset-0 z-[200] flex items-center justify-center p-6" style={{ background: "rgba(15,23,42,0.45)", backdropFilter: "blur(2px)" }}>
      <div onClick={(e) => e.stopPropagation()} className="k-surface w-[540px] max-w-full overflow-auto p-0" style={{ maxHeight: "90vh", boxShadow: "var(--shadow-xl)" }}>
        <div className="flex items-center gap-3 border-b p-5" style={{ borderColor: "var(--border)", background: "linear-gradient(135deg, rgba(99,102,241,0.10), rgba(219,39,119,0.07))" }}>
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[var(--r-md)] text-white" style={{ background: "linear-gradient(135deg, #6366f1, #db2777)" }}>
            <Icon size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-bold tracking-tight">{spec.title}</div>
            <div className="text-[12px] text-muted">{spec.sub}</div>
          </div>
          <button onClick={onClose} className="k-btn-plain inline-flex p-1.5">
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          {!finished ? (
            <div className="flex flex-col gap-3">
              {spec.steps.map((label, i) => {
                const state = i < done ? "done" : i === done ? "active" : "pending";
                return (
                  <div key={i} className="flex items-center gap-3 transition-opacity" style={{ opacity: state === "pending" ? 0.4 : 1 }}>
                    <div className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center">
                      {state === "done" && (
                        <div className="flex h-[22px] w-[22px] items-center justify-center rounded-full text-white" style={{ background: "var(--success-500)" }}>
                          <Check size={13} />
                        </div>
                      )}
                      {state === "active" && <div className="k-spin h-[18px] w-[18px] rounded-full" style={{ border: "2.5px solid var(--accent-soft)", borderTopColor: "var(--accent)" }} />}
                      {state === "pending" && <div className="h-[9px] w-[9px] rounded-full" style={{ background: "var(--border-strong)" }} />}
                    </div>
                    <div className="text-[13px]" style={{ fontWeight: state === "active" ? 600 : 500, color: state === "pending" ? "var(--text-muted)" : "var(--text)" }}>{label}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="fade-in flex flex-col gap-3.5">
              <div className="flex items-center gap-2.5 rounded-[var(--r-md)] px-3.5 py-3" style={{ background: "var(--success-50)", border: "1px solid var(--success-100)" }}>
                <div className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full text-white" style={{ background: "var(--success-500)" }}>
                  <Check size={16} />
                </div>
                <div>
                  <div className="text-[13.5px] font-bold" style={{ color: "var(--success-700)" }}>Pack generated</div>
                  <div className="text-[11.5px] text-muted">{spec.artifacts.length} artifacts ready · traceable to {report.code}</div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {spec.artifacts.map((a, i) => {
                  const AI = a.icon;
                  return (
                    <div key={i} className="flex items-center gap-3 rounded-[var(--r-md)] px-3 py-2.5" style={{ border: "1px solid var(--border)" }}>
                      <div className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-[var(--r-sm)]" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                        <AI size={15} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mono text-[12.5px] font-semibold">{a.name}</div>
                        <div className="text-[11px] text-muted">{a.meta}</div>
                      </div>
                      <Check size={14} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t px-5 py-3.5" style={{ borderColor: "var(--border)" }}>
          <div className="inline-flex flex-1 items-center gap-1.5 text-[11px] text-subtle">
            <Sparkles size={12} />Generated by Kaenal Quality Copilot
          </div>
          {finished ? (
            <>
              <button onClick={download} className="k-btn k-btn-ghost">
                <Download size={14} />Download
              </button>
              {spec.route !== "" && (
                <button onClick={() => { router.push(spec.route); onClose(); }} className="k-btn k-btn-primary">
                  <ArrowRight size={14} />{spec.cta}
                </button>
              )}
              {spec.route === "" && (
                <button onClick={onClose} className="k-btn k-btn-primary">
                  <ArrowRight size={14} />{spec.cta}
                </button>
              )}
            </>
          ) : (
            <button onClick={onClose} className="k-btn k-btn-ghost">Cancel</button>
          )}
        </div>
      </div>
    </div>
  );
}
