"use client";

import { useRef, useState } from "react";
import { Check, X, Camera, PenLine, ImagePlus, ImageIcon, Loader2 } from "lucide-react";
import { NOT_APPLICABLE, type FormItem, type FormResponses, type FormSchema } from "@kaenal/types";
import { isVisible } from "@kaenal/core";
import { cn } from "@/lib/cn";
import { uploadFile, usePreviewUrl } from "@/hooks/use-files";
import { useToast } from "@/components/ui/toast";

/**
 * The dynamic inspection-form renderer (04 §5, 02 §2). It walks the template
 * `schema` — never inventing a field — and renders one control per item type.
 * Conditional items appear only when `isVisible` (the SAME predicate the server
 * scores with, from `@kaenal/core`) says so, so the form the inspector sees and
 * the form the server validates are identical. In `readOnly` mode it renders the
 * captured answers instead of inputs (a completed inspection).
 *
 * Every control emits exactly the value shape the engine expects (pass_fail →
 * "pass"/"fail", score → number, multiselect → string[], N/A → the sentinel), so
 * live scoring and server validation agree.
 */
export function InspectionForm({
  schema,
  responses,
  onChange,
  readOnly = false,
}: {
  schema: FormSchema;
  responses: FormResponses;
  onChange?: (itemId: string, value: unknown) => void;
  readOnly?: boolean;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-4">
      {schema.sections.map((section, si) => {
        const visibleItems = section.items.filter((it) => isVisible(it, responses));
        return (
          <div key={section.id} className="k-surface overflow-hidden p-0">
            <div className="flex items-center gap-2.5 border-b border-border px-5 py-3" style={{ background: "var(--bg-subtle)" }}>
              <span
                className="flex items-center justify-center rounded-full text-[12px] font-bold text-white"
                style={{ width: 26, height: 26, background: "var(--accent)" }}
              >
                {si + 1}
              </span>
              <div className="text-[14px] font-semibold">{section.title}</div>
              <span className="ml-auto text-[12px] text-muted">{visibleItems.length} items</span>
            </div>
            <div>
              {visibleItems.map((item, idx) => (
                <div
                  key={item.id}
                  className={cn("flex items-start gap-3.5 px-5 py-3.5", idx < visibleItems.length - 1 && "border-b border-border")}
                >
                  <FormItemRow item={item} value={responses[item.id]} onChange={onChange} readOnly={readOnly} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FormItemRow({
  item,
  value,
  onChange,
  readOnly,
}: {
  item: FormItem;
  value: unknown;
  onChange?: ((itemId: string, value: unknown) => void) | undefined;
  readOnly: boolean;
}): React.ReactElement {
  if (item.type === "header") {
    return <div className="text-[15px] font-semibold">{item.label}</div>;
  }
  if (item.type === "info") {
    return <div className="text-[13px] text-muted">{item.label}</div>;
  }

  const set = (v: unknown): void => onChange?.(item.id, v);
  const isNa = value === NOT_APPLICABLE;

  return (
    <>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium">
          {item.label}
          {item.required && <span className="ml-0.5" style={{ color: "var(--danger-500)" }}>*</span>}
        </div>
        {item.naAllowed && !readOnly && (
          <button
            type="button"
            onClick={() => set(isNa ? undefined : NOT_APPLICABLE)}
            className="mt-1 text-[11px] text-muted hover:text-text"
          >
            {isNa ? "✓ Not applicable — undo" : "Mark not applicable"}
          </button>
        )}
      </div>
      <div className="shrink-0">
        {isNa ? <span className="k-chip" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}>N/A</span> : <Control item={item} value={value} set={set} readOnly={readOnly} />}
      </div>
    </>
  );
}

function Control({
  item,
  value,
  set,
  readOnly,
}: {
  item: FormItem;
  value: unknown;
  set: (v: unknown) => void;
  readOnly: boolean;
}): React.ReactElement {
  switch (item.type) {
    case "pass_fail":
      return <BinaryControl value={value} set={set} readOnly={readOnly} yes="pass" no="fail" yesLabel="Pass" noLabel="Fail" />;
    case "yes_no":
      return <BinaryControl value={value} set={set} readOnly={readOnly} yes="yes" no="no" yesLabel="Yes" noLabel="No" />;
    case "score": {
      const min = item.min ?? 1;
      const max = item.max ?? 5;
      const scale = Array.from({ length: max - min + 1 }, (_, i) => min + i);
      return (
        <div className="flex gap-1">
          {scale.map((n) => {
            const active = typeof value === "number" && value >= n;
            return (
              <button
                key={n}
                type="button"
                disabled={readOnly}
                aria-label={`Score ${n}`}
                onClick={() => set(n)}
                className="rounded-sm"
                style={{ width: 16, height: 16, background: active ? "var(--warning-500)" : "var(--border)" }}
              />
            );
          })}
        </div>
      );
    }
    case "number":
      return readOnly ? (
        <span className="mono text-[13px] font-semibold">{typeof value === "number" ? value : "—"}</span>
      ) : (
        <input
          type="number"
          className="k-input"
          style={{ width: 110 }}
          value={typeof value === "number" ? value : ""}
          min={item.min}
          max={item.max}
          onChange={(e) => set(e.target.value === "" ? undefined : Number(e.target.value))}
        />
      );
    case "text":
      return readOnly ? (
        <span className="text-[13px] text-muted">{typeof value === "string" && value !== "" ? value : "—"}</span>
      ) : (
        <input className="k-input" style={{ width: 220 }} value={typeof value === "string" ? value : ""} onChange={(e) => set(e.target.value)} />
      );
    case "textarea":
      return readOnly ? (
        <span className="text-[13px] text-muted">{typeof value === "string" && value !== "" ? value : "—"}</span>
      ) : (
        <textarea
          className="k-input"
          rows={2}
          style={{ width: 260, height: "auto", padding: 8, resize: "vertical" }}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => set(e.target.value)}
        />
      );
    case "date":
    case "datetime":
      return readOnly ? (
        <span className="mono text-[12px]">{typeof value === "string" && value !== "" ? value : "—"}</span>
      ) : (
        <input
          type={item.type === "date" ? "date" : "datetime-local"}
          className="k-input"
          style={{ width: 200 }}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => set(e.target.value === "" ? undefined : e.target.value)}
        />
      );
    case "select":
      return readOnly ? (
        <span className="text-[13px]">{optionLabel(item, value)}</span>
      ) : (
        <select
          className="k-input"
          style={{ width: 200 }}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => set(e.target.value === "" ? undefined : e.target.value)}
        >
          <option value="">Choose…</option>
          {(item.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case "multiselect": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      if (readOnly) {
        return <span className="text-[13px]">{selected.length === 0 ? "—" : selected.join(", ")}</span>;
      }
      return (
        <div className="flex max-w-[260px] flex-wrap gap-1.5">
          {(item.options ?? []).map((o) => {
            const on = selected.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => set(on ? selected.filter((v) => v !== o.value) : [...selected, o.value])}
                className="k-chip"
                style={{
                  background: on ? "var(--accent)" : "var(--bg-subtle)",
                  color: on ? "var(--accent-fg)" : "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      );
    }
    case "photo":
      return <PhotoControl value={value} set={set} readOnly={readOnly} />;
    case "signature":
      return <Placeholder icon={PenLine} label="Signature — mobile capture" />;
    default:
      return <span className="text-subtle">—</span>;
  }
}

function BinaryControl({
  value,
  set,
  readOnly,
  yes,
  no,
  yesLabel,
  noLabel,
}: {
  value: unknown;
  set: (v: unknown) => void;
  readOnly: boolean;
  yes: string;
  no: string;
  yesLabel: string;
  noLabel: string;
}): React.ReactElement {
  const isYes = value === yes;
  const isNo = value === no;
  return (
    <div className="flex gap-1">
      <button
        type="button"
        disabled={readOnly}
        onClick={() => set(isYes ? undefined : yes)}
        className="inline-flex items-center gap-1 rounded-sm px-2.5 py-1.5 text-[12px] font-semibold"
        style={{
          background: isYes ? "var(--success-100)" : "var(--bg-subtle)",
          color: isYes ? "var(--success-700)" : "var(--text-subtle)",
        }}
      >
        {isYes && <Check size={12} strokeWidth={3} />} {yesLabel}
      </button>
      <button
        type="button"
        disabled={readOnly}
        onClick={() => set(isNo ? undefined : no)}
        className="inline-flex items-center gap-1 rounded-sm px-2.5 py-1.5 text-[12px] font-semibold"
        style={{
          background: isNo ? "var(--danger-100)" : "var(--bg-subtle)",
          color: isNo ? "var(--danger-700)" : "var(--text-subtle)",
        }}
      >
        {isNo && <X size={12} strokeWidth={3} />} {noLabel}
      </button>
    </div>
  );
}

/** Photo field: real web upload (any image format), not just mobile capture.
 *  The response value is an array of uploaded file ids (the engine accepts a
 *  string or a list of file references and never scores photos). Thumbnails
 *  render via the presigned inline-preview url. */
function toFileIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string" && v !== "");
  if (typeof value === "string" && value !== "") return [value];
  return [];
}

function PhotoControl({ value, set, readOnly }: { value: unknown; set: (v: unknown) => void; readOnly: boolean }): React.ReactElement {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const ids = toFileIds(value);

  const onFiles = async (files: FileList | null): Promise<void> => {
    if (files === null || files.length === 0) return;
    setBusy(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} isn't an image`);
          continue;
        }
        const f = await uploadFile(file);
        uploaded.push(f.id);
      }
      if (uploaded.length > 0) set([...ids, ...uploaded]);
    } catch {
      toast.error("Couldn't upload the photo");
    } finally {
      setBusy(false);
    }
  };

  if (readOnly) {
    return ids.length === 0 ? (
      <span className="text-[13px] text-muted">—</span>
    ) : (
      <div className="flex max-w-[260px] flex-wrap justify-end gap-1.5">
        {ids.map((id) => (
          <PhotoThumb key={id} fileId={id} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {ids.length > 0 && (
        <div className="flex max-w-[260px] flex-wrap justify-end gap-1.5">
          {ids.map((id) => (
            <PhotoThumb key={id} fileId={id} onRemove={() => set(ids.filter((x) => x !== id))} />
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border-strong px-2.5 py-1.5 text-[11px] text-muted hover:text-text disabled:opacity-60"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
        {busy ? "Uploading…" : ids.length > 0 ? "Add photo" : "Upload photo"}
      </button>
    </div>
  );
}

function PhotoThumb({ fileId, onRemove }: { fileId: string; onRemove?: () => void }): React.ReactElement {
  const { data } = usePreviewUrl(fileId);
  return (
    <div className="relative">
      {data?.url !== undefined ? (
        // eslint-disable-next-line @next/next/no-img-element -- presigned storage URL, next/image can't optimise it
        <img src={data.url} alt="Inspection photo" className="h-12 w-12 rounded border border-border object-cover" />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded border border-border bg-bg-subtle">
          <ImageIcon size={14} className="text-muted" />
        </div>
      )}
      {onRemove !== undefined && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove photo"
          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-white"
          style={{ background: "var(--danger-600)" }}
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}

function Placeholder({ icon: Icon, label }: { icon: typeof Camera; label: string }): React.ReactElement {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border-strong px-2.5 py-1.5 text-[11px] text-muted">
      <Icon size={13} /> {label}
    </span>
  );
}

function optionLabel(item: FormItem, value: unknown): string {
  if (typeof value !== "string" || value === "") return "—";
  return item.options?.find((o) => o.value === value)?.label ?? value;
}
