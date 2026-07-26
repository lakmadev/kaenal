"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DocumentCategory } from "@kaenal/types";
import { Button, Dialog, DialogContent, Field, Input, useToast } from "@/components/ui";
import { useCreateDocument } from "@/hooks/use-documents";
import { errorMessage } from "@/lib/api-error";
import { CATEGORIES } from "./document-bits";

/** New controlled document — created as a draft at version 1.0. The file is
 *  attached separately (03 §7, not yet built), so only metadata here. */
const FormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  category: DocumentCategory,
  frameworks: z.string().max(400).optional(),
  expiresAt: z.string().optional(),
});
type FormValues = z.infer<typeof FormSchema>;

export function DocumentCreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.ReactElement {
  const router = useRouter();
  const toast = useToast();
  const createDoc = useCreateDocument();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(FormSchema), defaultValues: { category: "sop" } });

  const onSubmit = handleSubmit((values) => {
    const frameworks = (values.frameworks ?? "")
      .split(",")
      .map((f) => f.trim())
      .filter(Boolean);
    return new Promise<void>((resolve) => {
      createDoc.mutate(
        {
          title: values.title,
          category: values.category,
          ...(frameworks.length > 0 ? { frameworks } : {}),
          ...(values.expiresAt !== undefined && values.expiresAt !== ""
            ? { expiresAt: new Date(values.expiresAt).toISOString() }
            : {}),
        },
        {
          onSuccess: (doc) => {
            toast.success(`Document ${doc.code} created`);
            reset();
            onOpenChange(false);
            router.push(`/documents/${doc.id}`);
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
      <DialogContent title="New document" description="Create a controlled document. It starts as a draft at version 1.0.">
        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4" noValidate>
          <Field label="Title" error={errors.title?.message} required>
            {(a) => <Input {...a} {...register("title")} placeholder="e.g. CMM Calibration SOP" autoFocus />}
          </Field>

          <Field label="Category" error={errors.category?.message} required>
            {(a) => (
              <select {...a} {...register("category")} className="k-input">
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Frameworks" hint="Comma-separated">
              {(a) => <Input {...a} {...register("frameworks")} placeholder="IATF 16949, ISO 9001" />}
            </Field>
            <Field label="Expires">
              {(a) => <input {...a} {...register("expiresAt")} type="date" className="k-input" />}
            </Field>
          </div>

          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting || createDoc.isPending}>
              Create document
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
