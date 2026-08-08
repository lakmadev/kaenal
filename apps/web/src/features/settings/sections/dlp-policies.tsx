"use client";

import { useState } from "react";
import { AlertTriangle, Bell, Eye, Lock, Plus, Search, Shield, ShieldOff, Trash2 } from "lucide-react";
import type { CreateDlpPolicyBody, DlpAction, DlpPolicyDto } from "@kaenal/types";
import { useCan } from "@/hooks/use-me";
import { useCreateDlpPolicy, useDeleteDlpPolicy, useDlpPolicies, useUpdateDlpPolicy } from "@/hooks/use-dlp-policies";
import { Dialog, DialogClose, DialogContent, EmptyState, Segmented, Spinner, useToast } from "@/components/ui";
import { SettingsPage, SettingsCard, Toggle } from "../settings-bits";
import type { LucideIcon } from "lucide-react";

const ACTIONS: { value: DlpAction; label: string }[] = [
  { value: "block", label: "Block" },
  { value: "warn", label: "Warn" },
  { value: "watermark", label: "Watermark" },
  { value: "quarantine", label: "Quarantine" },
  { value: "notify", label: "Notify" },
];

const ACTION_META: Record<DlpAction, { bg: string; fg: string; label: string; icon: LucideIcon }> = {
  block: { bg: "rgba(220,38,38,0.10)", fg: "#b91c1c", label: "Block", icon: Lock },
  warn: { bg: "rgba(245,158,11,0.12)", fg: "#92400e", label: "Warn", icon: AlertTriangle },
  watermark: { bg: "rgba(124,58,237,0.10)", fg: "#7c3aed", label: "Watermark", icon: Eye },
  quarantine: { bg: "rgba(13,148,136,0.10)", fg: "#0d9488", label: "Quarantine", icon: ShieldOff },
  notify: { bg: "rgba(37,99,235,0.10)", fg: "#1d4ed8", label: "Notify", icon: Bell },
};

interface Builder {
  name: string;
  pattern: string;
  action: DlpAction;
  surface: string;
  note: string;
}

const EMPTY_BUILDER: Builder = { name: "", pattern: "", action: "block", surface: "", note: "" };

/**
 * DLP policies (settings.jsx → compliance-extra.jsx `DLPPolicies`). An admin
 * lists/searches policies, flips them on/off, deletes them, and builds new ones.
 * Faithful to the design's policy list + rule builder; the design's stat cards
 * (blocked/warned counts) and "recent events" table need an interception layer +
 * event log that don't exist yet (flagged in TODO), so they are omitted rather
 * than faked. No policy is enforced at runtime today — the register is stored.
 */
export function DlpPoliciesSection(): React.ReactElement {
  const toast = useToast();
  const canManage = useCan("settings:manage");
  const { data, isPending } = useDlpPolicies();
  const create = useCreateDlpPolicy();
  const update = useUpdateDlpPolicy();
  const del = useDeleteDlpPolicy();

  const [q, setQ] = useState("");
  const [act, setAct] = useState<"all" | DlpAction>("all");
  const [builder, setBuilder] = useState<Builder>(EMPTY_BUILDER);
  const [err, setErr] = useState("");
  const [toDelete, setToDelete] = useState<DlpPolicyDto | null>(null);

  const policies = data?.items ?? [];
  const filtered = policies.filter(
    (p) =>
      (act === "all" || p.action === act) &&
      (q.trim() === "" || `${p.name} ${p.pattern} ${p.surface} ${p.note}`.toLowerCase().includes(q.toLowerCase())),
  );

  const setB = <K extends keyof Builder>(k: K, v: Builder[K]): void => setBuilder((s) => ({ ...s, [k]: v }));

  const save = (): void => {
    if (builder.name.trim() === "") return setErr("Give the policy a name.");
    setErr("");
    const body: CreateDlpPolicyBody = {
      name: builder.name.trim(),
      pattern: builder.pattern.trim(),
      action: builder.action,
      surface: builder.surface.trim(),
      note: builder.note.trim(),
      enabled: true,
    };
    create.mutate(body, {
      onSuccess: () => {
        toast.success("DLP policy added");
        setBuilder(EMPTY_BUILDER);
      },
      onError: () => toast.error("Couldn't add the policy"),
    });
  };

  const toggle = (p: DlpPolicyDto): void => {
    update.mutate(
      {
        id: p.id,
        body: {
          name: p.name,
          pattern: p.pattern,
          action: p.action,
          surface: p.surface,
          note: p.note,
          enabled: !p.enabled,
          version: p.lockVersion,
        },
      },
      { onError: () => toast.error("Couldn't update the policy") },
    );
  };

  const confirmDelete = (): void => {
    if (toDelete === null) return;
    del.mutate(toDelete.id, {
      onSuccess: () => toast.success("Policy removed"),
      onError: () => toast.error("Couldn't remove the policy"),
    });
    setToDelete(null);
  };

  return (
    <SettingsPage
      title="Data loss prevention"
      subtitle="Pre-egress controls on uploads, downloads, exports, and outbound email"
      actions={
        <button className="k-btn k-btn-primary" onClick={() => setBuilder(EMPTY_BUILDER)} disabled={!canManage}>
          <Plus size={14} /> New policy
        </button>
      }
    >
      <SettingsCard title="Policies" desc="Stored register — pre-egress interception isn't wired to a runtime yet (flagged for a later slice).">
        <div className="mb-3 flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1 sm:max-w-[320px]">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-2.5 text-muted" />
            <input
              className="k-input"
              style={{ paddingLeft: 30, height: 32 }}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search policies…"
            />
          </div>
          <Segmented
            value={act}
            onChange={setAct}
            options={[
              { value: "all", label: "All" },
              { value: "block", label: "Block" },
              { value: "warn", label: "Warn" },
              { value: "watermark", label: "Watermark" },
              { value: "quarantine", label: "Quarantine" },
              { value: "notify", label: "Notify" },
            ]}
          />
        </div>

        {isPending ? (
          <div className="flex items-center justify-center py-12 text-muted">
            <Spinner /> <span className="ml-2 text-[13px]">Loading…</span>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Shield}
            title={policies.length === 0 ? "No DLP policies yet" : "No policies match this filter"}
            body={
              policies.length === 0
                ? "Add a policy below to describe what to block, warn, watermark, quarantine, or notify on."
                : "Try a different search or action filter."
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((p) => {
              const meta = ACTION_META[p.action];
              const Icon = meta.icon;
              return (
                <div key={p.id} className="flex items-center gap-3 rounded-md border border-border p-3">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: meta.bg, color: meta.fg }}
                  >
                    <Icon size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold">{p.name}</div>
                    <div className="truncate text-[11px] text-muted">
                      {p.pattern !== "" && <span className="font-mono">{p.pattern}</span>}
                      {p.pattern !== "" && p.surface !== "" && " · "}
                      {p.surface}
                      {p.note !== "" && <span style={{ color: "#f59e0b" }}> · {p.note}</span>}
                    </div>
                  </div>
                  <span className="k-chip whitespace-nowrap" style={{ background: meta.bg, color: meta.fg, fontSize: 10 }}>
                    {meta.label.toUpperCase()}
                  </span>
                  <Toggle on={p.enabled} {...(canManage ? { onChange: () => toggle(p) } : {})} />
                  {canManage && (
                    <button
                      className="k-btn k-btn-plain k-btn-icon"
                      aria-label={`Delete ${p.name}`}
                      onClick={() => setToDelete(p)}
                      style={{ color: "var(--danger-600)" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SettingsCard>

      <SettingsCard title="New policy">
        <div className="rounded-md p-3.5" style={{ background: "var(--bg-subtle)" }}>
          <div className="mb-2.5">
            <input
              className="k-input"
              value={builder.name}
              placeholder="Policy name — e.g. Block uploads containing Aadhaar / SSN"
              onChange={(e) => setB("name", e.target.value)}
              style={{ borderColor: err !== "" && builder.name.trim() === "" ? "var(--danger-500)" : undefined }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="font-semibold">DETECT</span>
            <input
              className="k-input"
              style={{ width: 220, height: 30 }}
              value={builder.pattern}
              placeholder="PII patterns / regex / label"
              onChange={(e) => setB("pattern", e.target.value)}
            />
            <span className="font-semibold">ON</span>
            <input
              className="k-input"
              style={{ width: 180, height: 30 }}
              value={builder.surface}
              placeholder="Email, download…"
              onChange={(e) => setB("surface", e.target.value)}
            />
            <span className="font-semibold">THEN</span>
            <select
              className="k-input"
              style={{ width: "auto", height: 30 }}
              value={builder.action}
              onChange={(e) => setB("action", e.target.value as DlpAction)}
            >
              {ACTIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-2.5">
            <input
              className="k-input"
              style={{ height: 30 }}
              value={builder.note}
              placeholder="Optional note — e.g. iOS only; Android coverage 80%"
              onChange={(e) => setB("note", e.target.value)}
            />
          </div>
          {err !== "" && (
            <div className="mt-2.5 flex items-center gap-1.5 text-[12px]" style={{ color: "#b91c1c" }}>
              {err}
            </div>
          )}
          <div className="mt-2 text-[11.5px] text-muted">
            Note: policies are stored and listed but <strong>not yet enforced</strong> at runtime.
          </div>
        </div>
        <div className="mt-3.5 flex">
          <button className="k-btn k-btn-primary ml-auto" onClick={save} disabled={!canManage || create.isPending}>
            {create.isPending ? "Saving…" : "Save policy"}
          </button>
        </div>
      </SettingsCard>

      <Dialog open={toDelete !== null} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent
          title="Remove DLP policy?"
          description={`"${toDelete?.name ?? ""}" will be removed from the register.`}
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
              Remove policy
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </SettingsPage>
  );
}
