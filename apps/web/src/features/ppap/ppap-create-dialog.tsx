"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Dialog, DialogContent, Field, Input, useToast } from "@/components/ui";
import { useCreatePpap } from "@/hooks/use-ppap";
import { useSuppliers } from "@/hooks/use-suppliers";
import { errorMessage } from "@/lib/api-error";

const DateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .optional()
  .or(z.literal(""));

/** Request a new PPAP package from a supplier. The 18 elements are seeded server
 *  side, so the form captures only the submission's identifying fields. */
const FormSchema = z.object({
  supplierId: z.string().uuid("Choose a supplier"),
  partNumber: z.string().min(1, "Part number is required").max(120),
  level: z.coerce.number().int().min(1).max(5),
  programName: z.string().max(200).optional(),
  customer: z.string().max(200).optional(),
  submittedDate: DateOnly,
  dueDate: DateOnly,
});
type FormValues = z.infer<typeof FormSchema>;

export function PpapCreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.ReactElement {
  const router = useRouter();
  const toast = useToast();
  const createPpap = useCreatePpap();
  const suppliers = useSuppliers();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { level: 3 },
  });

  const onSubmit = handleSubmit((values) => {
    return new Promise<void>((resolve) => {
      createPpap.mutate(
        {
          supplierId: values.supplierId,
          partNumber: values.partNumber,
          level: values.level,
          programName: values.programName ?? null,
          customer: values.customer ?? null,
          submittedDate: values.submittedDate !== undefined && values.submittedDate !== "" ? values.submittedDate : null,
          dueDate: values.dueDate !== undefined && values.dueDate !== "" ? values.dueDate : null,
        },
        {
          onSuccess: (ppap) => {
            toast.success(`PPAP ${ppap.code ?? ""} opened`);
            reset();
            onOpenChange(false);
            router.push(`/ppap/${ppap.id}`);
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

  const supplierOptions = suppliers.data?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Request PPAP" description="Open an 18-element PPAP package for a supplier part.">
        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4" noValidate>
          <Field label="Supplier" error={errors.supplierId?.message} required>
            {(a) => (
              <select {...a} {...register("supplierId")} className="k-input" defaultValue="">
                <option value="" disabled>
                  {suppliers.isLoading ? "Loading suppliers…" : "Choose a supplier"}
                </option>
                {supplierOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.code !== "" ? ` (${s.code})` : ""}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Part number" error={errors.partNumber?.message} required>
              {(a) => <Input {...a} {...register("partNumber")} placeholder="e.g. R-44 ring" autoFocus />}
            </Field>
            <Field label="Level" error={errors.level?.message} required>
              {(a) => (
                <select {...a} {...register("level")} className="k-input">
                  {[1, 2, 3, 4, 5].map((l) => (
                    <option key={l} value={l}>
                      Level {l}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Program" error={errors.programName?.message}>
              {(a) => <Input {...a} {...register("programName")} placeholder="e.g. BMW B58 refresh" />}
            </Field>
            <Field label="Customer (OEM)" error={errors.customer?.message}>
              {(a) => <Input {...a} {...register("customer")} placeholder="e.g. BMW Group" />}
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Submitted" error={errors.submittedDate?.message}>
              {(a) => <Input {...a} {...register("submittedDate")} placeholder="YYYY-MM-DD" />}
            </Field>
            <Field label="Due" error={errors.dueDate?.message}>
              {(a) => <Input {...a} {...register("dueDate")} placeholder="YYYY-MM-DD" />}
            </Field>
          </div>

          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting || createPpap.isPending}>
              Request PPAP
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
