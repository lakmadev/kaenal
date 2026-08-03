"use client";

import { Calendar, Check, Eye, Lock, Users } from "lucide-react";
import type { EightDDto } from "@kaenal/types";
import type { MemberLookup } from "@/hooks/use-members";
import { Avatar } from "@/components/avatar";
import { DISCIPLINES, disciplineFor, fmtStepDate, stepData } from "./eightd-bits";
import { AiCardHeader, type AiControls } from "./eightd-copilot";

/**
 * The workflow column of the 8D detail (jsx `eightd.jsx`): the full D1–D8
 * stepper rail, and the active discipline's body. D1–D4 are the rich panels the
 * prototype details; D5–D8 render their structured `data` fields. Everything is
 * bound to the persisted 8D record.
 */

function statusOfStep(report: EightDDto, n: number): "complete" | "current" | "pending" {
  if (n < report.currentStep) return "complete";
  if (n === report.currentStep) return "current";
  return "pending";
}

// ——————————————————————————————————— the stepper rail
export function Stepper({ report, active, onSelect }: { report: EightDDto; active: number; onSelect: (n: number) => void }): React.ReactElement {
  const cur = report.currentStep;
  return (
    <div className="k-surface" style={{ padding: "24px 28px 22px" }}>
      <div className="mb-[18px] flex items-baseline justify-between">
        <div className="flex items-baseline gap-2.5">
          <span className="k-overline">Workflow progress</span>
          <span className="text-[11px] text-muted">
            {cur - 1} of {DISCIPLINES.length} complete · D{cur} in progress
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "var(--success-500)" }} />Complete</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "var(--warning-500)" }} />In progress</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "var(--surface)", border: "1.5px solid var(--border-strong)" }} />Pending</span>
        </div>
      </div>

      <div className="relative px-1">
        {/* connectors */}
        {DISCIPLINES.slice(0, -1).map((_, i) => {
          const n = i + 1;
          const inset = 18;
          const leftPct = ((n - 0.5) / DISCIPLINES.length) * 100;
          const rightPct = 100 - ((n + 0.5) / DISCIPLINES.length) * 100;
          const bothComplete = n + 1 < cur;
          const toCurrent = n + 1 === cur;
          const bg = bothComplete ? "var(--success-500)" : toCurrent ? "linear-gradient(90deg, var(--success-500), var(--warning-500))" : "var(--border)";
          return <div key={`c-${i}`} className="absolute z-0 h-0.5 rounded-sm" style={{ top: 17, left: `calc(${leftPct}% + ${inset}px)`, right: `calc(${rightPct}% + ${inset}px)`, background: bg }} />;
        })}

        <div className="relative grid" style={{ gridTemplateColumns: `repeat(${DISCIPLINES.length}, minmax(0, 1fr))` }}>
          {DISCIPLINES.map((s) => {
            const st = statusOfStep(report, s.n);
            const complete = st === "complete";
            const current = st === "current";
            const locked = st === "pending";
            const isActive = active === s.n;
            const statusLabel = complete ? "Complete" : current ? "In progress" : "Pending";
            const statusColor = complete ? "var(--success-600)" : current ? "var(--warning-700)" : "var(--text-subtle)";
            const done = report.steps[s.key]?.completedAt ?? null;
            return (
              <button
                key={s.key}
                onClick={() => !locked && onSelect(s.n)}
                disabled={locked}
                className="relative flex flex-col items-center gap-1.5 border-none bg-transparent px-0.5"
                style={{ cursor: locked ? "not-allowed" : "pointer", opacity: locked ? 0.55 : 1 }}
              >
                <div
                  className="z-[2] flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-bold transition-all"
                  style={{
                    background: complete ? "var(--success-500)" : current ? "var(--warning-500)" : "var(--surface)",
                    border: complete || current ? "none" : "2px solid var(--border-strong)",
                    color: complete || current ? "white" : "var(--text-muted)",
                    boxShadow: isActive
                      ? "0 0 0 4px var(--surface), 0 0 0 6px var(--accent), 0 4px 12px rgba(0,0,0,0.08)"
                      : current
                        ? "0 0 0 4px rgba(245,158,11,0.18)"
                        : "none",
                    transform: isActive ? "translateY(-1px)" : "none",
                  }}
                >
                  {complete ? <Check size={16} strokeWidth={3} /> : s.code}
                </div>

                <div className="mt-1 flex flex-col items-center gap-0.5">
                  <div className="text-[12px] font-bold" style={{ color: isActive ? "var(--accent)" : locked ? "var(--text-subtle)" : "var(--text)" }}>{s.title}</div>
                  <div className="max-w-[110px] text-center text-[10px] leading-tight text-muted">{s.desc}</div>
                </div>

                <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: statusColor }}>
                  {current && <span className="pulse-dot" style={{ background: "var(--warning-500)" }} />}
                  {complete && <Check size={10} strokeWidth={3} />}
                  {locked && <Lock size={9} />}
                  {statusLabel}
                </div>

                {complete && done && <div className="mono mt-px text-[10px] text-subtle">{fmtStepDate(done)}</div>}

                {isActive && (
                  <div className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white" style={{ background: "var(--accent)" }}>
                    <Eye size={10} />Viewing
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function StepHeader({ code, badge }: { code: string; badge: React.ReactNode }): React.ReactElement {
  const d = disciplineFor(parseInt(code[1] ?? "1", 10));
  return (
    <div className="mb-1 flex items-center gap-3 px-1">
      <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[var(--r-md)] text-[12px] font-bold text-white" style={{ background: "var(--accent)" }}>{code}</div>
      <div className="flex-1">
        <div className="text-[17px] font-bold tracking-tight">{d.title}</div>
        <div className="text-[12px] text-muted">{d.desc}</div>
      </div>
      {badge}
    </div>
  );
}

const completeBadge = (
  <span className="k-chip" style={{ background: "var(--success-100)", color: "var(--success-700)" }}>
    <Check size={11} strokeWidth={3} />Complete
  </span>
);

// ——————————————————————————————————— D1 team
export function D1Step({ report, lookup, ai }: { report: EightDDto; lookup: MemberLookup; ai: AiControls }): React.ReactElement {
  const roles = (stepData(report, "d1")["teamRoles"] ?? {}) as Record<string, string>;
  const lead = lookup.memberOf(report.teamLeadId);
  const champ = lookup.memberOf(report.championId);
  const members = report.memberIds;
  const personRow = (name: string, sub: string, teamRole?: string) => (
    <div className="flex items-center gap-2.5 rounded-[var(--r-md)] px-3 py-2" style={{ background: "var(--bg-subtle)" }}>
      <Avatar name={name} size={26} />
      <div className="flex-1">
        <div className="text-[13px] font-medium">{name}</div>
        <div className="text-[11px] capitalize text-muted">{sub}</div>
      </div>
      {teamRole && <span className="k-chip" style={{ background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>{teamRole}</span>}
    </div>
  );
  return (
    <div className="flex flex-col gap-3">
      <StepHeader code="D1" badge={completeBadge} />
      <div className="k-surface p-5">
        <AiCardHeader label="Team & roles" fieldKey="d1" ai={ai} />
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="k-overline mb-2">Team Lead</div>
            <div className="flex items-center gap-2.5">
              <Avatar name={lead?.name} size={36} />
              <div>
                <div className="text-[14px] font-semibold">{lead?.name ?? "Unassigned"}</div>
                <div className="text-[11px] capitalize text-muted">{lead?.role ?? ""}</div>
              </div>
            </div>
          </div>
          <div>
            <div className="k-overline mb-2">Champion / Sponsor</div>
            <div className="flex items-center gap-2.5">
              <Avatar name={champ?.name} size={36} />
              <div>
                <div className="text-[14px] font-semibold">{champ?.name ?? "Unassigned"}</div>
                <div className="text-[11px] capitalize text-muted">{champ?.role ?? ""}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-5">
          <div className="k-overline mb-2">Team members ({members.length})</div>
          <div className="flex flex-col gap-1.5">
            {members.map((uid) => {
              const m = lookup.memberOf(uid);
              return <div key={uid}>{personRow(m?.name ?? `${uid.slice(0, 8)}…`, m?.role ?? "", roles[uid])}</div>;
            })}
            {members.length === 0 && <div className="text-[12px] text-subtle">No additional members.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ——————————————————————————————————— D2 problem
export function D2Step({ report, ai }: { report: EightDDto; ai: AiControls }): React.ReactElement {
  const d = stepData(report, "d2");
  const problem = typeof d["problemStatement"] === "string" ? d["problemStatement"] : "";
  const isIsNot = (d["isIsNot"] ?? {}) as Record<string, { is: string; isNot: string }>;
  const cost = typeof d["cost"] === "number" ? d["cost"] : 0;
  const quantity = typeof d["quantity"] === "number" ? d["quantity"] : 0;
  const rows = Object.entries(isIsNot);
  return (
    <div className="flex flex-col gap-3">
      <StepHeader code="D2" badge={completeBadge} />
      <div className="k-surface p-5">
        <AiCardHeader label="Problem statement" fieldKey="d2-problem" ai={ai} />
        <p className="m-0 text-[13.5px] leading-relaxed">{problem || <span className="text-subtle">Not recorded.</span>}</p>
      </div>
      <div className="k-surface p-5">
        <AiCardHeader label="IS / IS NOT analysis" fieldKey="d2-isisnot" ai={ai} />
        <table className="w-full text-[13px]" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr>
              <th className="w-[90px] border-b px-2.5 py-2 text-left text-[11px] uppercase tracking-wide text-muted" style={{ borderColor: "var(--border)" }} />
              <th className="border-b px-2.5 py-2 text-left text-[11px] uppercase tracking-wide" style={{ borderColor: "var(--border)", color: "var(--success-700)" }}>IS</th>
              <th className="border-b px-2.5 py-2 text-left text-[11px] uppercase tracking-wide" style={{ borderColor: "var(--border)", color: "var(--danger-700)" }}>IS NOT</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([k, v], i) => {
              const border = i < rows.length - 1 ? "1px solid var(--border)" : "none";
              return (
                <tr key={k}>
                  <td className="p-2.5 font-semibold capitalize text-muted" style={{ borderBottom: border }}>{k === "howMuch" ? "How much" : k}</td>
                  <td className="p-2.5" style={{ borderBottom: border, background: "rgba(34,197,94,0.04)" }}>{v.is}</td>
                  <td className="p-2.5" style={{ borderBottom: border, background: "rgba(220,38,38,0.04)" }}>{v.isNot}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={3} className="py-3 text-center text-[12px] text-subtle">No IS / IS-NOT analysis recorded.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="k-surface p-5">
        <AiCardHeader label="Impact assessment" fieldKey="d2-impact" ai={ai} />
        <div className="grid grid-cols-3 gap-5">
          <div>
            <div className="k-overline">Cost impact</div>
            <div className="mono mt-1 text-[22px] font-bold" style={{ color: "var(--danger-600)" }}>${(cost / 1000).toFixed(0)}k</div>
          </div>
          <div>
            <div className="k-overline">Affected qty</div>
            <div className="mono mt-1 text-[22px] font-bold">{quantity.toLocaleString()}</div>
          </div>
          <div>
            <div className="k-overline">Customer impact</div>
            <div className="mt-1.5 text-[13px] font-semibold" style={{ color: "var(--warning-700)" }}>Tier-1 OEM notified — containment accepted</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ——————————————————————————————————— D3 containment
interface ContainmentAction {
  title: string;
  owner: string;
  status: string;
}
export function D3Step({ report, lookup, ai }: { report: EightDDto; lookup: MemberLookup; ai: AiControls }): React.ReactElement {
  const d = stepData(report, "d3");
  const actions = (d["actions"] ?? []) as ContainmentAction[];
  return (
    <div className="flex flex-col gap-3">
      <StepHeader
        code="D3"
        badge={
          <span className="k-chip" style={{ background: "var(--success-100)", color: "var(--success-700)" }}>
            <Check size={11} strokeWidth={3} />Complete — containment effective
          </span>
        }
      />
      <div className="k-surface overflow-hidden p-0">
        <div className="flex items-center gap-2.5 border-b px-5 py-3" style={{ borderColor: "var(--border)" }}>
          <span className="flex-1 text-[14px] font-semibold">Containment actions</span>
          <AiCardHeader label="" fieldKey="d3" ai={ai} />
        </div>
        {actions.map((a, i) => {
          const m = lookup.memberOf(a.owner);
          return (
            <div key={i} className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: i < actions.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-white" style={{ background: "var(--success-500)" }}>
                <Check size={12} strokeWidth={3} />
              </div>
              <div className="flex-1 text-[13px] font-medium">{a.title}</div>
              <Avatar name={m?.name} size={22} />
              <span className="k-chip" style={{ background: "var(--success-100)", color: "var(--success-700)", fontSize: 10.5 }}>{a.status}</span>
            </div>
          );
        })}
        {actions.length === 0 && <div className="px-5 py-4 text-[12px] text-subtle">No containment actions yet.</div>}
      </div>
    </div>
  );
}

// ——————————————————————————————————— D5–D8 simple field panels
export function SimpleStep({
  report,
  n,
  canManage,
  draft,
  setDraft,
}: {
  report: EightDDto;
  n: number;
  canManage: boolean;
  draft: Record<string, string>;
  setDraft: (next: Record<string, string>) => void;
}): React.ReactElement {
  const d = disciplineFor(n);
  const status = report.steps[d.key]?.status ?? "pending";
  const data = stepData(report, d.key);
  return (
    <div className="flex flex-col gap-3">
      <StepHeader
        code={d.code}
        badge={
          <span className="k-chip" style={{ background: status === "complete" ? "var(--success-100)" : "var(--bg-subtle)", color: status === "complete" ? "var(--success-700)" : "var(--text-muted)" }}>
            {status === "complete" ? "Complete" : status === "in_progress" ? "In progress" : "Pending"}
          </span>
        }
      />
      <div className="k-surface flex flex-col gap-3 p-5">
        {d.fields.map((f) => (
          <label key={f.key} className="flex flex-col gap-1">
            <span className="text-[12px] font-medium">{f.label}</span>
            {canManage ? (
              <textarea
                className="k-input w-full"
                rows={f.rows ?? 3}
                placeholder={f.placeholder}
                value={draft[f.key] ?? ""}
                onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                style={{ resize: "vertical" }}
              />
            ) : (
              <div className="rounded-md border p-2.5 text-[12.5px]" style={{ borderColor: "var(--border)", minHeight: 40, whiteSpace: "pre-wrap" }}>
                {typeof data[f.key] === "string" && data[f.key] !== "" ? (data[f.key] as string) : <span className="text-subtle">Not recorded yet.</span>}
              </div>
            )}
          </label>
        ))}
      </div>
    </div>
  );
}

export function StepLocked({ n }: { n: number }): React.ReactElement {
  const d = disciplineFor(n);
  return (
    <div className="k-surface p-10 text-center text-muted">
      <div className="mb-3 inline-flex rounded-full p-3.5" style={{ background: "var(--bg-subtle)" }}>
        <Lock size={26} />
      </div>
      <div className="mb-1 text-[16px] font-semibold text-text">
        {d.code} · {d.title} — Locked
      </div>
      <div className="text-[13px]">Complete the previous discipline to unlock.</div>
    </div>
  );
}

export { Users, Calendar };
