"use client";

import { useRef, useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import type { FileDto } from "@kaenal/types";
import { useToast } from "@/components/ui";
import { uploadFile } from "@/hooks/use-files";
import { fileTypeIcon, formatBytes } from "./document-bits";

/**
 * Drag-and-drop file attach (upload-flow.jsx). Runs the real presign → PUT →
 * complete pipeline with live progress, then hands the completed `FileDto` up so
 * the create / new-version dialogs can attach its `fileId`. One file at a time —
 * a controlled document has one controlled file per version.
 */
export function FileDrop({
  value,
  onChange,
  autoFocusPicker = false,
}: {
  value: FileDto | null;
  onChange: (file: FileDto | null) => void;
  autoFocusPicker?: boolean;
}): React.ReactElement {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const handle = (file: File | undefined): void => {
    if (file === undefined) return;
    setBusy(true);
    setPct(0);
    uploadFile(file, setPct)
      .then((dto) => onChange(dto))
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Upload failed"))
      .finally(() => setBusy(false));
  };

  if (value !== null) {
    const { Icon, color } = fileTypeIcon(value.mime);
    const size = formatBytes(value.sizeBytes);
    return (
      <div className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2.5">
        <span style={{ color }}>
          <Icon size={22} strokeWidth={1.5} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold" title={value.filename}>
            {value.filename}
          </div>
          <div className="text-[11px] text-muted">
            {size !== null && `${size} · `}
            {value.scanStatus === "clean" ? "Ready" : "Scan pending"}
          </div>
        </div>
        <button type="button" onClick={() => onChange(null)} className="k-btn-icon k-btn-plain" aria-label="Remove file">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0])}
        autoFocus={autoFocusPicker}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handle(e.dataTransfer.files?.[0]);
        }}
        disabled={busy}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-6 text-center"
        style={{
          borderColor: dragOver ? "var(--accent)" : "var(--border)",
          background: dragOver ? "var(--accent-soft)" : "var(--bg-subtle)",
        }}
      >
        {busy ? (
          <>
            <Loader2 size={18} className="animate-spin" style={{ color: "var(--accent)" }} />
            <div className="w-full max-w-[240px]">
              <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
                <div className="h-full transition-all" style={{ width: `${pct}%`, background: "var(--accent)" }} />
              </div>
            </div>
            <span className="text-[12px] text-muted">Uploading… {pct}%</span>
          </>
        ) : (
          <>
            <Upload size={18} style={{ color: "var(--text-muted)" }} />
            <span className="text-[13px] font-medium">Drop a file or click to browse</span>
            <span className="text-[11px] text-subtle">PDF, Office docs or images · up to 25 MB</span>
          </>
        )}
      </button>
    </>
  );
}
