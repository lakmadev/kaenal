"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Dialog, DialogContent, Field, Input, useToast } from "@/components/ui";
import { useCreateScar } from "@/hooks/use-scar";
import { useSuppliers } from "@/hooks/use-suppliers";
import { errorMessage } from "@/lib/api-error";

const DateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .optional()
  .or(z.literal(""));

/** Raise a SCAR against a supplier. The 8D starts at D1; the code is assigned
 *  server side. A chargeback amount, if given, is raised into `pending`. */
const FormSchema = z.object({
  supplierId: z.string().uuid("Choose a supplier"),
  title: z.string().min(1, "Describe the issue").max(200),
  severity: z.enum(["minor", "major", "critical"]),
  raisedDate: DateOnly,
  dueDate: DateOnly,
  supplierResponseDue: DateOnly,
  affectedLots: z.coerce.number().int().nonnegative().optional().or(z.nan()),
  chargebackAmount: z.coerce.number().nonnegative().optional().or(z.nan()),
});
type FormValues = z.infer<typeof FormSchema>;

export function ScarCreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.ReactElement {
  const router = useRouter();
  const toast = useToast();
  const createScar = useCreateScar();
  const suppliers = useSuppliers();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { severity: "major" },
  });

  const dateOrNull = (v: string | undefined): string | null => (v !== undefined && v !== "" ? v : null);
  const numOrNull = (v: number | undefined): number | null =>
    v !== undefined && !Number.isNaN(v) ? v : null;

  const onSubmit = handleSubmit((values) => {
    return new Promise<void>((resolve) => {
      createScar.mutate(
        {
          supplierId: values.supplierId,
          title: values.title,
          severity: values.severity,
          raisedDate: dateOrNull(values.raisedDate),
          dueDate: dateOrNull(values.dueDate),
          supplierResponseDue: dateOrNull(values.supplierResponseDue),
          affectedLots: numOrNull(values.affectedLots),
          chargebackAmount: numOrNull(values.chargebackAmount),
        },
        {
          onSuccess: (scar) => {
            toast.success(`SCAR ${scar.code} raised`);
            reset();
            onOpenChange(false);
            router.push(`/scars/${scar.id}`);
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
      <DialogContent title="Raise SCAR" description="Open an 8D-style corrective action request against a supplier.">
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

          <Field label="Issue" error={errors.title?.message} required>
            {(a) => <Input {...a} {...register("title")} placeholder="e.g. Porosity on BHS-12 housings (lot WK-1814)" autoFocus />}
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Severity" error={errors.severity?.message} required>
              {(a) => (
                <select {...a} {...register("severity")} className="k-input">
                  <option value="minor">Minor</option>
                  <option value="major">Major</option>
                  <option value="critical">Critical</option>
                </select>
              )}
            </Field>
            <Field label="Affected lots" error={errors.affectedLots?.message}>
              {(a) => <Input {...a} {...register("affectedLots")} type="number" min={0} placeholder="e.g. 3" />}
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Raised" error={errors.raisedDate?.message}>
              {(a) => <Input {...a} {...register("raisedDate")} placeholder="YYYY-MM-DD" />}
            </Field>
            <Field label="Response due" error={errors.supplierResponseDue?.message}>
              {(a) => <Input {...a} {...register("supplierResponseDue")} placeholder="YYYY-MM-DD" />}
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Overall due" error={errors.dueDate?.message}>
              {(a) => <Input {...a} {...register("dueDate")} placeholder="YYYY-MM-DD" />}
            </Field>
            <Field label="Chargeback amount" error={errors.chargebackAmount?.message}>
              {(a) => <Input {...a} {...register("chargebackAmount")} type="number" min={0} placeholder="e.g. 22400" />}
            </Field>
          </div>

          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting || createScar.isPending}>
              Raise SCAR
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
