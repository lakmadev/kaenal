"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X } from "lucide-react";
import { AuditType } from "@kaenal/types";
import { Button, Dialog, DialogContent, Field, Input, Skeleton, useToast } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { useCreateAudit } from "@/hooks/use-audits";
import { usePlants } from "@/hooks/use-create-wizard";
import { useMembers } from "@/hooks/use-members";
import { errorMessage } from "@/lib/api-error";

/** `AUDIT_TYPES` labels (`audits.jsx:5-10`) — no shared constant exists yet
 *  (this is the first Audits web slice to need one); kept local rather than
 *  introducing a cross-module dependency other parallel slices don't need. */
const AUDIT_TYPE_LABELS: Record<AuditType, string> = {
  internal: "Internal",
  supplier: "Supplier",
  customer: "Customer",
  certification: "Certification",
  gap: "Gap Analysis",
};

const DateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .optional()
  .or(z.literal(""));

const FormSchema = z
  .object({
    title: z.string().min(1, "errorTitleRequired").max(200),
    type: AuditType,
    standard: z.string().max(200).optional().or(z.literal("")),
    plantId: z.string().uuid().optional().or(z.literal("")),
    location: z.string().max(200).optional().or(z.literal("")),
    description: z.string().max(4000).optional().or(z.literal("")),
    scope: z.array(z.string().min(1).max(200)).max(50),
    startAt: DateOnly,
    endAt: DateOnly,
    leadAuditorId: z.string().uuid().optional().or(z.literal("")),
    team: z.array(z.string().uuid()),
    auditeeIds: z.array(z.string().uuid()),
  })
  .refine((v) => v.startAt === "" || v.endAt === "" || v.startAt === undefined || v.endAt === undefined || v.endAt >= v.startAt, {
    message: "errorEndBeforeStart",
    path: ["endAt"],
  });
type FormValues = z.infer<typeof FormSchema>;

function toIso(dateOnly: string | undefined): string | null {
  if (dateOnly === undefined || dateOnly === "") return null;
  return new Date(`${dateOnly}T00:00:00.000Z`).toISOString();
}

/** A small "chips + add dropdown" multi-select over the members directory.
 *  Shared shape for `team` and `auditeeIds` — two independent selections over
 *  the same directory, no roles (unlike the wizard's `AssigneesStep`). */
function MemberMultiField({
  label,
  selected,
  onChange,
}: {
  label: string;
  selected: readonly string[];
  onChange: (ids: string[]) => void;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const { data, isLoading } = useMembers();
  const byId = useMemo(() => new Map((data?.items ?? []).map((m) => [m.userId, m])), [data]);

  const filtered = useMemo(() => {
    const all = data?.items ?? [];
    const query = q.trim().toLowerCase();
    return all.filter(
      (u) => !selected.includes(u.userId) && (query === "" || u.name.toLowerCase().includes(query) || u.role.toLowerCase().includes(query)),
    );
  }, [data, selected, q]);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-medium text-text">{label}</span>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((id) => {
            const m = byId.get(id);
            return (
              <span key={id} className="k-chip inline-flex items-center gap-1.5" style={{ background: "var(--bg-subtle)" }}>
                <Avatar name={m?.name} size={16} />
                {m?.name ?? `${id.slice(0, 8)}…`}
                <button
                  type="button"
                  aria-label={`Remove ${m?.name ?? id}`}
                  onClick={() => onChange(selected.filter((s) => s !== id))}
                  className="inline-flex"
                >
                  <X size={11} aria-hidden />
                </button>
              </span>
            );
          })}
        </div>
      )}
      <div ref={ref} style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="k-btn k-btn-ghost k-btn-sm"
          style={{ width: "100%", justifyContent: "flex-start" }}
        >
          <Plus size={13} aria-hidden /> Add
        </button>
        {open && (
          <div
            className="k-surface fade-in absolute z-[100] flex flex-col overflow-hidden"
            style={{ top: "calc(100% + 4px)", left: 0, right: 0, maxHeight: 220, boxShadow: "var(--shadow-lg)" }}
          >
            <div className="border-b border-border p-2">
              <input className="k-input" placeholder="Search people…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
            </div>
            <div className="overflow-y-auto p-1">
              {isLoading && <Skeleton className="m-1 h-9 rounded-sm" />}
              {!isLoading && filtered.length === 0 && <div className="p-3 text-center text-[12px] text-muted">No matches</div>}
              {filtered.map((u) => (
                <button
                  key={u.userId}
                  type="button"
                  onClick={() => {
                    onChange([...selected, u.userId]);
                    setQ("");
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-bg-subtle"
                >
                  <Avatar name={u.name} size={22} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium">{u.name}</div>
                    <div className="text-[11px] text-muted">{u.role}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Repeatable free-text list — the create form's "Scope" field (`audits.jsx`
 *  `audit.scope` array; no repeatable-list primitive exists yet in this app,
 *  so this is a small local pattern: type + Enter/button adds a chip). */
function ScopeListField({ items, onChange, addLabel }: { items: readonly string[]; onChange: (items: string[]) => void; addLabel: string }): React.ReactElement {
  const [draft, setDraft] = useState("");

  const add = (): void => {
    const v = draft.trim();
    if (v === "" || items.includes(v)) return;
    onChange([...items, v]);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-2">
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((s, i) => (
            <span key={`${s}-${i}`} className="k-chip inline-flex items-center gap-1.5" style={{ background: "var(--bg-subtle)" }}>
              {s}
              <button
                type="button"
                aria-label={`Remove ${s}`}
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                className="inline-flex"
              >
                <X size={11} aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={addLabel}
        />
        <Button type="button" onClick={add}>
          <Plus size={14} aria-hidden />
        </Button>
      </div>
    </div>
  );
}

/**
 * Schedule (create) an audit — Sprint 02 S2-3. No `WizardType`/`ENTITY_TYPES`
 * entry exists for `audit` (verified in `docs/design/DESIGN-02-audits.md` §2.1),
 * so this follows the CAPA precedent: a standalone dialog, not a wizard step.
 * Opened from `?new=1` on `/audits` (page shell + eventual list header button)
 * and the command-palette "Schedule audit" quick action (`config/quick-create.ts`).
 */
export function AuditCreateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }): React.ReactElement {
  const t = useTranslations("auditCreate");
  const router = useRouter();
  const toast = useToast();
  const createAudit = useCreateAudit();
  const plants = usePlants();
  const idempotencyKeyRef = useRef(crypto.randomUUID());

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { type: "internal", scope: [], team: [], auditeeIds: [] },
  });

  const errorText = (key: string | undefined): string | undefined => {
    if (key === undefined) return undefined;
    const known: Record<string, string> = {
      errorTitleRequired: t("errorTitleRequired"),
      errorEndBeforeStart: t("errorEndBeforeStart"),
    };
    return known[key] ?? key;
  };

  const onSubmit = handleSubmit((values) => {
    return new Promise<void>((resolve) => {
      createAudit.mutate(
        {
          body: {
            title: values.title,
            type: values.type,
            standard: values.standard === "" ? null : (values.standard ?? null),
            plantId: values.plantId === "" ? null : (values.plantId ?? null),
            location: values.location === "" ? null : (values.location ?? null),
            description: values.description === "" ? null : (values.description ?? null),
            scope: values.scope,
            startAt: toIso(values.startAt),
            endAt: toIso(values.endAt),
            leadAuditorId: values.leadAuditorId === "" ? null : (values.leadAuditorId ?? null),
            team: values.team,
            auditeeIds: values.auditeeIds,
          },
          idempotencyKey: idempotencyKeyRef.current,
        },
        {
          onSuccess: (audit) => {
            toast.success(`Audit ${audit.code} scheduled`);
            reset();
            idempotencyKeyRef.current = crypto.randomUUID();
            onOpenChange(false);
            router.push(`/audits/${audit.id}`);
            resolve();
          },
          onError: (err) => {
            toast.error(errorMessage(err));
            resolve();
          },
        },
      );
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t("title")} className="max-w-[640px] max-h-[85vh] overflow-y-auto">
        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4" noValidate>
          <Field label={t("fieldTitle")} error={errorText(errors.title?.message)} required>
            {(a) => <Input {...a} {...register("title")} placeholder="e.g. Q2 Internal Audit — Machining" autoFocus />}
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("fieldType")} required>
              {(a) => (
                <select {...a} {...register("type")} className="k-input">
                  {(Object.keys(AUDIT_TYPE_LABELS) as AuditType[]).map((k) => (
                    <option key={k} value={k}>
                      {AUDIT_TYPE_LABELS[k]}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field label={t("fieldStandard")}>{(a) => <Input {...a} {...register("standard")} placeholder="IATF 16949" />}</Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("fieldPlant")}>
              {(a) => (
                <select {...a} {...register("plantId")} className="k-input">
                  <option value="">—</option>
                  {(plants.data?.items ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field label={t("fieldLocation")}>{(a) => <Input {...a} {...register("location")} placeholder="Building 3, Line A" />}</Field>
          </div>

          <Field label={t("fieldDescription")}>
            {(a) => (
              <textarea
                {...a}
                {...register("description")}
                className="k-input"
                rows={3}
                placeholder="Objective, background, and any prior findings this follows up on…"
                style={{ height: "auto", padding: 10, resize: "vertical" }}
              />
            )}
          </Field>

          <Controller
            control={control}
            name="scope"
            render={({ field }) => <ScopeListField items={field.value} onChange={field.onChange} addLabel={t("addScopeItem")} />}
          />
          <span className="-mt-2 text-[11px] text-muted">{t("fieldScope")}</span>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("fieldStartDate")} error={errorText(errors.startAt?.message)}>
              {(a) => <Input {...a} type="date" {...register("startAt")} />}
            </Field>
            <Field label={t("fieldEndDate")} error={errorText(errors.endAt?.message)}>
              {(a) => <Input {...a} type="date" {...register("endAt")} />}
            </Field>
          </div>

          <Field label={t("fieldLeadAuditor")}>
            {(a) => (
              <Controller
                control={control}
                name="leadAuditorId"
                render={({ field }) => (
                  <MemberLeadSelect id={a.id} value={field.value ?? ""} onChange={field.onChange} label={t("fieldLeadAuditor")} />
                )}
              />
            )}
          </Field>

          <Controller
            control={control}
            name="team"
            render={({ field }) => <MemberMultiField label={t("fieldTeam")} selected={field.value} onChange={field.onChange} />}
          />

          <Controller
            control={control}
            name="auditeeIds"
            render={({ field }) => <MemberMultiField label={t("fieldAuditees")} selected={field.value} onChange={field.onChange} />}
          />

          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting || createAudit.isPending}>
              {isSubmitting || createAudit.isPending ? t("submitting") : t("submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Single-select lead-auditor picker — a native select over the members
 *  directory (no role, unlike `team`/`auditeeIds`: exactly one lead). */
function MemberLeadSelect({
  id,
  value,
  onChange,
  label,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  label: string;
}): React.ReactElement {
  const { data } = useMembers();
  return (
    <select id={id} className="k-input" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="">—</option>
      {(data?.items ?? []).map((m) => (
        <option key={m.userId} value={m.userId}>
          {m.name}
        </option>
      ))}
    </select>
  );
}
