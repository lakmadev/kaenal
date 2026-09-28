"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { RaiseCapaFromFindingBody, type CapaType, type NcrPriority } from "@kaenal/types";
import { Button, Field, Input } from "@/components/ui";

/**
 * Same inline mini-form shape as {@link FindingRaiseNcrForm}, differing only
 * by the required Type field (corrective/preventive) and the submit label —
 * one shared UX pattern for both raise-from-finding seams (S2-5).
 */
export function FindingRaiseCapaForm({
  defaultPriority,
  submitting,
  onSubmit,
  onCancel,
}: {
  defaultPriority: NcrPriority;
  submitting: boolean;
  onSubmit: (values: { type: CapaType; priority: NcrPriority; title?: string }) => void;
  onCancel: () => void;
}): React.ReactElement {
  const t = useTranslations("auditFindings");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ type: CapaType; priority: NcrPriority; title?: string }>({
    resolver: zodResolver(RaiseCapaFromFindingBody),
    defaultValues: { type: "corrective", priority: defaultPriority },
  });

  const submit = handleSubmit((values) => {
    const title = values.title?.trim();
    onSubmit({ type: values.type, priority: values.priority, ...(title !== undefined && title !== "" ? { title } : {}) });
  });

  return (
    <form
      onSubmit={(e) => void submit(e)}
      noValidate
      className="mt-2.5 flex flex-col gap-2.5 rounded-lg p-3"
      style={{ background: "var(--bg-subtle)" }}
    >
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <Field label={t("raiseTypeCapa")} error={errors.type?.message} required>
          {(a) => (
            <select {...a} {...register("type")} className="k-input">
              <option value="corrective">Corrective</option>
              <option value="preventive">Preventive</option>
            </select>
          )}
        </Field>
        <Field label={t("raisePriority")} error={errors.priority?.message} required>
          {(a) => (
            <select {...a} {...register("priority")} className="k-input">
              <option value="minor">Minor</option>
              <option value="major">Major</option>
              <option value="critical">Critical</option>
            </select>
          )}
        </Field>
        <Field label={t("raiseTitleOverride")} error={errors.title?.message}>
          {(a) => <Input {...a} {...register("title")} />}
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" onClick={onCancel}>
          {t("raiseCancel")}
        </Button>
        <Button type="submit" variant="primary" size="sm" loading={submitting}>
          {t("raiseCapa")}
        </Button>
      </div>
    </form>
  );
}
