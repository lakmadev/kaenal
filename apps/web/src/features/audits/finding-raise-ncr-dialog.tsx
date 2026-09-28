"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { RaiseNcrFromFindingBody, type NcrPriority } from "@kaenal/types";
import { Button, Field, Input } from "@/components/ui";

/**
 * Small inline mini-form that expands under a finding card to raise an NCR
 * (S2-5). Not a modal dialog — matches this app's existing "expand in place"
 * convention for toggle-forms (e.g. inspection-detail.tsx's Record-finding
 * form). Priority is pre-filled from the finding's kind but stays changeable;
 * the title override is optional (the server defaults it from the finding's
 * description when omitted).
 */
export function FindingRaiseNcrForm({
  defaultPriority,
  submitting,
  onSubmit,
  onCancel,
}: {
  defaultPriority: NcrPriority;
  submitting: boolean;
  onSubmit: (values: { priority: NcrPriority; title?: string }) => void;
  onCancel: () => void;
}): React.ReactElement {
  const t = useTranslations("auditFindings");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ priority: NcrPriority; title?: string }>({
    resolver: zodResolver(RaiseNcrFromFindingBody),
    defaultValues: { priority: defaultPriority },
  });

  const submit = handleSubmit((values) => {
    const title = values.title?.trim();
    onSubmit({ priority: values.priority, ...(title !== undefined && title !== "" ? { title } : {}) });
  });

  return (
    <form
      onSubmit={(e) => void submit(e)}
      noValidate
      className="mt-2.5 flex flex-col gap-2.5 rounded-lg p-3"
      style={{ background: "var(--bg-subtle)" }}
    >
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
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
          {t("raiseSubmit")}
        </Button>
      </div>
    </form>
  );
}
