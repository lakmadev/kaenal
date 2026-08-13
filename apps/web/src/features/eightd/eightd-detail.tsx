"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  GitBranch,
  Link2,
  MoreHorizontal,
  Plus,
  Send,
  Sparkles,
  Target,
  Trash2,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import type { EightDDto } from "@kaenal/types";
import { longDate } from "@/lib/format";
import { errorMessage } from "@/lib/api-error";
import { useMe, hasCapability } from "@/hooks/use-me";
import { useMemberLookup } from "@/hooks/use-members";
import { useEightD, useUpdateEightDStep, useTransitionEightD, useAssignEightD } from "@/hooks/use-eightd";
import type { AssignEightDBody } from "@kaenal/types";
import { Avatar } from "@/components/avatar";
import { Button, EmptyState, Skeleton, useToast } from "@/components/ui";
import { EightDStatusBadge, stepData } from "./eightd-bits";
import { D1Step, D2Step, D3Step, SimpleStep, StepLocked, Stepper, StepHeader } from "./eightd-steps";
import {
  AICopilotRail,
  AIProvenanceStrip,
  GeneratePackModal,
  useAiReview,
  type Containment,
  type RankedCause,
  type SimilarCase,
} from "./eightd-copilot";
import { MethodPicker, RcaBuilder, methodFor, tintColor, type Analysis, type RcaType } from "./eightd-rca";

export function EightDDetail({ id }: { id: string }): React.ReactElement {
  const router = useRouter();
  const { data: me } = useMe();
  const { data: report, isLoading, isError } = useEightD(id);

  if (isLoading) return <DetailSkeleton />;
  if (isError || report === undefined) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <BackLink onClick={() => router.push("/8d")} />
        <div className="k-surface mt-4">
          <EmptyState icon={TriangleAlert} title="8D report not found" body="It may have been removed, or you may not have access." />
        </div>
      </div>
    );
  }
  return <DetailView report={report} meId={me?.userId} canManage={hasCapability(me, "ncr:manage")} />;
}

function DetailView({
  report,
  meId,
  canManage,
}: {
  report: EightDDto;
  meId: string | undefined;
  canManage: boolean;
}): React.ReactElement {
  const router = useRouter();
  const toast = useToast();
  const lookup = useMemberLookup();
  const update = useUpdateEightDStep(report.id);
  const transition = useTransitionEightD(report.id);
  const assign = useAssignEightD(report.id);
  const ai = useAiReview((m) => toast.toast(m, "info"));

  const [active, setActive] = useState(report.currentStep);
  useEffect(() => setActive(report.currentStep), [report.currentStep]);
  const [genModal, setGenModal] = useState<"capa" | "audit" | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!moreOpen) return;
    const close = (e: MouseEvent): void => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [moreOpen]);

  const d1 = stepData(report, "d1");
  const d3 = stepData(report, "d3");
  const d4 = stepData(report, "d4");
  const prov = (d1["ai"] ?? {}) as { model?: string; draftedFrom?: string; draftedAt?: string };
  const containment = (d3["aiContainment"] ?? []) as Containment[];
  const appliedIds = new Set((d3["appliedContainmentIds"] ?? []) as string[]);
  const causes = (d4["aiSuggestions"] ?? []) as RankedCause[];
  const similarCases = (d4["similarCases"] ?? []) as SimilarCase[];
  const acceptedIndex = typeof d4["acceptedIndex"] === "number" ? d4["acceptedIndex"] : null;
  const rootCauseText = acceptedIndex !== null ? causes[acceptedIndex]?.cause ?? "" : causes[0]?.cause ?? "See D4 analysis";

  const decided = report.status !== "active";

  const saveStep = (n: number, data: Record<string, unknown>, status: "complete" | "in_progress", ok: string): void => {
    update.mutate(
      { step: n, body: { status, data, version: report.lockVersion } },
      { onSuccess: () => toast.success(ok), onError: (e) => toast.error(errorMessage(e)) },
    );
  };

  const applyContainment = (c: Containment): void => {
    const actions = [...((d3["actions"] ?? []) as unknown[]), { title: c.title, owner: report.teamLeadId ?? "", status: "completed" }];
    saveStep(3, { ...d3, actions, appliedContainmentIds: [...appliedIds, c.id] }, "complete", "Containment added to D3");
  };
  const acceptCause = (i: number): void => {
    saveStep(4, { ...d4, acceptedIndex: i, rootCause: causes[i]?.cause ?? "" }, report.steps.d4?.status === "complete" ? "complete" : "in_progress", "Root cause accepted");
  };

  const runTransition = (to: "completed" | "cancelled"): void => {
    transition.mutate(
      { to, version: report.lockVersion },
      { onSuccess: () => toast.success(to === "completed" ? "8D completed" : "8D cancelled"), onError: (e) => toast.error(errorMessage(e)) },
    );
  };

  const runAssign = (patch: { teamLeadId?: string | null; championId?: string | null }): void => {
    const body: AssignEightDBody = { version: report.lockVersion, ...patch };
    const cleared = patch.teamLeadId === null || patch.championId === null;
    assign.mutate(body, {
      onSuccess: () => toast.success(cleared ? "Unassigned" : "Team updated"),
      onError: (e) => toast.error(errorMessage(e)),
    });
  };

  return (
    <div className="fade-in flex flex-col gap-4" style={{ padding: "20px 28px 28px" }}>
      <BackLink onClick={() => router.push("/8d")} />

      {/* Header */}
      <div className="k-surface p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-[280px] flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
              <span className="mono text-[13px] font-semibold" style={{ color: "var(--accent)" }}>{report.code}</span>
              <EightDStatusBadge status={report.status} />
              {report.ncrId && (
                <button onClick={() => router.push(`/ncrs/${report.ncrId}`)} className="k-chip mono" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                  <Link2 size={11} />Linked NCR
                </button>
              )}
            </div>
            <h1 className="m-0 mb-2.5 text-[22px] font-bold tracking-tight">{report.title}</h1>
            <div className="flex flex-wrap gap-5 text-[12px] text-muted">
              <span className="inline-flex items-center gap-1.5"><Avatar name={lookup.nameOf(report.teamLeadId)} size={18} />Lead: {lookup.nameOf(report.teamLeadId)}</span>
              <span className="inline-flex items-center gap-1.5"><Users size={13} />{report.memberIds.length} members</span>
              {report.startedAt && <span className="inline-flex items-center gap-1.5"><Calendar size={13} />Started {longDate(report.startedAt)}</span>}
              {report.targetAt && <span className="inline-flex items-center gap-1.5"><Target size={13} />Target {longDate(report.targetAt)}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setGenModal("audit")} className="k-btn k-btn-ghost"><FileText size={14} />Audit-ready report</button>
            <button onClick={() => setGenModal("capa")} className="k-btn k-btn-primary" style={{ background: "linear-gradient(135deg, #6366f1, #db2777)", border: "none" }}>
              <Sparkles size={14} />Generate CAPA pack
            </button>
            <div className="relative" ref={moreRef}>
              <button onClick={() => setMoreOpen((v) => !v)} className="k-btn k-btn-ghost k-btn-icon"><MoreHorizontal size={16} /></button>
              {moreOpen && (
                <div className="k-surface absolute right-0 top-full z-30 mt-1.5 flex min-w-[180px] flex-col gap-0.5 p-1.5" style={{ boxShadow: "var(--shadow-lg)" }}>
                  <button onClick={() => { setMoreOpen(false); toast.toast("Share link copied to clipboard", "info"); }} className="k-btn-plain flex items-center gap-2.5 rounded-[var(--r-md)] px-2.5 py-2 text-[13px]">
                    <Send size={14} />Share 8D
                  </button>
                  {canManage && !decided && (
                    <>
                      <button
                        onClick={() => { setMoreOpen(false); runTransition("completed"); }}
                        disabled={report.steps.d8?.status !== "complete"}
                        className="k-btn-plain flex items-center gap-2.5 rounded-[var(--r-md)] px-2.5 py-2 text-[13px] disabled:opacity-40"
                        title={report.steps.d8?.status === "complete" ? undefined : "Complete all eight disciplines first"}
                      >
                        <Check size={14} />Complete 8D
                      </button>
                      <button onClick={() => { setMoreOpen(false); runTransition("cancelled"); }} className="k-btn-plain flex items-center gap-2.5 rounded-[var(--r-md)] px-2.5 py-2 text-[13px]" style={{ color: "var(--danger-600)" }}>
                        <X size={14} />Cancel 8D
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Provenance strip */}
      <AIProvenanceStrip
        prov={prov}
        reviewed={ai.reviewed}
        onApproveAll={ai.approveAll}
        onOpenNcr={report.ncrId ? () => router.push(`/ncrs/${report.ncrId}`) : undefined}
      />

      {/* Two-column workspace */}
      <div className="grid items-start gap-4 lg:[grid-template-columns:minmax(0,1fr)_322px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Stepper report={report} active={active} onSelect={setActive} />
          {active === 1 && (
            <D1Step
              report={report}
              lookup={lookup}
              ai={ai}
              meId={meId}
              canManage={canManage && !decided}
              busy={assign.isPending}
              onAssign={runAssign}
            />
          )}
          {active === 2 && <D2Step report={report} ai={ai} />}
          {active === 3 && <D3Step report={report} lookup={lookup} ai={ai} />}
          {active === 4 && (
            <D4Workspace
              report={report}
              canManage={canManage && !decided}
              causes={causes}
              acceptedIndex={acceptedIndex}
              onSave={(analyses, status) => saveStep(4, { ...d4, analyses }, status, status === "complete" ? "D4 complete — root cause locked" : "Draft saved")}
            />
          )}
          {active > 4 && active > report.currentStep && <StepLocked n={active} />}
          {active > 4 && active <= report.currentStep && (
            <SimpleStepWrapper report={report} n={active} canManage={canManage && !decided} onSave={(data, status, ok) => saveStep(active, data, status, ok)} pending={update.isPending} />
          )}
        </div>

        <AICopilotRail
          prov={prov}
          containment={containment}
          appliedContainment={appliedIds}
          causes={causes}
          acceptedIndex={acceptedIndex}
          similarCases={similarCases}
          onApplyContainment={applyContainment}
          onAcceptCause={acceptCause}
        />
      </div>

      {genModal && <GeneratePackModal type={genModal} report={report} rootCause={rootCauseText} onClose={() => setGenModal(null)} />}
    </div>
  );
}

// ——— D4 workspace: accepted-root-cause strip + RCA method composition ———
function D4Workspace({
  report,
  canManage,
  causes,
  acceptedIndex,
  onSave,
}: {
  report: EightDDto;
  canManage: boolean;
  causes: RankedCause[];
  acceptedIndex: number | null;
  onSave: (analyses: Analysis[], status: "complete" | "in_progress") => void;
}): React.ReactElement {
  const d4 = stepData(report, "d4");
  const seededAnalyses = useMemo<Analysis[]>(
    () => {
      const persisted = d4["analyses"] as Analysis[] | undefined;
      if (persisted && persisted.length) return persisted.map((a) => ({ ...a }));
      return [
        { id: 1, type: "fivewhys", title: "5 Whys", content: d4["fiveWhys"] },
        { id: 2, type: "fishbone", title: "Fishbone (Ishikawa)" },
      ];
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [report.id],
  );

  const [analyses, setAnalyses] = useState<Analysis[]>(seededAnalyses);
  const [nextId, setNextId] = useState(() => Math.max(0, ...seededAnalyses.map((a) => a.id)) + 1);
  const [picker, setPicker] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const pickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!picker) return;
    const close = (e: MouseEvent): void => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPicker(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [picker]);

  const setContent = (id: number, content: unknown): void => setAnalyses((prev) => prev.map((a) => (a.id === id ? { ...a, content } : a)));
  const rename = (id: number, title: string): void => setAnalyses((prev) => prev.map((a) => (a.id === id ? { ...a, title } : a)));
  const remove = (id: number): void => setAnalyses((prev) => prev.filter((a) => a.id !== id));
  const add = (type: RcaType, name: string): void => {
    const same = analyses.filter((a) => a.type === type).length;
    setAnalyses((prev) => [...prev, { id: nextId, type, title: same ? `${name} ${same + 1}` : name }]);
    setNextId((n) => n + 1);
    setPicker(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <StepHeader
        code="D4"
        badge={
          <span className="k-chip" style={{ background: "var(--warning-100)", color: "var(--warning-700)" }}>
            <span className="pulse-dot" style={{ background: "var(--warning-500)" }} />In progress
          </span>
        }
      />

      {/* accepted root cause strip */}
      <div className="k-surface flex items-center gap-3.5 p-4" style={{ borderLeft: acceptedIndex !== null ? "3px solid var(--success-500)" : "3px solid #6366f1" }}>
        <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[var(--r-md)]" style={{ background: acceptedIndex !== null ? "var(--success-50)" : "rgba(99,102,241,0.1)", color: acceptedIndex !== null ? "var(--success-600)" : "#6366f1" }}>
          {acceptedIndex !== null ? <Check size={17} strokeWidth={3} /> : <Sparkles size={17} />}
        </div>
        <div className="min-w-0 flex-1">
          {acceptedIndex !== null ? (
            <>
              <div className="k-overline" style={{ color: "var(--success-600)" }}>Verified root cause · accepted from Copilot</div>
              <div className="mt-0.5 text-[14px] font-semibold">{causes[acceptedIndex]?.cause}</div>
            </>
          ) : (
            <>
              <div className="text-[13.5px] font-semibold">Choose a root cause from the AI Copilot</div>
              <div className="mt-px text-[11.5px] text-muted">{causes.length} ranked candidates with confidence are in the rail →</div>
            </>
          )}
        </div>
        {acceptedIndex !== null && <span className="mono flex-shrink-0 text-[18px] font-bold" style={{ color: "var(--success-600)" }}>{causes[acceptedIndex]?.confidence}%</span>}
      </div>

      {/* RCA workspace toolbar */}
      <div className="mt-0.5 flex items-center justify-between">
        <div>
          <div className="text-[14px] font-bold tracking-tight">Root cause analysis</div>
          <div className="text-[12px] text-muted">Combine any methods below · {analyses.length} active</div>
        </div>
        {canManage && (
          <div className="relative" ref={pickerRef}>
            <button className="k-btn k-btn-primary k-btn-sm" onClick={() => setPicker((v) => !v)}><Plus size={13} />Add method</button>
            {picker && <MethodPicker onPick={(m) => add(m.type, m.name)} />}
          </div>
        )}
      </div>

      {analyses.map((a) => {
        const m = methodFor(a.type);
        const I = m.icon;
        const isCollapsed = collapsed[a.id];
        return (
          <div key={a.id} className="k-surface overflow-hidden p-0">
            <div className="flex items-center gap-3 px-3.5 py-2.5" style={{ borderBottom: isCollapsed ? "none" : "1px solid var(--border)" }}>
              <span className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-[var(--r-sm)]" style={{ background: tintColor(m.color, 0.13), color: m.color }}><I size={15} /></span>
              <div className="min-w-0 flex-1">
                <input
                  value={a.title}
                  onChange={(e) => rename(a.id, e.target.value)}
                  className="w-full rounded-[var(--r-sm)] px-1 text-[13.5px] font-bold outline-none"
                  style={{ border: "1px solid transparent", background: "transparent", marginLeft: -4 }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--border-strong)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "transparent")}
                />
                <div className="text-[10.5px] text-subtle">{m.name}</div>
              </div>
              <button className="k-btn-plain inline-flex p-1.5" title={isCollapsed ? "Expand" : "Collapse"} onClick={() => setCollapsed((c) => ({ ...c, [a.id]: !c[a.id] }))} style={{ color: "var(--text-muted)" }}>
                {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
              </button>
              {canManage && (
                <button className="k-btn-plain inline-flex p-1.5" title="Delete analysis" onClick={() => remove(a.id)} style={{ color: "var(--text-subtle)" }}>
                  <Trash2 size={15} />
                </button>
              )}
            </div>
            {!isCollapsed && <div className="p-[18px]"><RcaBuilder a={a} onChange={(content) => setContent(a.id, content)} /></div>}
          </div>
        );
      })}

      {analyses.length === 0 && (
        <div className="k-surface p-9 text-center">
          <div className="mb-2.5 inline-flex rounded-full p-3 text-muted" style={{ background: "var(--bg-subtle)" }}><GitBranch size={24} /></div>
          <div className="mb-0.5 text-[14px] font-semibold">No analysis methods yet</div>
          <div className="text-[12.5px] text-muted">Add 5 Whys, Fishbone, Pareto and more to investigate the root cause.</div>
        </div>
      )}

      {canManage && (
        <div className="k-surface flex items-center gap-3.5 p-5" style={{ background: "var(--bg-subtle)" }}>
          <div className="flex-1">
            <div className="text-[13px] font-semibold">Ready to advance to D5?</div>
            <div className="text-[12px] text-muted">Confirm root cause & verification evidence before permanent corrective actions.</div>
          </div>
          <button className="k-btn k-btn-ghost" onClick={() => onSave(analyses, "in_progress")}>Save draft</button>
          <button className="k-btn k-btn-primary" disabled={acceptedIndex === null} style={{ opacity: acceptedIndex === null ? 0.5 : 1 }} onClick={() => onSave(analyses, "complete")}>
            Complete D4 →
          </button>
        </div>
      )}
    </div>
  );
}

// ——— D5–D8 editable wrapper with its own draft + save ———
function SimpleStepWrapper({
  report,
  n,
  canManage,
  onSave,
  pending,
}: {
  report: EightDDto;
  n: number;
  canManage: boolean;
  onSave: (data: Record<string, unknown>, status: "complete" | "in_progress", ok: string) => void;
  pending: boolean;
}): React.ReactElement {
  const key = `d${n}`;
  const data = stepData(report, key);
  const [draft, setDraft] = useState<Record<string, string>>({});
  useEffect(
    () => {
      const seed: Record<string, string> = {};
      for (const [k, v] of Object.entries(data)) if (typeof v === "string") seed[k] = v;
      setDraft(seed);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [report.id, n],
  );
  const status = report.steps[key]?.status ?? "pending";

  return (
    <div className="flex flex-col gap-3">
      <SimpleStep report={report} n={n} canManage={canManage} draft={draft} setDraft={setDraft} />
      {canManage && (
        <div className="flex items-center justify-end gap-2">
          {status !== "complete" && (
            <Button onClick={() => onSave({ ...data, ...draft }, "in_progress", "Draft saved")} loading={pending}>Save draft</Button>
          )}
          {status !== "complete" ? (
            <Button variant="primary" onClick={() => onSave({ ...data, ...draft }, "complete", `D${n} complete`)} loading={pending}>
              <Check size={14} />Complete D{n}
            </Button>
          ) : (
            <Button onClick={() => onSave({ ...data, ...draft }, "in_progress", `D${n} re-opened`)} loading={pending}>Re-open D{n}</Button>
          )}
        </div>
      )}
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }): React.ReactElement {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 self-start text-[13px] text-muted hover:text-text">
      <ArrowLeft size={14} />Back to 8D Reports
    </button>
  );
}

function DetailSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col gap-4" style={{ padding: "20px 28px 28px" }}>
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-28" />
      <Skeleton className="h-16" />
      <div className="grid gap-4 lg:[grid-template-columns:minmax(0,1fr)_322px]">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}
