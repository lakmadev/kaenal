"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { CircleCheck, Plus, TriangleAlert, X } from "lucide-react";
import { CreateAuditFindingBody, type AuditFindingDto, type AuditFindingKind, type NcrPriority } from "@kaenal/types";
import { Button, Chip, Field, Input, Skeleton, EmptyState, useToast } from "@/components/ui";
import { shortDate } from "@/lib/format";
import { errorMessage } from "@/lib/api-error";
import { entityHref, entityIcon } from "@/lib/entity-routes";
import { useCan } from "@/hooks/use-me";
import {
  useAuditFindings,
  useCreateAuditFinding,
  useRaiseNcrFromAuditFinding,
  useRaiseCapaFromAuditFinding,
} from "@/hooks/use-audits";
import { FindingRaiseNcrForm } from "./finding-raise-ncr-dialog";
import { FindingRaiseCapaForm } from "./finding-raise-capa-dialog";
import { DEFAULT_PRIORITY } from "./audit-priority-logic";

const KIND_LABEL: Record<AuditFindingKind, string> = {
  major_nc: "Major NC",
  minor_nc: "Minor NC",
  opportunity: "Opportunity",
};

const KIND_COLOR: Record<AuditFindingKind, { bg: string; fg: string; bar: string }> = {
  major_nc: { bg: "rgba(220,38,38,0.12)", fg: "#b91c1c", bar: "var(--danger-600)" },
  minor_nc: { bg: "rgba(234,88,12,0.14)", fg: "#c2410c", bar: "var(--risk-high)" },
  opportunity: { bg: "rgba(99,102,241,0.12)", fg: "#4338ca", bar: "var(--risk-info)" },
};

/**
 * Findings tab (S2-5) — `audits.jsx` `AuditFindingsTab` (494-527) reproduced
 * with real data, plus the manual "Add finding" form and the Raise NCR/CAPA
 * mini-forms the jsx doesn't draw (DESIGN-02-audits.md §2 items 3-4).
 */
export function AuditFindingsTab({ auditId }: { auditId: string }): React.ReactElement {
  const t = useTranslations("auditFindings");
  const findings = useAuditFindings(auditId);
  const canManage = useCan("audit:manage");
  const [adding, setAdding] = useState(false);

  const items = findings.data?.items ?? [];

  return (
    <div className="flex flex-col gap-3">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setAdding((v) => !v)}>
            {adding ? (
              <>
                <X size={12} /> {t("raiseCancel")}
              </>
            ) : (
              <>
                <Plus size={12} /> {t("addFinding")}
              </>
            )}
          </Button>
        </div>
      )}

      {adding && (
        <AddFindingForm auditId={auditId} onDone={() => setAdding(false)} />
      )}

      {findings.isLoading ? (
        <Skeleton className="h-24 rounded-xl" />
      ) : findings.isError ? (
        <div className="k-surface">
          <EmptyState icon={TriangleAlert} title="Couldn't load findings" body="Something went wrong loading this audit's findings." />
        </div>
      ) : items.length === 0 ? (
        <div className="k-surface">
          <EmptyState icon={CircleCheck} title={t("emptyTitle")} body={t("emptyBody")} />
        </div>
      ) : (
        items.map((f) => <FindingCard key={f.id} auditId={auditId} finding={f} canManage={canManage} />)
      )}
    </div>
  );
}

/** Fields validated through `CreateAuditFindingBody` (minus `dueDate`, which
 *  the HTML date input carries as a plain `YYYY-MM-DD` string and this form
 *  converts to an ISO datetime at submit — the same client-side conversion
 *  `ncr-actions.tsx` uses, kept outside the DTO's own datetime validation). */
const AddFindingFormSchema = CreateAuditFindingBody.omit({ dueDate: true });

function AddFindingForm({ auditId, onDone }: { auditId: string; onDone: () => void }): React.ReactElement {
  const t = useTranslations("auditFindings");
  const toast = useToast();
  const createFinding = useCreateAuditFinding(auditId);
  const [dueDate, setDueDate] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<{ kind: AuditFindingKind; clause?: string | null; title?: string | null; description: string }>({
    resolver: zodResolver(AddFindingFormSchema),
    defaultValues: { kind: "minor_nc" },
  });

  const submit = handleSubmit((values) => {
    const clause = values.clause?.trim();
    const title = values.title?.trim();
    createFinding.mutate(
      {
        kind: values.kind,
        description: values.description.trim(),
        ...(clause !== undefined && clause !== "" ? { clause } : {}),
        ...(title !== undefined && title !== "" ? { title } : {}),
        ...(dueDate !== "" ? { dueDate: new Date(dueDate).toISOString() } : {}),
      },
      {
        onSuccess: () => {
          toast.success(t("recordFinding"));
          reset();
          setDueDate("");
          onDone();
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  });

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="k-surface flex flex-col gap-2.5 p-4">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <Field label={t("fieldClause")} error={errors.clause?.message}>
          {(a) => <Input {...a} {...register("clause")} placeholder="e.g. 8.5.1" />}
        </Field>
        <Field label={t("fieldKind")} error={errors.kind?.message} required>
          {(a) => (
            <select {...a} {...register("kind")} className="k-input">
              <option value="major_nc">Major NC</option>
              <option value="minor_nc">Minor NC</option>
              <option value="opportunity">Opportunity</option>
            </select>
          )}
        </Field>
        <Field label={t("fieldDueDate")}>
          {(a) => <input {...a} type="date" className="k-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />}
        </Field>
      </div>
      <Field label={t("fieldDescription")} error={errors.description?.message} required>
        {(a) => (
          <textarea
            {...a}
            {...register("description")}
            className="k-input"
            rows={2}
            style={{ height: "auto", padding: 10, resize: "vertical" }}
            placeholder="What was observed?"
          />
        )}
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" onClick={onDone}>
          {t("raiseCancel")}
        </Button>
        <Button type="submit" variant="primary" size="sm" loading={isSubmitting || createFinding.isPending}>
          {t("recordFinding")}
        </Button>
      </div>
    </form>
  );
}

function FindingCard({
  auditId,
  finding,
  canManage,
}: {
  auditId: string;
  finding: AuditFindingDto;
  canManage: boolean;
}): React.ReactElement {
  const t = useTranslations("auditFindings");
  const router = useRouter();
  const toast = useToast();
  const raiseNcr = useRaiseNcrFromAuditFinding(auditId);
  const raiseCapa = useRaiseCapaFromAuditFinding(auditId);
  const [raising, setRaising] = useState<"ncr" | "capa" | null>(null);

  const colors = KIND_COLOR[finding.kind];
  const NcrIcon = entityIcon("ncr");
  const CapaIcon = entityIcon("capa");

  const submitNcr = (values: { priority: NcrPriority; title?: string }): void =>
    raiseNcr.mutate(
      { findingId: finding.id, body: values },
      {
        onSuccess: (ncr) => {
          toast.success(`NCR ${ncr.code} raised`);
          setRaising(null);
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  const submitCapa = (values: { type: "corrective" | "preventive"; priority: NcrPriority; title?: string }): void =>
    raiseCapa.mutate(
      { findingId: finding.id, body: values },
      {
        onSuccess: (capa) => {
          toast.success(`CAPA ${capa.code} opened`);
          setRaising(null);
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  return (
    <div className="k-surface flex gap-3 p-4">
      <div style={{ width: 4, alignSelf: "stretch", borderRadius: 2, background: colors.bar }} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          {finding.clause !== null && (
            <span className="mono text-[11px] text-muted">§{finding.clause}</span>
          )}
          <Chip bg={colors.bg} fg={colors.fg} style={{ textTransform: "uppercase", fontSize: 10, letterSpacing: "0.06em" }}>
            {KIND_LABEL[finding.kind]}
          </Chip>
          {finding.dueDate !== null && (
            <span className="text-[11px] text-muted">· Due {shortDate(finding.dueDate)}</span>
          )}
        </div>
        {finding.title !== null && <div className="mb-1 text-[14px] font-semibold">{finding.title}</div>}
        <div className="mb-2.5 text-[12.5px] leading-relaxed text-muted">{finding.description}</div>

        <div className="flex flex-wrap items-center gap-4 text-[11.5px]">
          {finding.capaId !== null ? (
            <LinkChip icon={CapaIcon} label={t("linkedCapa")} href={entityHref("capa", finding.capaId)} onClick={(href) => router.push(href)} />
          ) : canManage ? (
            <Button size="sm" onClick={() => setRaising(raising === "capa" ? null : "capa")}>
              {t("raiseCapa")}
            </Button>
          ) : null}

          {finding.ncrId !== null ? (
            <LinkChip icon={NcrIcon} label={t("linkedNcr")} href={entityHref("ncr", finding.ncrId)} onClick={(href) => router.push(href)} />
          ) : canManage ? (
            <Button size="sm" onClick={() => setRaising(raising === "ncr" ? null : "ncr")}>
              {t("raiseNcr")}
            </Button>
          ) : null}
        </div>

        {raising === "ncr" && (
          <FindingRaiseNcrForm
            defaultPriority={DEFAULT_PRIORITY[finding.kind]}
            submitting={raiseNcr.isPending}
            onSubmit={submitNcr}
            onCancel={() => setRaising(null)}
          />
        )}
        {raising === "capa" && (
          <FindingRaiseCapaForm
            defaultPriority={DEFAULT_PRIORITY[finding.kind]}
            submitting={raiseCapa.isPending}
            onSubmit={submitCapa}
            onCancel={() => setRaising(null)}
          />
        )}
      </div>
    </div>
  );
}

function LinkChip({
  icon: Icon,
  label,
  href,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  href: string | null;
  onClick: (href: string) => void;
}): React.ReactElement {
  if (href === null) return <span className="text-muted">{label}</span>;
  return (
    <button type="button" onClick={() => onClick(href)} className="inline-flex items-center gap-1 text-[11.5px] hover:underline" style={{ color: "var(--accent)" }}>
      <Icon size={11} /> <strong className="text-text">{label}:</strong> {href.split("/").pop()?.slice(0, 8)}
    </button>
  );
}
