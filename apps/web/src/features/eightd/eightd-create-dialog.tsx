"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Dialog, DialogContent, Field, Input, useToast } from "@/components/ui";
import { useCreateEightD } from "@/hooks/use-eightd";
import { errorMessage } from "@/lib/api-error";

const DateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .optional()
  .or(z.literal(""));

/** Open an 8D. The eight disciplines are seeded server-side (all pending), so the
 *  form captures only the identifying fields; team/roles are set on the detail. */
const FormSchema = z.object({
  title: z.string().min(1, "A title is required").max(200),
  ncrId: z.string().uuid("Enter a valid NCR id").optional().or(z.literal("")),
  targetAt: DateOnly,
});
type FormValues = z.infer<typeof FormSchema>;

export function EightDCreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.ReactElement {
  const router = useRouter();
  const toast = useToast();
  const createEightD = useCreateEightD();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(FormSchema) });

  const onSubmit = handleSubmit((values) => {
    return new Promise<void>((resolve) => {
      createEightD.mutate(
        {
          title: values.title,
          ...(values.ncrId !== undefined && values.ncrId !== "" ? { ncrId: values.ncrId } : {}),
          ...(values.targetAt !== undefined && values.targetAt !== ""
            ? { targetAt: new Date(`${values.targetAt}T00:00:00Z`).toISOString() }
            : {}),
        },
        {
          onSuccess: (report) => {
            toast.success(`8D ${report.code} opened`);
            reset();
            onOpenChange(false);
            router.push(`/8d/${report.id}`);
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
      <DialogContent title="Open 8D" description="Start a guided D1–D8 problem-solving report.">
        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4" noValidate>
          <Field label="Title" error={errors.title?.message} required>
            {(a) => <Input {...a} {...register("title")} placeholder="e.g. Porosity in bracket weld — lot ACM-2402" autoFocus />}
          </Field>
          <Field label="Linked NCR (optional)" error={errors.ncrId?.message} hint="Raising from an NCR blocks that NCR from closing until the 8D is done.">
            {(a) => <Input {...a} {...register("ncrId")} placeholder="NCR uuid" />}
          </Field>
          <Field label="Target date (optional)" error={errors.targetAt?.message}>
            {(a) => <Input {...a} {...register("targetAt")} placeholder="YYYY-MM-DD" />}
          </Field>
          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting || createEightD.isPending}>
              Open 8D
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
