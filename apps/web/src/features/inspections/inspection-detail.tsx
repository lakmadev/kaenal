"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Camera, ClipboardCheck, Clock, Play, TriangleAlert, Plus } from "lucide-react";
import { FindingSeverity, type FindingDto, type FormResponses, type InspectionDto, type TemplateDto } from "@kaenal/types";
import { scoreInspection, validateResponses } from "@kaenal/core";
import { apiQueries } from "@kaenal/api-client";
import { cn } from "@/lib/cn";
import { longDate, titleCase } from "@/lib/format";
import { errorMessage } from "@/lib/api-error";
import { getApiClient } from "@/lib/api";
import { usePrefetchQueries } from "@/hooks/use-prefetch";
import {
  useInspection,
  useTemplate,
  useStartInspection,
  useCompleteInspection,
  useInspectionFindings,
  useCreateFinding,
  useAssignInspection,
} from "@/hooks/use-inspections";
import { useCreateNcr } from "@/hooks/use-ncrs";
import { Button, StatusBadge, RiskBadge, Skeleton, EmptyState, Input, useToast } from "@/components/ui";
import { useMe, useCan, hasCapability } from "@/hooks/use-me";
import { AssigneePicker } from "@/components/assignee-picker";
import { ActivityFeed } from "@/components/activity-feed";
import { InspectionForm } from "./form-renderer";

type Tab = "overview" | "findings" | "media" | "history";

export function InspectionDetail({ id }: { id: string }): React.ReactElement {
  const router = useRouter();
  const { data: inspection, isLoading, isError } = useInspection(id);
  const template = useTemplate(inspection?.templateId);

  if (isLoading || (inspection !== undefined && template.isLoading)) return <DetailSkeleton />;
  if (isError || inspection === undefined) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <BackLink onClick={() => router.push("/inspections")} />
        <div className="k-surface mt-4">
          <EmptyState icon={TriangleAlert} title="Inspection not found" body="It may have been removed, or you may not have access." />
        </div>
      </div>
    );
  }

  return <View inspection={inspection} template={template.data} />;
}

function View({ inspection, template }: { inspection: InspectionDto; template: TemplateDto | undefined }): React.ReactElement {
  const router = useRouter();
  const toast = useToast();
  const { data: me } = useMe();
  const start = useStartInspection();
  const complete = useCompleteInspection();
  const assign = useAssignInspection();
  const canManage = hasCapability(me, "inspection:perform");
  const [tab, setTab] = useState<Tab>("overview");

  // Warm the History tab (audit-events) so its first open doesn't flash a spinner.
  usePrefetchQueries([apiQueries.auditEvents.list(getApiClient(), "inspection", inspection.id)]);

  const runAssign = (inspectorId: string | null): void =>
    assign.mutate(
      { id: inspection.id, body: { version: inspection.lockVersion, inspectorId } },
      {
        onSuccess: () => toast.success(inspectorId === null ? "Unassigned" : "Inspector updated"),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  const editable = inspection.status === "in_progress";
  const [responses, setResponses] = useState<FormResponses>(inspection.responses);
  useEffect(() => setResponses(inspection.responses), [inspection.id, inspection.responses]);

  // Live score while filling; the server score once completed (authoritative).
  const live = useMemo(
    () => (template !== undefined ? scoreInspection(template.schema, responses) : { score: null, scoredItems: 0 }),
    [template, responses],
  );
  const shownScore = inspection.status === "completed" ? inspection.score : live.score;

  const onStart = (): void =>
    start.mutate(
      { id: inspection.id, body: { version: inspection.lockVersion } },
      { onSuccess: () => toast.success("Inspection started"), onError: (e) => toast.error(errorMessage(e)) },
    );

  const onComplete = (): void => {
    if (template === undefined) return;
    const decision = validateResponses(template.schema, responses);
    if (!decision.ok) {
      const n = Array.isArray(decision.details?.["errors"]) ? (decision.details["errors"] as unknown[]).length : 0;
      toast.error(n > 0 ? `${n} item${n === 1 ? "" : "s"} need attention before completing.` : decision.message);
      return;
    }
    complete.mutate(
      { id: inspection.id, body: { responses, version: inspection.lockVersion } },
      { onSuccess: () => toast.success("Inspection completed"), onError: (e) => toast.error(errorMessage(e)) },
    );
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <BackLink onClick={() => router.push("/inspections")} />

      <div className="k-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2.5">
              <span className="mono text-[13px] font-semibold" style={{ color: "var(--accent)" }}>{inspection.code}</span>
              <StatusBadge status={inspection.status} />
              <RiskBadge risk={inspection.risk} />
            </div>
            <h1 className="text-[22px] font-bold tracking-tight">{inspection.title}</h1>
            <div className="mt-1.5 flex flex-wrap gap-4 text-[12px] text-muted">
              {template !== undefined && (
                <span className="inline-flex items-center gap-1.5">
                  <ClipboardCheck size={13} /> {template.name} v{inspection.templateVersion}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5"><Calendar size={13} /> Scheduled {longDate(inspection.scheduledAt)}</span>
              {inspection.completedAt !== null && (
                <span className="inline-flex items-center gap-1.5"><Clock size={13} /> Completed {longDate(inspection.completedAt)}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {inspection.status === "scheduled" && (
              <Button variant="primary" loading={start.isPending} onClick={onStart}>
                <Play size={14} /> Start inspection
              </Button>
            )}
            {editable && (
              <Button variant="primary" loading={complete.isPending} onClick={onComplete}>
                Complete inspection
              </Button>
            )}
          </div>
        </div>

        {(shownScore !== null || editable) && (
          <div className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-3">
            <ScoreBlock score={shownScore} live={editable} />
            <Block label="Scored items">
              <span className="mono text-[24px] font-bold">{live.scoredItems}</span>
            </Block>
            <Block label="Status">
              <StatusBadge status={inspection.status} />
            </Block>
          </div>
        )}
      </div>

      <div className="k-tabs">
        {(["overview", "findings", "media", "history"] as Tab[]).map((t) => (
          <button key={t} type="button" className={cn("k-tab", tab === t && "active")} onClick={() => setTab(t)}>
            {titleCase(t)}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            {template === undefined ? (
              <div className="k-surface">
                <EmptyState icon={TriangleAlert} title="Template unavailable" body="The inspection's template couldn't be loaded." />
              </div>
            ) : inspection.status === "scheduled" ? (
              <div className="k-surface">
                <EmptyState
                  icon={Play}
                  title="Not started yet"
                  body="Start the inspection to begin filling in the checklist."
                  action={<Button variant="primary" loading={start.isPending} onClick={onStart}><Play size={14} /> Start inspection</Button>}
                />
              </div>
            ) : (
              <InspectionForm
                schema={template.schema}
                responses={responses}
                readOnly={!editable}
                onChange={(itemId, value) => setResponses((r) => ({ ...r, [itemId]: value }))}
              />
            )}
          </div>

          <aside className="k-surface flex shrink-0 flex-col gap-3.5 p-4 lg:w-64">
            <MetaRow label="Status">
              <StatusBadge status={inspection.status} />
            </MetaRow>
            <MetaRow label="Inspector">
              <AssigneePicker
                userId={inspection.inspectorId}
                meId={me?.userId}
                canManage={canManage}
                busy={assign.isPending}
                onAssign={runAssign}
              />
            </MetaRow>
            <MetaRow label="Template">
              <span className="text-[12.5px]">
                {template !== undefined ? `${template.name} v${inspection.templateVersion}` : "—"}
              </span>
            </MetaRow>
            <MetaRow label="Scheduled">
              <span className="mono text-[12px]">{longDate(inspection.scheduledAt)}</span>
            </MetaRow>
            <MetaRow label="Started">
              <span className="mono text-[12px]">{longDate(inspection.startedAt)}</span>
            </MetaRow>
            <MetaRow label="Completed">
              <span className="mono text-[12px]">{longDate(inspection.completedAt)}</span>
            </MetaRow>
          </aside>
        </div>
      )}

      {tab === "findings" && <FindingsTab inspection={inspection} />}

      {tab === "media" && (
        <div className="k-surface">
          <EmptyState
            icon={Camera}
            title="No photos attached"
            body="Photos captured on the mobile inspector app will appear here once media capture is wired up."
          />
        </div>
      )}

      {tab === "history" && (
        <ActivityFeed entityKind="inspection" entityId={inspection.id} meId={me?.userId} noun="inspection" />
      )}
    </div>
  );
}

function FindingsTab({ inspection }: { inspection: InspectionDto }): React.ReactElement {
  const router = useRouter();
  const toast = useToast();
  const findings = useInspectionFindings(inspection.id);
  const createFinding = useCreateFinding(inspection.id);
  const createNcr = useCreateNcr();
  const canRaiseNcr = useCan("ncr:create");
  const [adding, setAdding] = useState(false);
  const [itemRef, setItemRef] = useState("");
  const [severity, setSeverity] = useState<FindingDto["severity"]>("major");
  const [description, setDescription] = useState("");

  const submit = (): void => {
    if (itemRef.trim() === "" || description.trim() === "") return;
    createFinding.mutate(
      { itemRef: itemRef.trim(), severity, description: description.trim() },
      {
        onSuccess: () => {
          toast.success("Finding recorded");
          setItemRef("");
          setDescription("");
          setAdding(false);
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  const raiseNcr = (f: FindingDto): void =>
    createNcr.mutate(
      { title: f.description.slice(0, 200), priority: f.severity, findingId: f.id },
      {
        onSuccess: (ncr) => {
          toast.success(`NCR ${ncr.code} raised`);
          router.push(`/ncrs/${ncr.id}`);
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  const items = findings.data?.items ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAdding((v) => !v)}>
          <Plus size={12} /> {adding ? "Cancel" : "Record finding"}
        </Button>
      </div>

      {adding && (
        <div className="k-surface flex flex-col gap-2.5 p-4">
          <div className="flex gap-2.5">
            <Input placeholder="Item reference (e.g. section-3-item-2)" value={itemRef} onChange={(e) => setItemRef(e.target.value)} />
            <select className="k-input" style={{ width: 130 }} value={severity} onChange={(e) => setSeverity(e.target.value as FindingDto["severity"])}>
              {FindingSeverity.options.map((s) => (
                <option key={s} value={s}>{titleCase(s)}</option>
              ))}
            </select>
          </div>
          <textarea className="k-input" rows={2} placeholder="What was observed?" value={description} onChange={(e) => setDescription(e.target.value)} style={{ height: "auto", padding: 10, resize: "vertical" }} />
          <Button variant="primary" size="sm" className="self-end" loading={createFinding.isPending} onClick={submit} disabled={itemRef.trim() === "" || description.trim() === ""}>
            Record finding
          </Button>
        </div>
      )}

      {findings.isLoading ? (
        <Skeleton className="h-24 rounded-xl" />
      ) : items.length === 0 ? (
        <div className="k-surface">
          <EmptyState icon={TriangleAlert} title="No findings" body="Record a finding, then raise an NCR from it." />
        </div>
      ) : (
        items.map((f) => (
          <div key={f.id} className="k-surface p-4">
            <div className="flex items-start gap-3.5">
              <div
                className="flex shrink-0 items-center justify-center rounded-md"
                style={{
                  width: 40,
                  height: 40,
                  background: f.severity === "critical" ? "var(--danger-100)" : "var(--warning-100)",
                  color: f.severity === "critical" ? "var(--danger-600)" : "var(--warning-700)",
                }}
              >
                <TriangleAlert size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <RiskBadge risk={f.severity} />
                  <span className="mono text-[11px] text-muted">{f.itemRef}</span>
                </div>
                <div className="text-[13px]">{f.description}</div>
              </div>
              <div className="shrink-0">
                {f.ncrId !== null ? (
                  <button onClick={() => router.push(`/ncrs/${f.ncrId!}`)} className="k-link mono text-[12px]">
                    → NCR
                  </button>
                ) : canRaiseNcr ? (
                  <Button size="sm" loading={createNcr.isPending} onClick={() => raiseNcr(f)}>
                    Raise NCR
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function ScoreBlock({ score, live }: { score: number | null; live: boolean }): React.ReactElement {
  const color = score === null ? "var(--border)" : score >= 90 ? "var(--success-500)" : score >= 70 ? "var(--warning-500)" : "var(--danger-500)";
  return (
    <Block label={live ? "Live score" : "Overall score"}>
      <div className="flex items-baseline gap-1.5">
        <span className="mono text-[24px] font-bold">{score ?? "—"}</span>
        <span className="text-[13px] text-muted">/ 100</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--bg-subtle)" }}>
        <div className="h-full transition-[width]" style={{ width: `${score ?? 0}%`, background: color }} />
      </div>
    </Block>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div>
      <div className="k-overline mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="k-overline">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }): React.ReactElement {
  return (
    <button type="button" onClick={onClick} className="k-btn k-btn-plain self-start px-0 text-[13px] text-muted">
      <ArrowLeft size={14} /> Back to Inspections
    </button>
  );
}

function DetailSkeleton(): React.ReactElement {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
