"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { NcrPriority } from "@kaenal/types";
import { Button, Dialog, DialogContent, Field, Input, useToast } from "@/components/ui";
import { useCreateNcr } from "@/hooks/use-ncrs";
import { errorMessage } from "@/lib/api-error";

/** Manual NCR creation (a raise-from-finding flow lives on the inspection). Only
 *  the fields a manual NCR needs; source defaults to `manual` server-side. */
const FormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  priority: NcrPriority,
  description: z.string().max(8000).optional(),
});
type FormValues = z.infer<typeof FormSchema>;

export function NcrCreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.ReactElement {
  const router = useRouter();
  const toast = useToast();
  const createNcr = useCreateNcr();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(FormSchema), defaultValues: { priority: "major" } });

  const onSubmit = handleSubmit((values) => {
    return new Promise<void>((resolve) => {
      createNcr.mutate(
        { title: values.title, priority: values.priority, description: values.description ?? null },
        {
          onSuccess: (ncr) => {
            toast.success(`NCR ${ncr.code} raised`);
            reset();
            onOpenChange(false);
            router.push(`/ncrs/${ncr.id}`);
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
      <DialogContent title="Raise an NCR" description="Record a non-conformity to track and resolve.">
        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4" noValidate>
          <Field label="Title" error={errors.title?.message} required>
            {(a) => <Input {...a} {...register("title")} placeholder="Short summary of the issue" autoFocus />}
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

          <Field label="Description">
            {(a) => (
              <textarea
                {...a}
                {...register("description")}
                className="k-input"
                rows={4}
                placeholder="What happened, where, and any immediate impact…"
                style={{ height: "auto", padding: 10, resize: "vertical" }}
              />
            )}
          </Field>

          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting || createNcr.isPending}>
              Raise NCR
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
