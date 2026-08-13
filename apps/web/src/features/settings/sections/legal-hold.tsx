"use client";

import { useState } from "react";
import { Lock, Plus, Search } from "lucide-react";
import {
  LegalHoldEntityKind,
  type CreateLegalHoldBody,
  type LegalHoldDto,
  type LegalHoldScopeInput,
  type LegalHoldStatus,
} from "@kaenal/types";
import { useCan } from "@/hooks/use-me";
import {
  useCreateLegalHold,
  useDeleteLegalHold,
  useLegalHolds,
  useReleaseLegalHold,
} from "@/hooks/use-legal-holds";
import { Dialog, DialogClose, DialogContent, EmptyState, Segmented, Spinner, useToast } from "@/components/ui";
import { SettingsPage, SettingsCard } from "../settings-bits";

type ScopeMode = LegalHoldScopeInput["mode"];
type EntityKind = (typeof LegalHoldEntityKind.options)[number];

const STATUS_CHIP: Record<LegalHoldStatus, { bg: string; fg: string; label: string }> = {
  active: { bg: "rgba(220,38,38,0.10)", fg: "#b91c1c", label: "Active" },
  released: { bg: "var(--bg-subtle)", fg: "var(--text-muted)", label: "Released" },
};

const KIND_LABEL: Record<EntityKind, string> = {
  ncr: "NCRs",
  inspection: "Inspections",
  document: "Documents",
  capa: "CAPAs",
  scar: "SCARs",
  eight_d: "8D reports",
  audit: "Audits",
  supplier: "Suppliers",
};

function scopeLabel(scope: LegalHoldScopeInput): string {
  switch (scope.mode) {
    case "tenant":
      return "Entire workspace";
    case "kinds":
      return scope.entityKinds.map((k) => KIND_LABEL[k]).join(", ");
    case "record":
      return scope.entityId !== undefined
        ? `${KIND_LABEL[scope.entityKind]} · ${scope.entityId}`
        : `All ${KIND_LABEL[scope.entityKind]}`;
  }
}

function scopeSearchText(scope: LegalHoldScopeInput): string {
  return scopeLabel(scope);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

interface Builder {
  name: string;
  matter: string;
  notes: string;
  mode: ScopeMode;
  entityKinds: EntityKind[];
  recordKind: EntityKind;
  recordId: string;
}

const EMPTY_BUILDER: Builder = {
  name: "",
  matter: "",
  notes: "",
  mode: "tenant",
  entityKinds: [],
  recordKind: "ncr",
  recordId: "",
};

/** Assemble the tagged-union scope the API expects from the flat builder state. */
function builderScope(b: Builder): LegalHoldScopeInput {
  if (b.mode === "kinds") return { mode: "kinds", entityKinds: b.entityKinds };
  if (b.mode === "record") {
    const id = b.recordId.trim();
    return id !== "" ? { mode: "record", entityKind: b.recordKind, entityId: id } : { mode: "record", entityKind: b.recordKind };
  }
  return { mode: "tenant" };
}

/**
 * Legal hold (settings.jsx → compliance-extra.jsx `LegalHold`) on the enforced
 * `legal_holds` table. An admin lists holds, opens new ones with a real scope
 * (whole workspace / entity kinds / one record), and releases them behind a
 * confirm — a release lifts a preservation obligation, so the nightly purge job
 * will again permanently erase soft-deleted rows the hold covered. Faithful to
 * the design's hold register; the custodian-acknowledgment table and
 * frozen-record / storage counters need sub-entities + metering that don't exist
 * yet (flagged in TODO), so they are omitted rather than faked.
 */
export function LegalHoldSection(): React.ReactElement {
  const toast = useToast();
  const canManage = useCan("settings:manage");
  const { data, isPending } = useLegalHolds();
  const create = useCreateLegalHold();
  const release = useReleaseLegalHold();
  const del = useDeleteLegalHold();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | LegalHoldStatus>("all");
  const [builder, setBuilder] = useState<Builder>(EMPTY_BUILDER);
  const [err, setErr] = useState("");
  const [toRelease, setToRelease] = useState<LegalHoldDto | null>(null);
  const [toDelete, setToDelete] = useState<LegalHoldDto | null>(null);

  const holds = data?.items ?? [];
  const activeCount = holds.filter((h) => h.status === "active").length;
  const releasedCount = holds.filter((h) => h.status === "released").length;
  const filtered = holds.filter(
    (h) =>
      (status === "all" || h.status === status) &&
      (q.trim() === "" ||
        `${h.reference} ${h.name} ${h.matter} ${scopeSearchText(h.scope)}`.toLowerCase().includes(q.toLowerCase())),
  );

  const setB = <K extends keyof Builder>(k: K, v: Builder[K]): void => setBuilder((s) => ({ ...s, [k]: v }));

  const toggleKind = (k: EntityKind): void =>
    setBuilder((s) => ({
      ...s,
      entityKinds: s.entityKinds.includes(k) ? s.entityKinds.filter((x) => x !== k) : [...s.entityKinds, k],
    }));

  const save = (): void => {
    if (builder.name.trim() === "") return setErr("Give the hold a name.");
    if (builder.mode === "kinds" && builder.entityKinds.length === 0)
      return setErr("Pick at least one entity kind to freeze.");
    setErr("");
    const body: CreateLegalHoldBody = {
      name: builder.name.trim(),
      matter: builder.matter.trim(),
      scope: builderScope(builder),
      notes: builder.notes.trim(),
    };
    create.mutate(body, {
      onSuccess: () => {
        toast.success("Legal hold opened");
        setBuilder(EMPTY_BUILDER);
      },
      onError: () => toast.error("Couldn't open the hold"),
    });
  };

  const confirmRelease = (): void => {
    if (toRelease === null) return;
    release.mutate(
      { id: toRelease.id, version: toRelease.lockVersion },
      {
        onSuccess: () => toast.success("Hold released"),
        onError: () => toast.error("Couldn't release the hold"),
      },
    );
    setToRelease(null);
  };

  const confirmDelete = (): void => {
    if (toDelete === null) return;
    del.mutate(toDelete.id, {
      onSuccess: () => toast.success("Hold removed"),
      onError: () => toast.error("Couldn't remove the hold"),
    });
    setToDelete(null);
  };

  return (
    <SettingsPage
      title="Legal hold"
      subtitle="Freeze records relevant to litigation, audit, or investigation"
      actions={
        <button className="k-btn k-btn-primary" onClick={() => setBuilder(EMPTY_BUILDER)} disabled={!canManage}>
          <Plus size={14} /> New hold
        </button>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="k-surface p-3.5">
          <div className="text-[10.5px] font-semibold uppercase text-muted">Active holds</div>
          <div className="text-[22px] font-bold" style={{ color: "#dc2626" }}>{activeCount}</div>
        </div>
        <div className="k-surface p-3.5">
          <div className="text-[10.5px] font-semibold uppercase text-muted">Released</div>
          <div className="text-[22px] font-bold text-muted">{releasedCount}</div>
        </div>
      </div>

      <SettingsCard title="Hold register" desc="Active holds bypass retention and erasure — the nightly purge won't permanently delete rows they cover.">
        <div className="mb-3 flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1 sm:max-w-[320px]">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-2.5 text-muted" />
            <input
              className="k-input"
              style={{ paddingLeft: 30, height: 32 }}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search holds…"
            />
          </div>
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "All" },
              { value: "active", label: "Active" },
              { value: "released", label: "Released" },
            ]}
          />
        </div>

        {isPending ? (
          <div className="flex items-center justify-center py-12 text-muted">
            <Spinner /> <span className="ml-2 text-[13px]">Loading…</span>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Lock}
            title={holds.length === 0 ? "No legal holds yet" : "No holds match this filter"}
            body={
              holds.length === 0
                ? "Open a hold below to preserve records for litigation or audit — they'll be exempt from permanent purge."
                : "Try a different search or status filter."
            }
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.map((h) => {
              const chip = STATUS_CHIP[h.status];
              return (
                <div
                  key={h.id}
                  className="rounded-md border border-border p-3.5"
                  style={{ borderLeft: `3px solid ${h.status === "active" ? "#dc2626" : "var(--border)"}` }}
                >
                  <div className="flex items-start gap-3">
                    <Lock size={17} style={{ color: h.status === "active" ? "#dc2626" : "var(--text-muted)", marginTop: 2 }} />
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11.5px] text-muted">{h.reference}</span>
                        <span className="k-chip" style={{ background: chip.bg, color: chip.fg }}>{chip.label}</span>
                        <span className="text-[11px] text-muted">· Opened {fmtDate(h.openedAt)}</span>
                        {h.releasedAt !== null && (
                          <span className="text-[11px] text-muted">· Released {fmtDate(h.releasedAt)}</span>
                        )}
                      </div>
                      <div className="text-[14px] font-semibold">{h.name}</div>
                      {h.matter !== "" && <div className="mb-1.5 text-[11.5px] text-muted">{h.matter}</div>}
                      <div className="k-overline mb-1">Scope</div>
                      <span className="k-chip" style={{ background: "var(--bg-subtle)", fontSize: 10.5 }}>
                        {scopeLabel(h.scope)}
                      </span>
                      {h.notes !== "" && <div className="mt-1.5 text-[11.5px] text-muted">{h.notes}</div>}
                    </div>
                    {canManage && (
                      <div className="flex shrink-0 flex-col gap-1.5">
                        {h.status === "active" && (
                          <button
                            className="k-btn k-btn-secondary k-btn-sm"
                            style={{ color: "#dc2626" }}
                            onClick={() => setToRelease(h)}
                          >
                            Release
                          </button>
                        )}
                        <button className="k-btn k-btn-secondary k-btn-sm" onClick={() => setToDelete(h)}>
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SettingsCard>

      <SettingsCard title="Open a hold">
        <div className="rounded-md p-3.5" style={{ background: "var(--bg-subtle)" }}>
          <div className="mb-2.5">
            <input
              className="k-input"
              value={builder.name}
              placeholder="Hold name — e.g. Volvo T-9384 field failure — potential litigation"
              onChange={(e) => setB("name", e.target.value)}
              style={{ borderColor: err !== "" && builder.name.trim() === "" ? "var(--danger-500)" : undefined }}
            />
          </div>
          <div className="mb-2.5">
            <input
              className="k-input"
              value={builder.matter}
              placeholder="Matter — e.g. External counsel: Khaitan & Co."
              onChange={(e) => setB("matter", e.target.value)}
            />
          </div>

          <div className="mb-2.5">
            <div className="k-overline mb-1.5">Freeze</div>
            <Segmented
              value={builder.mode}
              onChange={(v) => setB("mode", v)}
              options={[
                { value: "tenant", label: "Entire workspace" },
                { value: "kinds", label: "Entity kinds" },
                { value: "record", label: "One record" },
              ]}
            />
            {builder.mode === "kinds" && (
              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
                {LegalHoldEntityKind.options.map((k) => (
                  <label key={k} className="flex items-center gap-2 text-[12.5px]">
                    <input
                      type="checkbox"
                      checked={builder.entityKinds.includes(k)}
                      onChange={() => toggleKind(k)}
                      style={{ accentColor: "var(--accent)" }}
                    />
                    {KIND_LABEL[k]}
                  </label>
                ))}
              </div>
            )}
            {builder.mode === "record" && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[13px]">
                <select
                  className="k-input"
                  style={{ width: "auto", height: 30 }}
                  value={builder.recordKind}
                  onChange={(e) => setB("recordKind", e.target.value as EntityKind)}
                >
                  {LegalHoldEntityKind.options.map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
                <input
                  className="k-input"
                  style={{ width: 300, height: 30 }}
                  value={builder.recordId}
                  placeholder="Record id (optional — blank freezes all of the kind)"
                  onChange={(e) => setB("recordId", e.target.value)}
                />
              </div>
            )}
          </div>

          <textarea
            className="k-input"
            style={{ minHeight: 56, resize: "vertical" }}
            value={builder.notes}
            placeholder="Notes (optional)"
            onChange={(e) => setB("notes", e.target.value)}
          />
          {err !== "" && (
            <div className="mt-2.5 flex items-center gap-1.5 text-[12px]" style={{ color: "#b91c1c" }}>
              {err}
            </div>
          )}
        </div>
        <div className="mt-3.5 flex">
          <button className="k-btn k-btn-primary ml-auto" onClick={save} disabled={!canManage || create.isPending}>
            {create.isPending ? "Opening…" : "Open hold"}
          </button>
        </div>
      </SettingsCard>

      <Dialog open={toRelease !== null} onOpenChange={(o) => !o && setToRelease(null)}>
        <DialogContent
          title="Release this legal hold?"
          description={`"${toRelease?.name ?? ""}" will be marked released. The preservation obligation is lifted and covered records return to normal retention (eligible for permanent purge).`}
        >
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <button className="k-btn k-btn-secondary">Cancel</button>
            </DialogClose>
            <button
              className="k-btn k-btn-primary"
              style={{ background: "var(--danger-600)" }}
              onClick={confirmRelease}
              disabled={release.isPending}
            >
              Release hold
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={toDelete !== null} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent
          title="Remove this hold from the register?"
          description={`"${toDelete?.name ?? ""}" (${toDelete?.reference ?? ""}) will be removed and released, so it no longer protects any records.`}
        >
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <button className="k-btn k-btn-secondary">Cancel</button>
            </DialogClose>
            <button
              className="k-btn k-btn-primary"
              style={{ background: "var(--danger-600)" }}
              onClick={confirmDelete}
              disabled={del.isPending}
            >
              Remove hold
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </SettingsPage>
  );
}
