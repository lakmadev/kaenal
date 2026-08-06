"use client";

import { useRef, useState } from "react";
import { Paperclip, Loader2, X, FileText } from "lucide-react";
import type { FileDto } from "@kaenal/types";
import { useToast } from "@/components/ui";
import { uploadPortalEvidence } from "@/hooks/use-portal";
import { TEAL, TEAL_DARK, TEAL_SOFT } from "./portal-bits";

function prettyBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The "Attach evidence" control from `supplier-portal.jsx` (the paperclip on the
 * 8D response). Runs the partner-scoped presign → PUT → complete pipeline, then
 * holds the completed (scan-pending) files as removable chips. The parent owns
 * the list and passes the ids as `fileIds` when the response is submitted; on a
 * successful submit it calls `onChange([])` to clear. Teal, to match the portal.
 */
export function PortalEvidenceAttach({
  files,
  onChange,
  disabled = false,
}: {
  files: FileDto[];
  onChange: (files: FileDto[]) => void;
  disabled?: boolean;
}): React.ReactElement {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handle = (picked: FileList | null): void => {
    const list = picked === null ? [] : Array.from(picked);
    if (list.length === 0) return;
    setBusy(true);
    Promise.all(list.map((f) => uploadPortalEvidence(f)))
      .then((uploaded) => onChange([...files, ...uploaded]))
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Upload failed"))
      .finally(() => {
        setBusy(false);
        if (inputRef.current !== null) inputRef.current.value = "";
      });
  };

  return (
    <div>
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {files.map((f) => (
            <span
              key={f.id}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-medium"
              style={{ background: TEAL_SOFT, color: TEAL_DARK }}
            >
              <FileText size={12} />
              <span className="max-w-[180px] truncate" title={f.filename}>
                {f.filename}
              </span>
              <span style={{ opacity: 0.7 }}>{prettyBytes(f.sizeBytes)}</span>
              <button
                type="button"
                aria-label={`Remove ${f.filename}`}
                onClick={() => onChange(files.filter((x) => x.id !== f.id))}
                disabled={disabled}
                className="ml-0.5 rounded-sm p-0.5 hover:bg-black/5 disabled:opacity-50"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handle(e.target.files)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || busy}
        className="inline-flex items-center gap-1.5 text-[11.5px] font-medium disabled:opacity-50"
        style={{ color: TEAL }}
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
        {busy ? "Uploading…" : "Attach evidence"}
      </button>
    </div>
  );
}
