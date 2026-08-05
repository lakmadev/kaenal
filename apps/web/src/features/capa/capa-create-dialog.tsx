"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CapaType, NcrPriority } from "@kaenal/types";
import { Button, Dialog, DialogContent, Field, Input, useToast } from "@/components/ui";
import { useCreateCapa } from "@/hooks/use-capas";
import { errorMessage } from "@/lib/api-error";

/** Manual CAPA creation. A CAPA raised from an NCR/finding links its source on
 *  the server; here we capture only what a fresh corrective/preventive action
 *  needs — title, type, priority, and an optional description. */
const FormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  type: CapaType,
  priority: NcrPriority,
  description: z.string().max(8000).optional(),
});
type FormValues = z.infer<typeof FormSchema>;

export function CapaCreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.ReactElement {
  const router = useRouter();
  const toast = useToast();
  const createCapa = useCreateCapa();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { type: "corrective", priority: "major" },
  });

  const onSubmit = handleSubmit((values) => {
    return new Promise<void>((resolve) => {
      createCapa.mutate(
        {
          title: values.title,
          type: values.type,
          priority: values.priority,
          description: values.description ?? null,
        },
        {
          onSuccess: (capa) => {
            toast.success(`CAPA ${capa.code} opened`);
            reset();
            onOpenChange(false);
            router.push(`/capa/${capa.id}`);
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
      <DialogContent title="New CAPA" description="Open a corrective or preventive action.">
        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4" noValidate>
          <Field label="Title" error={errors.title?.message} required>
            {(a) => <Input {...a} {...register("title")} placeholder="What problem is this CAPA addressing?" autoFocus />}
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Type" error={errors.type?.message} required>
              {(a) => (
                <select {...a} {...register("type")} className="k-input">
                  <option value="corrective">Corrective</option>
                  <option value="preventive">Preventive</option>
                </select>
              )}
            </Field>

            <Field label="Priority" error={errors.priority?.message} required>
              {(a) => (
                <select {...a} {...register("priority")} className="k-input">
                  <option value="minor">Minor</option>
                  <option value="major">Major</option>
                  <option value="critical">Critical</option>
                </select>
              )}
            </Field>
          </div>

          <Field label="Description">
            {(a) => (
              <textarea
                {...a}
                {...register("description")}
                className="k-input"
                rows={4}
                placeholder="Problem statement, scope, and any immediate containment…"
                style={{ height: "auto", padding: 10, resize: "vertical" }}
              />
            )}
          </Field>

          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting || createCapa.isPending}>
              Open CAPA
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
