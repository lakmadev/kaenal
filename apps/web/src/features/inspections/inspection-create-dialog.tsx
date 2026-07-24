"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, DialogContent, Field, Input, useToast } from "@/components/ui";
import { useCreateInspection, usePublishedTemplates } from "@/hooks/use-inspections";
import { errorMessage } from "@/lib/api-error";

/**
 * Schedule an inspection from a published template (04 §5). A template must be
 * published first (its schema is then immutable) — the template editor is a later
 * slice, so if none are published we say so rather than offer an empty picker.
 */
export function InspectionCreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.ReactElement {
  const router = useRouter();
  const toast = useToast();
  const templates = usePublishedTemplates();
  const create = useCreateInspection();

  const [title, setTitle] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [error, setError] = useState("");

  const options = templates.data?.items ?? [];

  const submit = (): void => {
    if (title.trim() === "" || templateId === "") {
      setError("Title and template are required.");
      return;
    }
    setError("");
    create.mutate(
      {
        title: title.trim(),
        templateId,
        ...(scheduledAt !== "" ? { scheduledAt: new Date(scheduledAt).toISOString() } : {}),
      },
      {
        onSuccess: (insp) => {
          toast.success(`Inspection ${insp.code} scheduled`);
          setTitle("");
          setTemplateId("");
          setScheduledAt("");
          onOpenChange(false);
          router.push(`/inspections/${insp.id}`);
        },
        onError: (err) => setError(errorMessage(err)),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Schedule an inspection" description="Create an inspection from a published template.">
        {templates.isLoading ? (
          <p className="text-[13px] text-muted">Loading templates…</p>
        ) : options.length === 0 ? (
          <p className="text-[13px] text-muted">
            No published templates yet. A template must be created and published before an inspection can be scheduled
            (the template editor is a later slice).
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <Field label="Title" required>
              {(a) => <Input {...a} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Line 3 monthly safety walk" autoFocus />}
            </Field>
            <Field label="Template" required>
              {(a) => (
                <select {...a} className="k-input" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                  <option value="">Choose a template…</option>
                  {options.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} (v{t.version})
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Scheduled for" hint="Optional — leave blank to schedule immediately.">
              {(a) => <input {...a} type="datetime-local" className="k-input" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />}
            </Field>

            {error !== "" && (
              <div className="rounded-md px-3 py-2 text-[12.5px]" style={{ background: "var(--danger-50)", color: "var(--danger-700)" }}>
                {error}
              </div>
            )}

            <div className="mt-1 flex justify-end gap-2">
              <Button type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="button" variant="primary" loading={create.isPending} onClick={submit}>
                Schedule
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
