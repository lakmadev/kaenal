"use client";

import { useState } from "react";
import { Plus, Search, Shield, Trash2 } from "lucide-react";
import type {
  CreateNcrValidationRuleBody,
  NcrRuleAction,
  NcrRuleField,
  NcrRuleOperator,
  NcrValidationRuleDto,
} from "@kaenal/types";
import { useCan } from "@/hooks/use-me";
import { useNcrRules, useCreateNcrRule, useDeleteNcrRule, useUpdateNcrRule } from "@/hooks/use-ncr-rules";
import { Dialog, DialogClose, DialogContent, EmptyState, Segmented, Spinner, useToast } from "@/components/ui";
import { SettingsPage, SettingsCard, Toggle } from "../settings-bits";

const FIELDS: NcrRuleField[] = ["priority", "source", "title", "description", "plant", "area"];
const OPERATORS: { value: NcrRuleOperator; label: string }[] = [
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
  { value: "equals", label: "equals" },
  { value: "in", label: "in (any of)" },
];
const ACTIONS: { value: NcrRuleAction; label: string }[] = [
  { value: "block", label: "Block create" },
  { value: "warn", label: "Warn" },
  { value: "escalate", label: "Escalate" },
];

const ACTION_CHIP: Record<NcrRuleAction, { bg: string; fg: string; label: string }> = {
  block: { bg: "rgba(220,38,38,0.10)", fg: "#b91c1c", label: "Block" },
  warn: { bg: "rgba(245,158,11,0.12)", fg: "#92400e", label: "Warn" },
  escalate: { bg: "rgba(124,58,237,0.10)", fg: "#7c3aed", label: "Escalate" },
};

/** Human-readable condition, e.g. "priority in (critical, major)". */
function describe(rule: Pick<NcrValidationRuleDto, "field" | "operator" | "value">): string {
  switch (rule.operator) {
    case "is_empty":
      return `${rule.field} is empty`;
    case "is_not_empty":
      return `${rule.field} is not empty`;
    case "equals":
      return `${rule.field} = ${rule.value}`;
    case "in":
      return `${rule.field} in (${rule.value})`;
  }
}

const needsValue = (op: NcrRuleOperator): boolean => op === "equals" || op === "in";

interface Builder {
  name: string;
  field: NcrRuleField;
  operator: NcrRuleOperator;
  value: string;
  action: NcrRuleAction;
  message: string;
}

const EMPTY_BUILDER: Builder = {
  name: "",
  field: "priority",
  operator: "equals",
  value: "",
  action: "block",
  message: "",
};

/**
 * NCR validation rules (settings.jsx → operations.jsx `ValidationRules`). Rules
 * are enforced on NCR create by the API; here an admin lists/searches them, flips
 * them on/off, deletes them, and builds new ones. Faithful to the design's list +
 * rule-builder; the design's "recent validation events" table needs a
 * validation-event log that doesn't exist yet (flagged in TODO) so it is omitted
 * rather than faked. Only `block` rules are enforced at runtime today.
 */
export function ValidationRulesSection(): React.ReactElement {
  const toast = useToast();
  const canManage = useCan("settings:manage");
  const { data, isPending } = useNcrRules();
  const create = useCreateNcrRule();
  const update = useUpdateNcrRule();
  const del = useDeleteNcrRule();

  const [q, setQ] = useState("");
  const [act, setAct] = useState<"all" | NcrRuleAction>("all");
  const [builder, setBuilder] = useState<Builder>(EMPTY_BUILDER);
  const [err, setErr] = useState("");
  const [toDelete, setToDelete] = useState<NcrValidationRuleDto | null>(null);

  const rules = data?.items ?? [];
  const filtered = rules.filter(
    (r) =>
      (act === "all" || r.action === act) &&
      (q.trim() === "" || `${r.name} ${describe(r)} ${r.message}`.toLowerCase().includes(q.toLowerCase())),
  );

  const setB = <K extends keyof Builder>(k: K, v: Builder[K]): void => setBuilder((s) => ({ ...s, [k]: v }));

  const save = (): void => {
    if (builder.name.trim() === "") return setErr("Give the rule a name.");
    if (needsValue(builder.operator) && builder.value.trim() === "")
      return setErr("Enter a value for the 'equals' / 'in' condition.");
    if (builder.message.trim() === "") return setErr("Enter a message to show when the rule fires.");
    setErr("");
    const body: CreateNcrValidationRuleBody = {
      name: builder.name.trim(),
      field: builder.field,
      operator: builder.operator,
      value: needsValue(builder.operator) ? builder.value.trim() : "",
      action: builder.action,
      message: builder.message.trim(),
      enabled: true,
    };
    create.mutate(body, {
      onSuccess: () => {
        toast.success("Validation rule added");
        setBuilder(EMPTY_BUILDER);
      },
      onError: () => toast.error("Couldn't add the rule"),
    });
  };

  const toggle = (rule: NcrValidationRuleDto): void => {
    update.mutate(
      {
        id: rule.id,
        body: {
          name: rule.name,
          field: rule.field,
          operator: rule.operator,
          value: rule.value,
          action: rule.action,
          message: rule.message,
          enabled: !rule.enabled,
          version: rule.lockVersion,
        },
      },
      { onError: () => toast.error("Couldn't update the rule") },
    );
  };

  const confirmDelete = (): void => {
    if (toDelete === null) return;
    del.mutate(toDelete.id, {
      onSuccess: () => toast.success("Rule removed"),
      onError: () => toast.error("Couldn't remove the rule"),
    });
    setToDelete(null);
  };

  return (
    <SettingsPage
      title="Validation rules"
      subtitle="Required fields and business rules enforced when an NCR is created"
      actions={
        <button className="k-btn k-btn-primary" onClick={() => setBuilder(EMPTY_BUILDER)} disabled={!canManage}>
          <Plus size={14} /> New rule
        </button>
      }
    >
      <SettingsCard title="NCR validation rules" desc="Enforced on NCR create. Only 'block' rules reject a create today.">
        <div className="mb-3 flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1 sm:max-w-[320px]">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-2.5 text-muted" />
            <input
              className="k-input"
              style={{ paddingLeft: 30, height: 32 }}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search rules…"
            />
          </div>
          <Segmented
            value={act}
            onChange={setAct}
            options={[
              { value: "all", label: "All" },
              { value: "block", label: "Block" },
              { value: "warn", label: "Warn" },
              { value: "escalate", label: "Escalate" },
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
            title={rules.length === 0 ? "No validation rules yet" : "No rules match this filter"}
            body={
              rules.length === 0
                ? "Add a rule below to require fields or block NCRs that don't meet your criteria."
                : "Try a different search or action filter."
            }
          />
        ) : (
          <div className="flex flex-col gap-1.5">
            {filtered.map((r) => {
              const chip = ACTION_CHIP[r.action];
              return (
                <div key={r.id} className="flex items-center gap-2.5 rounded-md border border-border p-2.5">
                  <Shield size={14} style={{ color: "var(--accent)" }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold">{r.name}</div>
                    <div className="text-[11.5px] text-muted">
                      <span className="k-chip mr-1" style={{ background: "var(--bg-subtle)", fontSize: 10 }}>
                        On create
                      </span>
                      <span className="font-mono">{describe(r)}</span>
                    </div>
                  </div>
                  <span className="k-chip whitespace-nowrap" style={{ background: chip.bg, color: chip.fg }}>
                    {chip.label}
                  </span>
                  <Toggle on={r.enabled} {...(canManage ? { onChange: () => toggle(r) } : {})} />
                  {canManage && (
                    <button
                      className="k-btn k-btn-plain k-btn-icon"
                      aria-label={`Delete ${r.name}`}
                      onClick={() => setToDelete(r)}
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

      <SettingsCard title="Rule builder">
        <div className="rounded-md p-3.5" style={{ background: "var(--bg-subtle)" }}>
          <div className="mb-2.5">
            <input
              className="k-input"
              value={builder.name}
              placeholder="Rule name — e.g. Critical NCRs must name a plant"
              onChange={(e) => setB("name", e.target.value)}
              style={{ borderColor: err !== "" && builder.name.trim() === "" ? "var(--danger-500)" : undefined }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="font-semibold">WHEN</span>
            <span className="k-input flex items-center" style={{ width: "auto", height: 30, color: "var(--text-muted)" }}>
              On create
            </span>
            <span className="font-semibold">FOR</span>
            <span className="k-input flex items-center" style={{ width: "auto", height: 30, color: "var(--text-muted)" }}>
              NCR
            </span>
            <span className="font-semibold">IF</span>
            <select className="k-input" style={{ width: "auto", height: 30 }} value={builder.field} onChange={(e) => setB("field", e.target.value as NcrRuleField)}>
              {FIELDS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <select className="k-input" style={{ width: "auto", height: 30 }} value={builder.operator} onChange={(e) => setB("operator", e.target.value as NcrRuleOperator)}>
              {OPERATORS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {needsValue(builder.operator) && (
              <input
                className="k-input"
                style={{ width: 150, height: 30, borderColor: err !== "" && builder.value.trim() === "" ? "var(--danger-500)" : undefined }}
                value={builder.value}
                placeholder={builder.operator === "in" ? "critical, major" : "critical"}
                onChange={(e) => setB("value", e.target.value)}
              />
            )}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[13px]">
            <span className="font-semibold">THEN</span>
            <select className="k-input" style={{ width: "auto", height: 30 }} value={builder.action} onChange={(e) => setB("action", e.target.value as NcrRuleAction)}>
              {ACTIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
            <span>with message</span>
            <input
              className="k-input flex-1"
              style={{ height: 30, minWidth: 200, borderColor: err !== "" && builder.message.trim() === "" ? "var(--danger-500)" : undefined }}
              value={builder.message}
              placeholder="Critical NCRs must name the plant where the defect occurred"
              onChange={(e) => setB("message", e.target.value)}
            />
          </div>
          {err !== "" && (
            <div className="mt-2.5 flex items-center gap-1.5 text-[12px]" style={{ color: "#b91c1c" }}>
              {err}
            </div>
          )}
          {builder.action !== "block" && (
            <div className="mt-2 text-[11.5px] text-muted">
              Note: only <strong>Block</strong> rules are enforced at runtime today; Warn/Escalate are stored for later.
            </div>
          )}
        </div>
        <div className="mt-3.5 flex">
          <button className="k-btn k-btn-primary ml-auto" onClick={save} disabled={!canManage || create.isPending}>
            {create.isPending ? "Saving…" : "Save rule"}
          </button>
        </div>
      </SettingsCard>

      {/* Controlled dialog: DialogContent stays mounted (Radix only renders its
          portal while `open`), so closing it never unmounts mid-transition. */}
      <Dialog open={toDelete !== null} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent
          title="Remove validation rule?"
          description={`"${toDelete?.name ?? ""}" will no longer be enforced on NCR create.`}
        >
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <button className="k-btn k-btn-secondary">Cancel</button>
            </DialogClose>
            <button className="k-btn k-btn-primary" style={{ background: "var(--danger-600)" }} onClick={confirmDelete} disabled={del.isPending}>
              Remove rule
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </SettingsPage>
  );
}
