"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Check,
  ClipboardList,
  Download,
  FileText,
  ListChecks,
  Paperclip,
  TriangleAlert,
  Upload,
  Users,
} from "lucide-react";
import { AUDIT_PHASE_LABEL, AUDIT_PHASE_ORDER } from "@kaenal/core";
import type { AuditDto } from "@kaenal/types";
import { useAudit, useAdvanceAudit, useAuditFindings, useAuditReportExport } from "@/hooks/use-audits";
import { useEntityFiles, useUploadEntityFiles, useDownloadFile } from "@/hooks/use-files";
import { useMe, hasCapability } from "@/hooks/use-me";
import { useMemberLookup } from "@/hooks/use-members";
import { longDate, titleCase, durationDays } from "@/lib/format";
import { errorMessage } from "@/lib/api-error";
import { Skeleton, EmptyState, StatusBadge, Button, useToast } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { AUDIT_TYPES } from "./audit-types";
import { AuditChecklistTab } from "./audit-checklist-tab";
import { AuditFindingsTab } from "./audit-findings-tab";

type Tab = "team" | "evidence" | "report" | "checklist" | "findings";

/**
 * `/audits/[id]` (Sprint 02 S2-2/S2-4/S2-5). Header, phase tracker, and sidebar
 * reproduce `audits.jsx` `AuditDetail` (213-374); the Team & Plan / Evidence /
 * Report tabs reproduce `AuditTeamTab`/`AuditEvidenceTab`/`AuditReportTab`
 * (529-646); Checklist and Findings tabs are `AuditChecklistTab`/
 * `AuditFindingsTab` — all real data only, no mock rows.
 */
export function AuditDetailShell({ id }: { id: string }): React.ReactElement {
  const router = useRouter();
  const { data: audit, isLoading, isError } = useAudit(id);
  const findings = useAuditFindings(id);
  const [tab, setTab] = useState<Tab>("checklist");

  if (isLoading) return <DetailSkeleton />;
  if (isError || audit === undefined) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <BackLink onClick={() => router.push("/audits")} />
        <div className="k-surface mt-4">
          <EmptyState icon={TriangleAlert} title="Audit not found" body="It may have been removed, or you may not have access." />
        </div>
      </div>
    );
  }

  const style = AUDIT_TYPES[audit.type];
  const findingsCount = findings.data?.items.length ?? 0;

  const TABS: { id: Tab; label: string; icon: typeof Users; count?: number }[] = [
    { id: "checklist", label: "Checklist", icon: ListChecks, count: audit.checklist.length },
    { id: "findings", label: "Findings", icon: TriangleAlert, count: findingsCount },
    { id: "team", label: "Team & Plan", icon: Users },
    { id: "evidence", label: "Evidence", icon: FileText },
    { id: "report", label: "Report", icon: ClipboardList },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
      <BackLink onClick={() => router.push("/audits")} />

      <AuditHeader audit={audit} />
      <PhaseTracker audit={audit} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div>
          <div role="tablist" aria-label="Audit sections" className="flex flex-wrap gap-1 border-b border-border">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`k-btn k-btn-ghost k-btn-sm ${tab === t.id ? "border-b-2 border-ink" : ""}`}
                style={tab === t.id ? { borderBottomColor: style.color } : undefined}
              >
                <t.icon size={14} /> {t.label}
                {t.count !== undefined && (
                  <span className="rounded-full bg-bg-subtle px-1.5 text-[11px] font-semibold">{t.count}</span>
                )}
              </button>
            ))}
          </div>

          <div className="pt-3.5">
            {tab === "checklist" && (
              <AuditChecklistTab audit={audit} onViewFindings={() => setTab("findings")} />
            )}
            {tab === "findings" && <AuditFindingsTab auditId={audit.id} />}
            {tab === "team" && <TeamPlanTab audit={audit} />}
            {tab === "evidence" && <EvidenceTab auditId={audit.id} />}
            {tab === "report" && <ReportTab audit={audit} />}
          </div>
        </div>

        <Sidebar audit={audit} />
      </div>
    </div>
  );
}

function AuditHeader({ audit }: { audit: AuditDto }): React.ReactElement {
  const style = AUDIT_TYPES[audit.type];
  const toast = useToast();
  const { data: me } = useMe();
  const canManage = hasCapability(me, "audit:manage");
  const advance = useAdvanceAudit();
  const report = useAuditReportExport(audit.id);

  const phaseIdx = AUDIT_PHASE_ORDER.indexOf(audit.status);
  const nextPhase = AUDIT_PHASE_ORDER[phaseIdx + 1];

  const onContinue = (): void => {
    if (nextPhase === undefined) return;
    advance.mutate(
      { id: audit.id, body: { to: nextPhase, version: audit.lockVersion } },
      {
        onSuccess: () => toast.success(`Advanced to ${AUDIT_PHASE_LABEL[nextPhase]}`),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  return (
    <div className="k-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="k-chip" style={{ background: style.bg, color: style.color }}>
              <style.icon size={11} /> {style.label}
            </span>
            <span className="mono text-[12px] text-muted">{audit.code}</span>
            <StatusBadge status={audit.status} />
          </div>
          <h1 className="text-[22px] font-bold tracking-tight">{audit.title}</h1>
          {audit.description !== null && audit.description !== "" && (
            <p className="mt-1.5 text-[13px] text-muted">{audit.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ExportButton report={report} label="Export" />
          {canManage && nextPhase !== undefined && (
            <Button variant="primary" loading={advance.isPending} onClick={onContinue}>
              <Check size={14} /> Continue audit
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ExportButton({
  report,
  label,
}: {
  report: ReturnType<typeof useAuditReportExport>;
  label: string;
}): React.ReactElement {
  if (report.status === "completed" && report.downloadUrl !== null) {
    return (
      <a href={report.downloadUrl} download className="k-btn k-btn-ghost">
        <Download size={14} /> Download PDF
      </a>
    );
  }
  if (report.isPreparing) {
    return (
      <Button loading disabled>
        Preparing…
      </Button>
    );
  }
  return (
    <Button variant="ghost" onClick={report.trigger}>
      <Download size={14} /> {report.isFailed ? "Retry export" : label}
    </Button>
  );
}

function PhaseTracker({ audit }: { audit: AuditDto }): React.ReactElement {
  const style = AUDIT_TYPES[audit.type];
  const idx = AUDIT_PHASE_ORDER.indexOf(audit.status);
  const pct = Math.round(audit.progress * 100);

  return (
    <div className="k-surface p-4.5">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="k-overline">Current phase</div>
          <div className="text-[16px] font-bold">
            {AUDIT_PHASE_LABEL[audit.status]} — {pct}%
          </div>
        </div>
        <div className="text-[11.5px] text-muted">
          <Calendar size={11} className="mr-1 inline" />
          {longDate(audit.startAt)} → {longDate(audit.endAt)}
          {" "}
          {durationDays(audit.startAt, audit.endAt) !== null && `(${durationDays(audit.startAt, audit.endAt)} days)`}
        </div>
      </div>
      <div className="flex">
        {AUDIT_PHASE_ORDER.map((phase, i) => {
          const done = i < idx;
          const current = i === idx;
          return (
            <div key={phase} className="flex-1">
              <div className="flex items-center gap-2">
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                  style={{
                    background: done || current ? style.color : "var(--bg-subtle)",
                    color: done || current ? "#fff" : "var(--text-muted)",
                    border: `2px solid ${done || current ? style.color : "var(--border)"}`,
                  }}
                >
                  {done ? <Check size={14} /> : i + 1}
                </div>
                {i < AUDIT_PHASE_ORDER.length - 1 && (
                  <div className="h-0.5 flex-1" style={{ background: i < idx ? style.color : "var(--border)" }} />
                )}
              </div>
              <div className={`mt-1.5 text-[11.5px] ${current ? "font-semibold text-text" : "font-medium text-muted"}`}>
                {AUDIT_PHASE_LABEL[phase]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Sidebar({ audit }: { audit: AuditDto }): React.ReactElement {
  const lookup = useMemberLookup();
  const lead = lookup.memberOf(audit.leadAuditorId);
  const duration = durationDays(audit.startAt, audit.endAt);

  return (
    <div className="flex flex-col gap-3.5">
      <SidebarCard title="Audit details">
        <DetailRow label="Standard" value={audit.standard ?? "—"} />
        <DetailRow label="Location" value={audit.location ?? "—"} />
        <DetailRow label="Duration" value={duration !== null ? `${duration} days` : "—"} />
        <DetailRow
          label="Lead auditor"
          value={
            audit.leadAuditorId !== null ? (
              <span className="inline-flex items-center gap-1.5">
                <Avatar name={lead?.name} size={18} /> {lookup.nameOf(audit.leadAuditorId)}
              </span>
            ) : (
              "—"
            )
          }
        />
        <DetailRow
          label="Next activity"
          value={
            audit.nextActivity !== null && audit.nextActivity !== "" ? (
              <span style={{ color: "var(--accent)" }}>{audit.nextActivity}</span>
            ) : (
              "—"
            )
          }
        />
      </SidebarCard>

      <SidebarCard title="Findings summary">
        <div className="grid grid-cols-3 gap-2">
          <SummaryStat label="Major" value={audit.findingsSummary.major} color="var(--danger-600)" />
          <SummaryStat label="Minor" value={audit.findingsSummary.minor} color="#ea580c" />
          <SummaryStat label="Oppt." value={audit.findingsSummary.opportunity} color="var(--primary-600)" />
        </div>
        <div className="mt-2.5 border-t border-border pt-2.5 text-[12px] text-muted">
          <span className="font-semibold" style={{ color: "var(--danger-600)" }}>{audit.capasOpen}</span> of {audit.capasTotal} CAPAs open
        </div>
      </SidebarCard>

      <SidebarCard title="Audit team">
        <div className="flex flex-col gap-2">
          {audit.team.length === 0 ? (
            <span className="text-[12px] text-subtle">No team members assigned</span>
          ) : (
            audit.team.map((uid) => (
              <div key={uid} className="flex items-center gap-2">
                <Avatar name={lookup.memberOf(uid)?.name} size={22} />
                <div className="min-w-0 flex-1 text-[12px]">
                  <div className="font-medium">{lookup.nameOf(uid)}</div>
                  <div className="text-[11px] text-muted">
                    {uid === audit.leadAuditorId ? "Lead auditor" : titleCase(lookup.memberOf(uid)?.role ?? "")}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </SidebarCard>

      <SidebarCard title="Scope">
        {audit.scope.length === 0 ? (
          <span className="text-[12px] text-subtle">No scope areas recorded</span>
        ) : (
          <div className="flex flex-col gap-1.5">
            {audit.scope.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[12px]">
                <Check size={11} /> <span>{s}</span>
              </div>
            ))}
          </div>
        )}
      </SidebarCard>
    </div>
  );
}

function SidebarCard({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="k-surface p-4">
      <div className="k-overline mb-2.5">{title}</div>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border py-1.5 last:border-b-0">
      <span className="text-[11.5px] text-muted">{label}</span>
      <span className="text-[12.5px] font-medium">{value}</span>
    </div>
  );
}

function SummaryStat({ label, value, color }: { label: string; value: number; color: string }): React.ReactElement {
  return (
    <div className="rounded-md bg-bg-subtle px-1 py-2 text-center">
      <div className="text-[22px] font-bold leading-none" style={{ color }}>{value}</div>
      <div className="mt-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}

// --- Team & Plan tab ---------------------------------------------------------

function TeamPlanTab({ audit }: { audit: AuditDto }): React.ReactElement {
  const lookup = useMemberLookup();
  const style = AUDIT_TYPES[audit.type];
  const duration = durationDays(audit.startAt, audit.endAt);

  return (
    <div className="k-surface p-4.5">
      <h4 className="mb-3 text-[13px] font-semibold">Audit plan</h4>
      <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2">
        <div>
          <div className="k-overline mb-2">Schedule</div>
          <DetailRow label="Planned start" value={longDate(audit.startAt)} />
          <DetailRow label="Planned end" value={longDate(audit.endAt)} />
          <DetailRow label="Duration" value={duration !== null ? `${duration} days` : "—"} />
          <DetailRow label="Location" value={audit.location ?? "—"} />
        </div>
        <div>
          <div className="k-overline mb-2">Standard & scope</div>
          <DetailRow label="Standard" value={audit.standard ?? "—"} />
          <DetailRow label="Type" value={style.label} />
          <DetailRow label="Scope" value={`${audit.scope.length} area${audit.scope.length === 1 ? "" : "s"}`} />
        </div>
      </div>

      <h4 className="mb-2.5 mt-5 text-[13px] font-semibold">Audit team ({audit.team.length})</h4>
      {audit.team.length === 0 ? (
        <p className="text-[12.5px] text-muted">No team members assigned yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {audit.team.map((uid) => {
            const isLead = uid === audit.leadAuditorId;
            return (
              <div key={uid} className="flex items-center gap-2.5 rounded-md border border-border p-3">
                <Avatar name={lookup.memberOf(uid)?.name} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold">{lookup.nameOf(uid)}</div>
                  <div className="text-[11.5px] text-muted">{isLead ? "Lead auditor" : titleCase(lookup.memberOf(uid)?.role ?? "")}</div>
                </div>
                {isLead && (
                  <span className="k-chip" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>Lead</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Evidence tab -------------------------------------------------------------

function prettyBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function EvidenceTab({ auditId }: { auditId: string }): React.ReactElement {
  const toast = useToast();
  const { data: me } = useMe();
  const canManage = hasCapability(me, "audit:manage");
  const files = useEntityFiles("audit", auditId);
  const upload = useUploadEntityFiles("audit", auditId);
  const lookup = useMemberLookup();
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePick = (list: FileList | null): void => {
    if (list === null || list.length === 0) return;
    upload.mutate(Array.from(list), {
      onSuccess: () => toast.success("Uploaded"),
      onError: (e) => toast.error(errorMessage(e)),
    });
    if (inputRef.current !== null) inputRef.current.value = "";
  };

  const items = files.data?.items ?? [];

  return (
    <div className="k-surface p-0">
      <div className="flex items-center justify-between border-b border-border px-4.5 py-3.5">
        <div className="text-[13px] font-semibold">Evidence ({items.length} file{items.length === 1 ? "" : "s"})</div>
        {canManage && (
          <>
            <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => handlePick(e.target.files)} />
            <Button size="sm" loading={upload.isPending} onClick={() => inputRef.current?.click()}>
              <Upload size={12} /> Upload
            </Button>
          </>
        )}
      </div>

      {files.isLoading ? (
        <div className="p-4.5"><Skeleton className="h-24 rounded-xl" /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={Paperclip} title="No evidence yet" body="Files uploaded during fieldwork will appear here." />
      ) : (
        <table className="k-table w-full">
          <thead>
            <tr>
              <th>File</th>
              <th>Uploaded by</th>
              <th>Date</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((f) => (
              <tr key={f.id}>
                <td>
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-muted" />
                    <div>
                      <div className="text-[13px] font-medium">{f.filename}</div>
                      <div className="text-[10.5px] text-muted">{prettyBytes(f.sizeBytes)}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="inline-flex items-center gap-1.5 text-[12px]">
                    <Avatar name={lookup.memberOf(f.uploadedBy)?.name} size={18} /> {lookup.nameOf(f.uploadedBy).split(" ")[0]}
                  </span>
                </td>
                <td><span className="text-[12px] text-muted">{longDate(f.createdAt)}</span></td>
                <td><DownloadFileButton fileId={f.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function DownloadFileButton({ fileId }: { fileId: string }): React.ReactElement {
  const toast = useToast();
  const download = useDownloadFile();
  const onClick = (): void => {
    download.mutate(
      { id: fileId, disposition: "attachment" },
      {
        onSuccess: (result) => window.open(result.url, "_blank", "noopener"),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };
  return (
    <Button size="sm" variant="ghost" loading={download.isPending} onClick={onClick}>
      <Download size={14} />
    </Button>
  );
}

// --- Report tab ---------------------------------------------------------------

function ReportTab({ audit }: { audit: AuditDto }): React.ReactElement {
  const findings = useAuditFindings(audit.id);
  const report = useAuditReportExport(audit.id);
  const items = findings.data?.items ?? [];

  return (
    <div className="k-surface p-6">
      <div className="mb-4.5 border-b border-border pb-3.5 text-center">
        <div className="k-overline">Audit Report</div>
        <h3 className="mt-1.5 text-[18px] font-bold">{audit.title}</h3>
        <div className="mt-1 text-[12px] text-muted">{audit.standard ?? "—"} · {audit.code}</div>
      </div>

      {audit.description !== null && audit.description !== "" && (
        <ReportSection title="Audit objective">{audit.description}</ReportSection>
      )}

      <ReportSection title="Findings summary">
        <div className="mt-2 grid grid-cols-3 gap-2.5">
          <SummaryStat label="Major NC" value={audit.findingsSummary.major} color="var(--danger-600)" />
          <SummaryStat label="Minor NC" value={audit.findingsSummary.minor} color="#ea580c" />
          <SummaryStat label="Opportunities" value={audit.findingsSummary.opportunity} color="#6366f1" />
        </div>
      </ReportSection>

      <ReportSection title="Detailed findings">
        {findings.isLoading ? (
          <Skeleton className="h-16 rounded-lg" />
        ) : items.length === 0 ? (
          <p className="text-[12.5px] text-muted">No findings recorded yet.</p>
        ) : (
          items.map((f) => (
            <div
              key={f.id}
              className="mb-2.5 border-l-[3px] pl-3"
              style={{ borderColor: f.kind === "major_nc" ? "var(--danger-600)" : f.kind === "minor_nc" ? "#ea580c" : "#6366f1" }}
            >
              <div className="text-[12px] font-semibold">
                {f.clause !== null && `§${f.clause} · `}{f.title ?? titleCase(f.kind)}
              </div>
              <div className="text-[12px] leading-relaxed text-muted">{f.description}</div>
            </div>
          ))
        )}
      </ReportSection>

      {/* Note: "Executive Summary" / "Conclusions" narrative sections in the jsx
          are hand-written prose specific to the mock audit, with no field this
          sprint's schema produces — dropped per S2-2 AC5's own scoping ("a REAL
          summary … not a kToast-only mock action"), not silently invented. */}

      <div className="mt-5 flex flex-wrap gap-3 border-t border-border pt-4">
        <ExportButton report={report} label="Export PDF" />
        {/* "Send to auditee" (jsx) is explicitly out of scope this sprint — no
            recipient model or endpoint exists (Q10, docs/sprints/SPRINT-02-audits.md §7). */}
      </div>
    </div>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="mb-4.5">
      <h4 className="k-overline mb-2">{title}</h4>
      <div className="text-[13px] leading-relaxed">{children}</div>
    </div>
  );
}

// --- Shared chrome -------------------------------------------------------------

function BackLink({ onClick }: { onClick: () => void }): React.ReactElement {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
      <ArrowLeft size={14} /> Back to audits
    </button>
  );
}

function DetailSkeleton(): React.ReactElement {
  return (
    <div className="mx-auto max-w-6xl p-6">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="mt-4 h-28 w-full" />
      <Skeleton className="mt-4 h-24 w-full" />
      <Skeleton className="mt-4 h-64 w-full" />
    </div>
  );
}
