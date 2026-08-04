"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Undo2,
  Lock,
  Clock,
  Calendar,
  Brain,
  ShieldCheck,
  History,
  ClipboardList,
  ChevronRight,
  TriangleAlert,
  Link2,
  Download,
} from "lucide-react";
import type { CapaDto, EntityKind } from "@kaenal/types";
import { cn } from "@/lib/cn";
import { longDate, titleCase } from "@/lib/format";
import { errorMessage } from "@/lib/api-error";
import { useMe, hasCapability } from "@/hooks/use-me";
import { useCapa, useAdvanceCapa, useRevertCapa, useCapaActions, useAssignCapa } from "@/hooks/use-capas";
import { useEntityLinks } from "@/hooks/use-entity-links";
import { AssigneePicker } from "@/components/assignee-picker";
import { ActivityFeed } from "@/components/activity-feed";
import {
  Button,
  Dialog,
  DialogContent,
  Field,
  StatusBadge,
  PriorityBadge,
  RiskBadge,
  Skeleton,
  EmptyState,
  useToast,
} from "@/components/ui";
import { CAPA_PHASES, phaseIndex, TypeChip, PhaseTracker } from "./capa-bits";
import { CapaActionPlan } from "./capa-actions";

const DAY_MS = 86_400_000;

/** Route segment for each linkable entity kind (sidebar "Open" targets). */
const ENTITY_ROUTE: Record<EntityKind, string | null> = {
  ncr: "ncrs",
  capa: "capa",
  inspection: "inspections",
  document: "documents",
  supplier: "suppliers",
  audit: "audits",
  eight_d: null, // 8D detail route not built yet
  scar: null, // SCAR detail route not built yet
};

/** Human label for an entity kind in the linked-records list. */
const ENTITY_LABEL: Record<EntityKind, string> = {
  ncr: "NCR",
  capa: "CAPA",
  inspection: "Inspection",
  document: "Document",
  supplier: "Supplier",
  audit: "Audit",
  eight_d: "8D",
  scar: "SCAR",
};

type Tab = "plan" | "rca" | "effectiveness" | "history";

const TABS: { id: Tab; label: string; icon: typeof Brain }[] = [
  { id: "plan", label: "Action plan", icon: ClipboardList },
  { id: "rca", label: "Root cause", icon: Brain },
  { id: "effectiveness", label: "Effectiveness", icon: ShieldCheck },
  { id: "history", label: "Activity", icon: History },
];

export function CapaDetail({ id }: { id: string }): React.ReactElement {
  const router = useRouter();
  const { data: me } = useMe();
  const { data: capa, isLoading, isError } = useCapa(id);

  if (isLoading) return <DetailSkeleton />;
  if (isError || capa === undefined) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <BackLink onClick={() => router.push("/capa")} />
        <div className="k-surface mt-4">
          <EmptyState icon={TriangleAlert} title="CAPA not found" body="It may have been removed, or you may not have access." />
        </div>
      </div>
    );
  }

  return <CapaDetailView capa={capa} meId={me?.userId} canManage={hasCapability(me, "capa:manage")} />;
}

function CapaDetailView({
  capa,
  meId,
  canManage,
}: {
  capa: CapaDto;
  meId: string | undefined;
  canManage: boolean;
}): React.ReactElement {
  const router = useRouter();
  const toast = useToast();
  const advance = useAdvanceCapa();
  const revert = useRevertCapa();
  const actions = useCapaActions(capa.id);
  const assign = useAssignCapa();
  const [tab, setTab] = useState<Tab>("plan");
  const [revertOpen, setRevertOpen] = useState(false);

  const runAssign = (body: { version: number; ownerId?: string | null; sponsorId?: string | null }): void => {
    const cleared = body.ownerId === null || body.sponsorId === null;
    assign.mutate(
      { id: capa.id, body },
      {
        onSuccess: () => toast.success(cleared ? "Unassigned" : "Assignment updated"),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  const actionCount = actions.data?.items.length ?? 0;
  const daysOpen = Math.max(0, Math.floor((Date.now() - new Date(capa.createdAt).getTime()) / DAY_MS));

  const openEntity = (kind: EntityKind, entityId: string): void => {
    const route = ENTITY_ROUTE[kind];
    if (route !== null) router.push(`/${route}/${entityId}`);
  };

  const idx = phaseIndex(capa.status);
  const nextPhase = CAPA_PHASES[idx + 1];
  const prevPhase = idx > 0 ? CAPA_PHASES[idx - 1] : undefined;
  const atEnd = nextPhase === undefined;
  const atStart = prevPhase === undefined;
  const busy = advance.isPending || revert.isPending;

  const runAdvance = (): void => {
    if (nextPhase === undefined) return;
    advance.mutate(
      { id: capa.id, body: { to: nextPhase.id, version: capa.lockVersion } },
      {
        onSuccess: () =>
          toast.success(nextPhase.id === "closed" ? `${capa.code} closed — workflow complete` : `Advanced to ${nextPhase.label}`),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  const runRevert = (reason: string): void => {
    if (prevPhase === undefined) return;
    revert.mutate(
      { id: capa.id, body: { to: prevPhase.id, version: capa.lockVersion, reason } },
      {
        onSuccess: () => {
          toast.success(`Reverted to ${prevPhase.label}`);
          setRevertOpen(false);
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
      <BackLink onClick={() => router.push("/capa")} />

      {/* Header */}
      <div className="k-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2.5">
              <TypeChip type={capa.type} />
              <span className="mono text-[13px] font-semibold" style={{ color: "var(--accent)" }}>
                {capa.code}
              </span>
              <StatusBadge status={capa.status} />
              <PriorityBadge priority={capa.priority} />
            </div>
            <h1 className="text-[22px] font-bold tracking-tight">{capa.title}</h1>
            {capa.description !== null && capa.description !== "" && (
              <p className="mt-1.5 max-w-2xl text-[13px] text-muted">{capa.description}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              onClick={() =>
                toast.toast(
                  "Export isn't wired to the backend yet — the CAPA effectiveness report lands with the reporting service",
                  "info",
                )
              }
            >
              <Download size={14} /> Export
            </Button>
            {canManage && (
              <>
                {!atStart && (
                  <Button variant="ghost" loading={busy} onClick={() => setRevertOpen(true)}>
                    <Undo2 size={14} /> Revert
                  </Button>
                )}
                <Button variant="primary" loading={busy} disabled={atEnd} onClick={runAdvance}>
                  {atEnd ? <Lock size={14} /> : <ArrowRight size={14} />}
                  {atEnd ? "Closed" : `Advance to ${nextPhase?.label}`}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Phase tracker */}
      <div className="k-surface p-[18px]">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="k-overline">Current phase</div>
            <div className="text-[16px] font-bold">{CAPA_PHASES[idx]?.label ?? titleCase(capa.status)}</div>
          </div>
          <div className="flex flex-wrap gap-4 text-[12px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Clock size={12} /> Opened {longDate(capa.createdAt)} ({daysOpen}d)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={12} /> Due {longDate(capa.dueAt)}
            </span>
          </div>
        </div>
        <PhaseTracker phase={capa.status} />
      </div>

      {/* Body: tabs + sidebar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        <div>
          <div className="k-tabs mb-3.5">
            {TABS.map((t) => {
              const Icon = t.icon;
              const count = t.id === "plan" ? actionCount : 0;
              return (
                <button key={t.id} type="button" className={cn("k-tab", tab === t.id && "active")} onClick={() => setTab(t.id)}>
                  <Icon size={13} /> {t.label}
                  {count > 0 && (
                    <span
                      className="ml-1 rounded-full px-1.5 text-[11px] font-semibold"
                      style={{ background: "var(--bg-subtle)" }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {tab === "plan" && <CapaActionPlan capaId={capa.id} canManage={canManage} />}
          {tab === "rca" && <CapaRcaTab capa={capa} onOpen={openEntity} />}
          {tab === "effectiveness" && <CapaEffectivenessTab capa={capa} />}
          {tab === "history" && <ActivityFeed entityKind="capa" entityId={capa.id} meId={meId} noun="CAPA" />}
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-4">
          <div className="k-surface p-4">
            <div className="k-overline mb-2.5">Details</div>
            <div className="flex flex-col gap-2.5">
              <Meta label="Owner">
                <AssigneePicker
                  userId={capa.ownerId}
                  meId={meId}
                  canManage={canManage}
                  busy={assign.isPending}
                  onAssign={(v) => runAssign({ version: capa.lockVersion, ownerId: v })}
                />
              </Meta>
              <Meta label="Sponsor">
                <AssigneePicker
                  userId={capa.sponsorId}
                  meId={meId}
                  canManage={canManage}
                  busy={assign.isPending}
                  emptyLabel="None"
                  onAssign={(v) => runAssign({ version: capa.lockVersion, sponsorId: v })}
                />
              </Meta>
              <Meta label="Type">
                <span className="text-[12.5px]">{titleCase(capa.type)}</span>
              </Meta>
              <Meta label="Priority">
                <PriorityBadge priority={capa.priority} />
              </Meta>
              <Meta label="Risk">
                <RiskBadge risk={capa.risk} />
              </Meta>
              <Meta label="Opened">
                <span className="mono text-[12px]">{longDate(capa.createdAt)}</span>
              </Meta>
              <Meta label="Due">
                <span className="mono text-[12px]">{longDate(capa.dueAt)}</span>
              </Meta>
              {capa.effectivenessCheckAt !== null && (
                <Meta label="Eff. check">
                  <span className="mono text-[12px]">{longDate(capa.effectivenessCheckAt)}</span>
                </Meta>
              )}
            </div>
          </div>

          <LinkedItemsCard capa={capa} onOpen={openEntity} />
        </aside>
      </div>

      <RevertDialog
        open={revertOpen}
        onOpenChange={setRevertOpen}
        toLabel={prevPhase?.label ?? ""}
        loading={revert.isPending}
        onConfirm={runRevert}
      />
    </div>
  );
}

function RevertDialog({
  open,
  onOpenChange,
  toLabel,
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  toLabel: string;
  loading: boolean;
  onConfirm: (reason: string) => void;
}): React.ReactElement {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Revert to ${toLabel}`}
        description="Reverting a CAPA moves it back a phase. This is an audited exception and requires a reason."
      >
        <div className="flex flex-col gap-4">
          <Field label="Reason" required>
            {(a) => (
              <textarea
                {...a}
                className="k-input"
                rows={3}
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this CAPA moving back a phase?"
                style={{ height: "auto", padding: 10, resize: "vertical" }}
              />
            )}
          </Field>
          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={loading} disabled={reason.trim() === ""} onClick={() => onConfirm(reason.trim())}>
              Revert
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The sidebar "Linked items" card: the CAPA's origin (`source*`) plus every
 * `entity_links` edge touching it, rendered as the record on the OPPOSITE end.
 * All rows are real — the source ref and the link graph both come from the API;
 * nothing is fabricated. The card is omitted entirely when there is nothing to
 * show (rather than an empty-card placeholder).
 */
function LinkedItemsCard({
  capa,
  onOpen,
}: {
  capa: CapaDto;
  onOpen: (kind: EntityKind, id: string) => void;
}): React.ReactElement | null {
  const links = useEntityLinks("capa", capa.id);

  type Row = { key: string; kind: EntityKind; id: string; relation: string | null };
  const rows: Row[] = [];
  const seen = new Set<string>();
  const push = (kind: EntityKind, id: string, relation: string | null): void => {
    const dedupe = `${kind}:${id}`;
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    rows.push({ key: `${dedupe}:${relation ?? ""}`, kind, id, relation });
  };

  // Origin first — the record this CAPA was raised from.
  if (capa.sourceKind !== null && capa.sourceId !== null && isEntityKind(capa.sourceKind)) {
    push(capa.sourceKind, capa.sourceId, "source");
  }
  // Then every graph edge, resolved to the end opposite this CAPA.
  for (const l of links.data?.items ?? []) {
    const opp =
      l.fromKind === "capa" && l.fromId === capa.id ? { kind: l.toKind, id: l.toId } : { kind: l.fromKind, id: l.fromId };
    push(opp.kind, opp.id, l.relation);
  }

  if (links.isLoading && rows.length === 0) {
    return (
      <div className="k-surface p-4">
        <div className="k-overline mb-2.5">Linked items</div>
        <Skeleton className="h-12 rounded-md" />
      </div>
    );
  }
  if (rows.length === 0) return null;

  return (
    <div className="k-surface p-4">
      <div className="k-overline mb-2.5">Linked items</div>
      <div className="flex flex-col gap-2">
        {rows.map((r) => {
          const routable = ENTITY_ROUTE[r.kind] !== null;
          return (
            <LinkedItem
              key={r.key}
              label={ENTITY_LABEL[r.kind]}
              id={r.id}
              relation={r.relation}
              {...(routable ? { onClick: () => onOpen(r.kind, r.id) } : {})}
            />
          );
        })}
      </div>
    </div>
  );
}

function isEntityKind(v: string): v is EntityKind {
  return v in ENTITY_LABEL;
}

function LinkedItem({
  label,
  id,
  relation,
  onClick,
}: {
  label: string;
  id: string;
  relation?: string | null;
  onClick?: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={onClick === undefined}
      className="flex w-full items-center gap-2 rounded-[3px] border border-border bg-surface px-2.5 py-2 text-left enabled:hover:border-border-strong disabled:cursor-default"
    >
      <span
        className="flex items-center justify-center rounded-md"
        style={{ width: 26, height: 26, background: "var(--accent-soft)", color: "var(--accent)" }}
      >
        <Link2 size={13} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11px] text-muted">
          {label}
          {relation !== null && relation !== undefined && relation !== "" && (
            <span className="text-subtle">· {relation}</span>
          )}
        </div>
        <div className="mono text-[12px] font-semibold" style={{ color: "var(--accent)" }}>
          {id.slice(0, 8)}
        </div>
      </div>
      {onClick !== undefined && <ChevronRight size={14} className="text-muted" />}
    </button>
  );
}


/**
 * Root-cause tab. The CAPA row carries no root-cause field of its own — the
 * structured analysis (5-Whys / Ishikawa) lives on a linked 8D's D4 discipline
 * (07/FEATURES). So rather than a fabricated RCA editor, this surfaces the real
 * linked 8D(s) as navigable cards; with none linked it stays an honest prompt.
 */
function CapaRcaTab({ capa, onOpen }: { capa: CapaDto; onOpen: (kind: EntityKind, id: string) => void }): React.ReactElement {
  const links = useEntityLinks("capa", capa.id);
  const eightDs = (links.data?.items ?? [])
    .map((l) => (l.fromKind === "capa" && l.fromId === capa.id ? { kind: l.toKind, id: l.toId } : { kind: l.fromKind, id: l.fromId }))
    .filter((o) => o.kind === "eight_d");

  if (links.isLoading) return <Skeleton className="h-40 rounded-xl" />;

  if (eightDs.length === 0) {
    return (
      <div className="k-surface">
        <EmptyState
          icon={Brain}
          title="No root-cause analysis linked"
          body="This CAPA's structured root-cause work (5-Whys / Ishikawa) is captured on a linked 8D — its D4 discipline. Link an 8D and it will surface here."
        />
      </div>
    );
  }

  return (
    <div className="k-surface p-5">
      <h4 className="text-[13px] font-semibold">Root cause analysis</h4>
      <p className="mt-1 mb-3.5 text-[12.5px] text-muted">
        The structured analysis for this CAPA is maintained on its linked 8D (discipline D4 · Root Cause). Open it to review or
        edit the 5-Whys / Ishikawa work.
      </p>
      <div className="flex flex-col gap-2">
        {eightDs.map((d) => (
          <LinkedItem key={d.id} label="8D report" id={d.id} relation="root cause" onClick={() => onOpen("eight_d", d.id)} />
        ))}
      </div>
    </div>
  );
}

/**
 * Effectiveness tab. The backend records only `effectivenessCheckAt` (a schedule
 * date) — not structured pass/fail check results — so this shows the real
 * scheduled date and phase-aware state instead of fabricated result cards, and
 * says plainly that captured results land later.
 */
function CapaEffectivenessTab({ capa }: { capa: CapaDto }): React.ReactElement {
  const reached = phaseIndex(capa.status) >= phaseIndex("effectiveness");
  const scheduled = capa.effectivenessCheckAt;

  if (scheduled === null && !reached) {
    return (
      <div className="k-surface">
        <EmptyState
          icon={ShieldCheck}
          title="Effectiveness check not scheduled"
          body="Once the corrective actions are implemented, schedule an effectiveness check to verify they hold before the CAPA closes."
        />
      </div>
    );
  }

  const phaseLabel =
    capa.status === "closed"
      ? "CAPA closed — effectiveness verified"
      : reached
        ? "In effectiveness check"
        : "Pending — the CAPA hasn't reached the effectiveness phase yet";

  return (
    <div className="k-surface p-5">
      <h4 className="text-[13px] font-semibold">Effectiveness verification</h4>
      <p className="mt-1 mb-4 text-[12.5px] text-muted">
        Confirms the implemented actions are sustainably effective before the CAPA closes.
      </p>
      <div className="flex flex-col gap-2.5">
        <Meta label="Scheduled">
          <span className="mono text-[12px]">{scheduled !== null ? longDate(scheduled) : "Not set"}</span>
        </Meta>
        <Meta label="Phase">
          <span className="text-[12.5px]">{phaseLabel}</span>
        </Meta>
      </div>
      <p className="mt-4 text-[11.5px] text-subtle">
        Structured check results (metric vs. target, pass/fail) will record here once effectiveness-check capture is
        implemented; today the CAPA tracks the scheduled date and phase only.
      </p>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="k-overline">{label}</span>
      {children}
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }): React.ReactElement {
  return (
    <button type="button" onClick={onClick} className="k-btn k-btn-plain self-start px-0 text-[13px] text-muted">
      <ArrowLeft size={14} /> Back to CAPAs
    </button>
  );
}

function DetailSkeleton(): React.ReactElement {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
      <Skeleton className="h-5 w-28" />
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-28 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
