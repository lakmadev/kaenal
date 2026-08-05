"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { RiskLevel, SupplierStatus } from "@kaenal/types";
import { Button, Dialog, DialogContent, Field, Input, useToast } from "@/components/ui";
import { useCreateSupplier } from "@/hooks/use-suppliers";
import { errorMessage } from "@/lib/api-error";

/** Manual supplier onboarding — code is auto-generated (SUP-YYYY-NNNN) unless an
 *  import supplies one, so the form captures only the identifying fields. */
const FormSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  category: z.string().max(120).optional(),
  country: z.string().max(120).optional(),
  city: z.string().max(120).optional(),
  tier: z.coerce.number().int().min(1).max(5).optional(),
  status: SupplierStatus,
  riskTier: RiskLevel,
});
type FormValues = z.infer<typeof FormSchema>;

export function SupplierCreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.ReactElement {
  const router = useRouter();
  const toast = useToast();
  const createSupplier = useCreateSupplier();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { status: "active", riskTier: "medium" },
  });

  const onSubmit = handleSubmit((values) => {
    return new Promise<void>((resolve) => {
      createSupplier.mutate(
        {
          name: values.name,
          category: values.category ?? null,
          country: values.country ?? null,
          city: values.city ?? null,
          tier: values.tier ?? null,
          status: values.status,
          riskTier: values.riskTier,
        },
        {
          onSuccess: (supplier) => {
            toast.success(`Supplier ${supplier.code} added`);
            reset();
            onOpenChange(false);
            router.push(`/suppliers/${supplier.id}`);
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
      <DialogContent title="New supplier" description="Onboard a supplier. A code is assigned automatically.">
        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4" noValidate>
          <Field label="Name" error={errors.name?.message} required>
            {(a) => <Input {...a} {...register("name")} placeholder="Legal or trading name" autoFocus />}
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Category" error={errors.category?.message}>
              {(a) => <Input {...a} {...register("category")} placeholder="e.g. Forgings" />}
            </Field>
            <Field label="Tier" error={errors.tier?.message}>
              {(a) => (
                <select {...a} {...register("tier")} className="k-input">
                  <option value="">Unassigned</option>
                  <option value="1">Tier 1</option>
                  <option value="2">Tier 2</option>
                  <option value="3">Tier 3</option>
                </select>
              )}
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Country" error={errors.country?.message}>
              {(a) => <Input {...a} {...register("country")} placeholder="e.g. India" />}
            </Field>
            <Field label="City" error={errors.city?.message}>
              {(a) => <Input {...a} {...register("city")} placeholder="e.g. Pune" />}
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Status" error={errors.status?.message} required>
              {(a) => (
                <select {...a} {...register("status")} className="k-input">
                  <option value="active">Active</option>
                  <option value="probation">Probation</option>
                  <option value="suspended">Suspended</option>
                  <option value="inactive">Inactive</option>
                </select>
              )}
            </Field>
            <Field label="Risk tier" error={errors.riskTier?.message} required>
              {(a) => (
                <select {...a} {...register("riskTier")} className="k-input">
                  <option value="low">A · Preferred</option>
                  <option value="medium">B · Approved</option>
                  <option value="high">C · Conditional</option>
                  <option value="critical">D · Critical</option>
                </select>
              )}
            </Field>
          </div>

          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting || createSupplier.isPending}>
              Add supplier
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
