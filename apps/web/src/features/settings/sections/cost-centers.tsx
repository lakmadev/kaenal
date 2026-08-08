"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import type { ChargebackSettings, CostCenterDto } from "@kaenal/types";
import { useCan } from "@/hooks/use-me";
import {
  useAssignCostCenter,
  useChargebackReport,
  useChargebackSettings,
  useCostCenterAssignments,
  useCostCenters,
  useCreateCostCenter,
  useDeleteCostCenter,
  useUpdateChargebackSettings,
  useUpdateCostCenter,
} from "@/hooks/use-cost-centers";
import { Dialog, DialogClose, DialogContent, EmptyState, Segmented, Spinner, useToast } from "@/components/ui";
import { SettingsPage, SettingsCard, SettingsRow, Toggle } from "../settings-bits";

function money(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }
}

interface Builder {
  editingId: string | null;
  version: number;
  code: string;
  name: string;
  parentId: string | null;
}

const EMPTY_BUILDER: Builder = { editingId: null, version: 0, code: "", name: "", parentId: null };

/** Order the flat list as a parent→child tree (2 levels in the design; deeper is
 *  rendered by indent depth). */
function ordered(centers: CostCenterDto[]): { cc: CostCenterDto; depth: number }[] {
  const byParent = new Map<string | null, CostCenterDto[]>();
  for (const cc of centers) {
    const k = cc.parentId;
    (byParent.get(k) ?? byParent.set(k, []).get(k)!).push(cc);
  }
  const out: { cc: CostCenterDto; depth: number }[] = [];
  const walk = (parent: string | null, depth: number): void => {
    for (const cc of byParent.get(parent) ?? []) {
      out.push({ cc, depth });
      walk(cc.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/**
 * Cost centers & chargeback (settings.jsx → multi-tenancy.jsx `CostCenters`). A
 * real tenant cost-center hierarchy that memberships are assigned to; seats are a
 * live count. The chargeback table is COMPUTED server-side — seats × rate + a
 * shared platform fee split with a conserved-total apportionment — so the parts
 * always sum to the grand total. AI + storage costs are shown as "—" until a
 * metering pipeline exists (flagged); the design's Export/NetSuite/Finalize
 * actions need that pipeline + a GL integration and are omitted, not faked.
 */
export function CostCentersSection(): React.ReactElement {
  const toast = useToast();
  const canManage = useCan("settings:manage");
  const centersQ = useCostCenters();
  const assignmentsQ = useCostCenterAssignments();
  const settingsQ = useChargebackSettings();
  const reportQ = useChargebackReport();
  const createCc = useCreateCostCenter();
  const updateCc = useUpdateCostCenter();
  const deleteCc = useDeleteCostCenter();
  const assign = useAssignCostCenter();
  const saveSettings = useUpdateChargebackSettings();

  const [builder, setBuilder] = useState<Builder>(EMPTY_BUILDER);
  const [err, setErr] = useState("");
  const [toDelete, setToDelete] = useState<CostCenterDto | null>(null);
  const [form, setForm] = useState<ChargebackSettings | null>(null);

  useEffect(() => {
    if (settingsQ.data !== undefined && form === null) {
      const { lockVersion: _v, ...rest } = settingsQ.data;
      setForm(rest);
    }
  }, [settingsQ.data, form]);

  const centers = centersQ.data?.items ?? [];
  const tree = ordered(centers);
  const setB = <K extends keyof Builder>(k: K, v: Builder[K]): void => setBuilder((s) => ({ ...s, [k]: v }));

  const saveCc = (): void => {
    if (builder.code.trim() === "") return setErr("Give the cost center a code.");
    if (builder.name.trim() === "") return setErr("Give the cost center a name.");
    setErr("");
    const body = { code: builder.code.trim(), name: builder.name.trim(), parentId: builder.parentId };
    if (builder.editingId !== null) {
      updateCc.mutate(
        { id: builder.editingId, body: { ...body, version: builder.version } },
        {
          onSuccess: () => {
            toast.success("Cost center updated");
            setBuilder(EMPTY_BUILDER);
          },
          onError: () => toast.error("Couldn't update — code may already be in use"),
        },
      );
    } else {
      createCc.mutate(body, {
        onSuccess: () => {
          toast.success("Cost center added");
          setBuilder(EMPTY_BUILDER);
        },
        onError: () => toast.error("Couldn't add — code may already be in use"),
      });
    }
  };

  const edit = (cc: CostCenterDto): void =>
    setBuilder({ editingId: cc.id, version: cc.lockVersion, code: cc.code, name: cc.name, parentId: cc.parentId });

  const confirmDelete = (): void => {
    if (toDelete === null) return;
    deleteCc.mutate(toDelete.id, {
      onSuccess: () => toast.success("Cost center removed"),
      onError: () => toast.error("Couldn't remove — reparent its sub-centers first"),
    });
    setToDelete(null);
  };

  const saveAllocation = (): void => {
    if (form === null || settingsQ.data === undefined) return;
    saveSettings.mutate(
      { ...form, version: settingsQ.data.lockVersion },
      {
        onSuccess: () => toast.success("Allocation settings saved"),
        onError: () => toast.error("Couldn't save allocation settings"),
      },
    );
  };
  const setF = <K extends keyof ChargebackSettings>(k: K, v: ChargebackSettings[K]): void =>
    setForm((s) => (s === null ? s : { ...s, [k]: v }));

  const report = reportQ.data;
  const currency = report?.currency ?? "USD";
  // Parent options exclude the node being edited (can't parent to itself).
  const parentOptions = centers.filter((c) => c.id !== builder.editingId);

  return (
    <SettingsPage
      title="Cost centers & chargeback"
      subtitle="Department hierarchy, seat allocation, and monthly chargeback"
      actions={
        <button className="k-btn k-btn-primary" onClick={() => setBuilder(EMPTY_BUILDER)} disabled={!canManage}>
          <Plus size={14} /> New cost center
        </button>
      }
    >
      <SettingsCard title="Department & cost-center hierarchy" desc="Used for chargeback, reporting, and access scoping">
        {centersQ.isPending ? (
          <div className="flex items-center justify-center py-10 text-muted">
            <Spinner /> <span className="ml-2 text-[13px]">Loading…</span>
          </div>
        ) : tree.length === 0 ? (
          <EmptyState icon={Plus} title="No cost centers yet" body="Add one below to start allocating seats and platform costs." />
        ) : (
          <div className="k-surface" style={{ padding: 6 }}>
            {tree.map(({ cc, depth }) => (
              <div
                key={cc.id}
                className="group flex items-center gap-2 rounded px-2 py-1.5 text-[12.5px] hover:bg-[var(--bg-subtle)]"
                style={{ paddingLeft: 8 + depth * 20, fontWeight: depth === 0 ? 700 : 400 }}
              >
                {depth === 0 && <ChevronDown size={11} className="text-muted" />}
                <span>{cc.name}</span>
                <span className="ml-auto font-mono text-[10.5px] text-muted">
                  {cc.code} · {cc.seats} {cc.seats === 1 ? "seat" : "seats"}
                </span>
                {canManage && (
                  <span className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button className="k-btn k-btn-plain k-btn-icon" aria-label={`Edit ${cc.name}`} onClick={() => edit(cc)}>
                      <Pencil size={13} />
                    </button>
                    <button
                      className="k-btn k-btn-plain k-btn-icon"
                      aria-label={`Delete ${cc.name}`}
                      onClick={() => setToDelete(cc)}
                      style={{ color: "var(--danger-600)" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Builder */}
        <div className="mt-3 rounded-md p-3" style={{ background: "var(--bg-subtle)" }}>
          <div className="mb-2 text-[12px] font-semibold">
            {builder.editingId !== null ? "Edit cost center" : "New cost center"}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="k-input"
              style={{ width: 130, height: 30 }}
              value={builder.code}
              placeholder="CC-4101"
              onChange={(e) => setB("code", e.target.value)}
            />
            <input
              className="k-input flex-1"
              style={{ height: 30, minWidth: 180 }}
              value={builder.name}
              placeholder="Quality — Pune-1"
              onChange={(e) => setB("name", e.target.value)}
            />
            <select
              className="k-input"
              style={{ width: "auto", height: 30 }}
              value={builder.parentId ?? ""}
              onChange={(e) => setB("parentId", e.target.value === "" ? null : e.target.value)}
            >
              <option value="">No parent (top level)</option>
              {parentOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
            <button className="k-btn k-btn-primary" onClick={saveCc} disabled={!canManage || createCc.isPending || updateCc.isPending}>
              {builder.editingId !== null ? "Save" : "Add"}
            </button>
            {builder.editingId !== null && (
              <button className="k-btn k-btn-secondary" onClick={() => setBuilder(EMPTY_BUILDER)}>
                Cancel
              </button>
            )}
          </div>
          {err !== "" && (
            <div className="mt-2 text-[12px]" style={{ color: "#b91c1c" }}>
              {err}
            </div>
          )}
        </div>
      </SettingsCard>

      <SettingsCard title="Member assignment" desc="Which cost center each member's seat is billed to">
        {assignmentsQ.isPending ? (
          <div className="flex items-center justify-center py-8 text-muted">
            <Spinner /> <span className="ml-2 text-[13px]">Loading…</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {(assignmentsQ.data?.items ?? []).map((m) => (
              <div key={m.userId} className="flex items-center gap-3 rounded px-2 py-1.5 text-[12.5px] hover:bg-[var(--bg-subtle)]">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{m.name}</div>
                  <div className="text-[11px] text-muted">
                    {m.email} · {m.role}
                  </div>
                </div>
                <select
                  className="k-input"
                  style={{ width: "auto", height: 30 }}
                  value={m.costCenterId ?? ""}
                  disabled={!canManage || assign.isPending}
                  onChange={(e) =>
                    assign.mutate(
                      { userId: m.userId, costCenterId: e.target.value === "" ? null : e.target.value },
                      { onError: () => toast.error("Couldn't reassign") },
                    )
                  }
                >
                  <option value="">Unallocated</option>
                  {centers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </SettingsCard>

      <SettingsCard
        title={`Monthly chargeback — ${report?.period ?? "current"}`}
        desc="Computed from live seats. Seats × rate is exact; the platform fee is split by seats so the parts sum to the total."
      >
        {reportQ.isPending || report === undefined ? (
          <div className="flex items-center justify-center py-8 text-muted">
            <Spinner /> <span className="ml-2 text-[13px]">Computing…</span>
          </div>
        ) : report.rows.length === 0 ? (
          <EmptyState icon={Plus} title="Nothing to bill yet" body="Add cost centers and assign members to see the monthly chargeback." />
        ) : (
          <div className="overflow-x-auto">
            <table className="k-table" style={{ width: "100%", minWidth: 560 }}>
              <thead>
                <tr>
                  <th>Cost center</th>
                  <th style={{ textAlign: "right" }}>Seats</th>
                  <th style={{ textAlign: "right" }}>Seats $</th>
                  <th style={{ textAlign: "right" }}>Platform $</th>
                  <th style={{ textAlign: "right" }}>AI $</th>
                  <th style={{ textAlign: "right" }}>Storage $</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.costCenterId ?? "unallocated"}>
                    <td>
                      <div className="text-[13px] font-medium">{r.name}</div>
                      <div className="font-mono text-[10.5px] text-muted">{r.code}</div>
                    </td>
                    <td className="font-mono" style={{ textAlign: "right" }}>{r.seats}</td>
                    <td className="font-mono" style={{ textAlign: "right" }}>{money(r.seatCostCents, currency)}</td>
                    <td className="font-mono" style={{ textAlign: "right" }}>{money(r.platformShareCents, currency)}</td>
                    <td className="font-mono text-muted" style={{ textAlign: "right" }}>—</td>
                    <td className="font-mono text-muted" style={{ textAlign: "right" }}>—</td>
                    <td className="font-mono" style={{ textAlign: "right", fontWeight: 700 }}>{money(r.totalCents, currency)}</td>
                  </tr>
                ))}
                <tr style={{ background: "var(--bg-subtle)" }}>
                  <td colSpan={6} style={{ fontWeight: 700, textAlign: "right" }}>
                    Total {report.period}
                  </td>
                  <td className="font-mono" style={{ textAlign: "right", fontWeight: 800, fontSize: 14 }}>
                    {money(report.totalCents, currency)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {report?.meteringPending && (
          <div className="mt-2 text-[11.5px] text-muted">
            AI &amp; storage are shown as <strong>—</strong>: usage metering isn&apos;t wired yet (flagged for a later slice).
            Seats and the platform-fee split are real.
          </div>
        )}
      </SettingsCard>

      <SettingsCard title="Allocation rules" desc="How shared platform costs are split across cost centers">
        {settingsQ.isPending || form === null ? (
          <div className="flex items-center justify-center py-8 text-muted">
            <Spinner /> <span className="ml-2 text-[13px]">Loading…</span>
          </div>
        ) : (
          <>
            <SettingsRow label="Currency" hint="ISO currency code used across the chargeback">
              <input
                className="k-input"
                style={{ width: 90, height: 30 }}
                value={form.currency}
                disabled={!canManage}
                onChange={(e) => setF("currency", e.target.value.toUpperCase().slice(0, 8))}
              />
            </SettingsRow>
            <SettingsRow label="Seat licence rate" hint="Monthly cost per active seat (enforced in the report)">
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] text-muted">{currency}</span>
                <input
                  type="number"
                  className="k-input"
                  style={{ width: 100, height: 30 }}
                  min={0}
                  value={form.seatRateCents / 100}
                  disabled={!canManage}
                  onChange={(e) => setF("seatRateCents", Math.max(0, Math.round(Number(e.target.value) * 100) || 0))}
                />
                <span className="text-[12px] text-muted">/ seat / mo</span>
              </div>
            </SettingsRow>
            <SettingsRow label="Shared platform fee" hint="Split across cost centers by seats (conserved apportionment)">
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] text-muted">{currency}</span>
                <input
                  type="number"
                  className="k-input"
                  style={{ width: 120, height: 30 }}
                  min={0}
                  value={form.platformMonthlyFeeCents / 100}
                  disabled={!canManage}
                  onChange={(e) => setF("platformMonthlyFeeCents", Math.max(0, Math.round(Number(e.target.value) * 100) || 0))}
                />
                <span className="text-[12px] text-muted">/ mo</span>
              </div>
            </SettingsRow>
            <SettingsRow label="Seat licence allocation" hint="Stored; the report bills each seat to the member's cost center">
              <Segmented
                value={form.seatAllocation}
                onChange={(v) => setF("seatAllocation", v)}
                options={[
                  { value: "user-cc", label: "User's CC" },
                  { value: "usage", label: "Pro-rated" },
                  { value: "corp", label: "Corporate" },
                ]}
              />
            </SettingsRow>
            <SettingsRow label="AI cost allocation" hint="Stored — applies once AI usage is metered">
              <Segmented
                value={form.aiAllocation}
                onChange={(v) => setF("aiAllocation", v)}
                options={[
                  { value: "user-cc", label: "Caller's CC" },
                  { value: "record-cc", label: "Record owner's CC" },
                  { value: "split", label: "Split 50/50" },
                ]}
              />
            </SettingsRow>
            <SettingsRow label="Storage allocation" hint="Stored — applies once storage is metered">
              <Segmented
                value={form.storageAllocation}
                onChange={(v) => setF("storageAllocation", v)}
                options={[
                  { value: "record-cc", label: "Record owner's CC" },
                  { value: "corp", label: "Corporate" },
                ]}
              />
            </SettingsRow>
            <SettingsRow label="Show CC budget vs actual to managers">
              <Toggle on={form.showBudgetToManagers} {...(canManage ? { onChange: (v: boolean) => setF("showBudgetToManagers", v) } : {})} />
            </SettingsRow>
            <div className="mt-3 flex">
              <button className="k-btn k-btn-primary ml-auto" onClick={saveAllocation} disabled={!canManage || saveSettings.isPending}>
                <Check size={14} /> {saveSettings.isPending ? "Saving…" : "Save allocation rules"}
              </button>
            </div>
          </>
        )}
      </SettingsCard>

      <Dialog open={toDelete !== null} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent
          title="Remove cost center?"
          description={`"${toDelete?.name ?? ""}" (${toDelete?.code ?? ""}) will be removed and its members become Unallocated.`}
        >
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <button className="k-btn k-btn-secondary">Cancel</button>
            </DialogClose>
            <button className="k-btn k-btn-primary" style={{ background: "var(--danger-600)" }} onClick={confirmDelete} disabled={deleteCc.isPending}>
              Remove
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </SettingsPage>
  );
}
