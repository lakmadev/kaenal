"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DocumentCategory, type FileDto } from "@kaenal/types";
import { Button, Dialog, DialogContent, Field, Input, useToast } from "@/components/ui";
import { useCreateDocument } from "@/hooks/use-documents";
import { errorMessage } from "@/lib/api-error";
import { CATEGORIES } from "./document-bits";
import { FileDrop } from "./file-drop";

/** New controlled document — created as a draft at version 1.0. A file can be
 *  attached now (03 §7 upload flow) or added later as a new version. */
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
  fileFirst = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileFirst?: boolean;
}): React.ReactElement {
  const router = useRouter();
  const toast = useToast();
  const createDoc = useCreateDocument();
  const [file, setFile] = useState<FileDto | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(FormSchema), defaultValues: { category: "sop" } });

  const close = (): void => {
    reset();
    setFile(null);
    onOpenChange(false);
  };

  // Attaching a file prefills the title from its name when the title is empty —
  // the metadata step of the prototype's upload flow.
  const onFile = (f: FileDto | null): void => {
    setFile(f);
    if (f !== null && getValues("title").trim() === "") {
      setValue("title", f.filename.replace(/\.[^.]+$/, ""), { shouldValidate: true });
    }
  };

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
          ...(file !== null ? { fileId: file.id } : {}),
          ...(frameworks.length > 0 ? { frameworks } : {}),
          ...(values.expiresAt !== undefined && values.expiresAt !== ""
            ? { expiresAt: new Date(values.expiresAt).toISOString() }
            : {}),
        },
        {
          onSuccess: (doc) => {
            toast.success(`Document ${doc.code} created`);
            close();
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

  const fileField = (
    <Field label="File" hint="Optional — attach now or add a version later">
      {() => <FileDrop value={file} onChange={onFile} autoFocusPicker={fileFirst} />}
    </Field>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent
        title={fileFirst ? "Upload document" : "New document"}
        description="Create a controlled document. It starts as a draft at version 1.0."
      >
        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4" noValidate>
          {fileFirst && fileField}

          <Field label="Title" error={errors.title?.message} required>
            {(a) => <Input {...a} {...register("title")} placeholder="e.g. CMM Calibration SOP" autoFocus={!fileFirst} />}
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Frameworks" hint="Comma-separated">
              {(a) => <Input {...a} {...register("frameworks")} placeholder="IATF 16949, ISO 9001" />}
            </Field>
            <Field label="Expires">
              {(a) => <input {...a} {...register("expiresAt")} type="date" className="k-input" />}
            </Field>
          </div>

          {!fileFirst && fileField}

          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" onClick={close}>
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
