"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Check, ToggleLeft, Star, Type, AlignLeft, Hash, List, ListChecks,
  Calendar, Clock, Camera, PenLine, Heading, Info, GripVertical, Trash2, Copy,
  Plus, Download, Eye, Pencil, Settings2, GitBranch, ClipboardCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { FormItem, FormItemType, FormSchema, FormResponses } from "@kaenal/types";
import { usePublishTemplate } from "@/hooks/use-inspections";
import { Button, Segmented } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api-error";
import { InspectionForm } from "./form-renderer";

/**
 * Inspection template editor (04 §5), ported from template-editor.jsx. A
 * drag-drop section/field builder whose model IS the real `FormSchema`
 * (`@kaenal/types`) — so what you publish is exactly what the inspector renders
 * and the server scores. Fields are the engine's whole vocabulary (14 item
 * types); each item's real properties are `required`, scoring `weight`
 * (0 = excluded), `naAllowed`, `options`, `min`/`max`, and a `visibleWhen`
 * equality condition. Save & Publish creates a draft then publishes it (its
 * schema becomes immutable, 02 §2); Export downloads the schema JSON.
 *
 * The prototype's auto-finding toggle, weighted-method selector, multi-action
 * When/Then rules and linked master-data sources are intentionally NOT built:
 * the API and `@kaenal/core` don't model them, so rendering them would promise
 * behaviour the system can't deliver. `visibleWhen` is the real conditional
 * primitive and is fully wired.
 */

interface FieldTypeMeta {
  id: FormItemType;
  label: string;
  icon: LucideIcon;
}

const FIELD_TYPES: FieldTypeMeta[] = [
  { id: "pass_fail", label: "Pass / Fail / N/A", icon: Check },
  { id: "yes_no", label: "Yes / No", icon: ToggleLeft },
  { id: "score", label: "Score (1–5)", icon: Star },
  { id: "number", label: "Number with unit", icon: Hash },
  { id: "text", label: "Short text", icon: Type },
  { id: "textarea", label: "Long text", icon: AlignLeft },
  { id: "select", label: "Dropdown", icon: List },
  { id: "multiselect", label: "Multi-select", icon: ListChecks },
  { id: "date", label: "Date", icon: Calendar },
  { id: "datetime", label: "Date + time", icon: Clock },
  { id: "photo", label: "Photo capture", icon: Camera },
  { id: "signature", label: "Signature", icon: PenLine },
  { id: "header", label: "Section header", icon: Heading },
  { id: "info", label: "Info block", icon: Info },
];

const META = new Map(FIELD_TYPES.map((f) => [f.id, f]));
const PRESENTATIONAL = new Set<FormItemType>(["header", "info"]);

let seq = 0;
const uid = (p: string): string => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

/** A new item with only the keys the schema needs for its type. */
function newItem(type: FormItemType): FormItem {
  const base: FormItem = {
    id: uid("i"),
    type,
    label: `New ${META.get(type)?.label ?? "field"}`,
    required: false,
    weight: 1,
    naAllowed: type === "pass_fail",
  };
  if (type === "select" || type === "multiselect") {
    base.options = [
      { value: "option_1", label: "Option 1" },
      { value: "option_2", label: "Option 2" },
    ];
  }
  return base;
}

interface DraftSection {
  id: string;
  title: string;
  weight: number;
  items: FormItem[];
}
interface Draft {
  name: string;
  version: number;
  sections: DraftSection[];
}

/** Consume a schema stashed by the Templates list's Import JSON, if present. */
function importedDraft(): Draft | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem("kaenal:import-template");
  if (raw === null) return null;
  sessionStorage.removeItem("kaenal:import-template");
  try {
    const parsed = JSON.parse(raw) as { schema: FormSchema; name?: string };
    return {
      name: parsed.name ?? "Imported template",
      version: 1,
      sections: parsed.schema.sections.map((s) => ({ id: s.id, title: s.title, weight: s.weight, items: s.items })),
    };
  } catch {
    return null;
  }
}

function blankDraft(): Draft {
  return {
    name: "Untitled template",
    version: 1,
    sections: [{ id: uid("s"), title: "Section 1", weight: 1, items: [] }],
  };
}

export function TemplateEditor({ initial }: { initial?: Draft }): React.ReactElement {
  const router = useRouter();
  const toast = useToast();
  const publish = usePublishTemplate();

  const [draft, setDraft] = useState<Draft>(() => initial ?? importedDraft() ?? blankDraft());
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [sel, setSel] = useState<{ s: number; i: number } | null>({ s: 0, i: 0 });
  const [previewResponses, setPreviewResponses] = useState<FormResponses>({});
  const [drag, setDrag] = useState<{ s: number; i: number } | null>(null);

  const totalItems = draft.sections.reduce((n, s) => n + s.items.length, 0);
  const selItem =
    sel !== null ? draft.sections[sel.s]?.items[sel.i] : undefined;

  const schema: FormSchema = useMemo(
    () => ({ sections: draft.sections.map((s) => ({ id: s.id, title: s.title, weight: s.weight, items: s.items })) }),
    [draft],
  );

  // ── section / item mutations ────────────────────────────────────────────
  const patchSection = (si: number, patch: Partial<DraftSection>): void =>
    setDraft((d) => ({ ...d, sections: d.sections.map((s, i) => (i === si ? { ...s, ...patch } : s)) }));

  const addSection = (): void =>
    setDraft((d) => ({
      ...d,
      sections: [...d.sections, { id: uid("s"), title: `Section ${d.sections.length + 1}`, weight: 1, items: [] }],
    }));

  const deleteSection = (si: number): void => {
    setDraft((d) => ({ ...d, sections: d.sections.filter((_, i) => i !== si) }));
    setSel(null);
  };

  const addItem = (si: number, type: FormItemType, at?: number): void => {
    const it = newItem(type);
    setDraft((d) => ({
      ...d,
      sections: d.sections.map((s, i) => {
        if (i !== si) return s;
        const items = [...s.items];
        items.splice(at ?? items.length, 0, it);
        return { ...s, items };
      }),
    }));
    setSel({ s: si, i: at ?? draft.sections[si]!.items.length });
  };

  const patchItem = (patch: Partial<FormItem>): void => {
    if (sel === null) return;
    setDraft((d) => ({
      ...d,
      sections: d.sections.map((s, si) =>
        si === sel.s
          ? { ...s, items: s.items.map((it, ii) => (ii === sel.i ? pruneItem({ ...it, ...patch }) : it)) }
          : s,
      ),
    }));
  };

  const deleteItem = (si: number, ii: number): void => {
    setDraft((d) => ({
      ...d,
      sections: d.sections.map((s, i) => (i === si ? { ...s, items: s.items.filter((_, j) => j !== ii) } : s)),
    }));
    setSel(null);
  };

  const duplicateItem = (si: number, ii: number): void => {
    setDraft((d) => ({
      ...d,
      sections: d.sections.map((s, i) => {
        if (i !== si) return s;
        const items = [...s.items];
        const copy: FormItem = { ...items[ii]!, id: uid("i") };
        items.splice(ii + 1, 0, copy);
        return { ...s, items };
      }),
    }));
    setSel({ s: si, i: ii + 1 });
  };

  const moveItem = (from: { s: number; i: number }, toS: number, toI: number): void => {
    setDraft((d) => {
      const sections = d.sections.map((s) => ({ ...s, items: [...s.items] }));
      const [moved] = sections[from.s]!.items.splice(from.i, 1);
      if (moved === undefined) return d;
      let target = toI;
      if (from.s === toS && from.i < target) target -= 1;
      target = Math.max(0, Math.min(target, sections[toS]!.items.length));
      sections[toS]!.items.splice(target, 0, moved);
      return { ...d, sections };
    });
    setSel({ s: toS, i: toI });
  };

  // ── publish / export ────────────────────────────────────────────────────
  const canPublish = draft.name.trim() !== "" && totalItems > 0;

  const onPublish = (): void => {
    if (!canPublish) {
      toast.error("Add a name and at least one field before publishing.");
      return;
    }
    publish.mutate(
      { name: draft.name.trim(), schema },
      {
        onSuccess: (t) => {
          toast.success(`"${t.name}" published — v${t.version} live`);
          router.push("/inspections/templates");
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  const exportJson = (): void => {
    const blob = new Blob([JSON.stringify({ name: draft.name, version: draft.version, schema }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${draft.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "template"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      {/* Header strip */}
      <div className="flex items-center gap-3.5 border-b border-border bg-surface px-6 py-3">
        <button
          onClick={() => router.push("/inspections/templates")}
          className="inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-text"
        >
          <ArrowLeft size={14} /> Templates
        </button>
        <div className="h-5 w-px bg-border" />
        <input
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          className="min-w-0 flex-1 border-none bg-transparent text-[16px] font-bold text-text outline-none"
          placeholder="Template name"
          aria-label="Template name"
        />
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11.5px] text-muted">
          <ClipboardCheck size={12} /> {draft.sections.length} sections · {totalItems} items
        </span>
        <Segmented
          ariaLabel="Editor mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: "edit", label: "Edit", icon: Pencil },
            { value: "preview", label: "Preview", icon: Eye },
          ]}
        />
        <Button size="sm" onClick={exportJson}>
          <Download size={13} /> Export JSON
        </Button>
        <Button variant="primary" size="sm" onClick={onPublish} disabled={publish.isPending || !canPublish}>
          <Check size={13} /> {publish.isPending ? "Publishing…" : "Save & Publish"}
        </Button>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {/* Left: palette */}
        {mode === "edit" && (
          <div className="w-[220px] shrink-0 overflow-y-auto border-r border-border bg-bg-subtle p-3.5 max-lg:hidden">
            <div className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-muted">Field types</div>
            <div className="flex flex-col gap-1">
              {FIELD_TYPES.map((f) => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("field-type", f.id);
                      setDrag(null);
                    }}
                    className="flex cursor-grab items-center gap-2 rounded-sm border border-border bg-surface px-2.5 py-2 text-[12px] font-medium active:cursor-grabbing"
                  >
                    <Icon size={13} className="text-muted" />
                    <span className="flex-1">{f.label}</span>
                    <GripVertical size={11} className="text-subtle" />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Middle: canvas or preview */}
        <div className={`min-w-0 flex-1 overflow-y-auto p-6 ${mode === "preview" ? "bg-bg" : "bg-bg-subtle"}`}>
          <div className="mx-auto max-w-[760px]">
            {mode === "preview" ? (
              totalItems === 0 ? (
                <div className="k-surface p-10 text-center text-[13px] text-muted">
                  Add fields in Edit mode to preview the inspector form.
                </div>
              ) : (
                <InspectionForm schema={schema} responses={previewResponses} onChange={(id, v) => setPreviewResponses((r) => ({ ...r, [id]: v }))} />
              )
            ) : (
              <>
                <div className="k-surface mb-4 flex items-center gap-3 p-4 text-[12px] text-muted">
                  <GitBranch size={15} className="shrink-0 text-accent" />
                  <span>
                    Score is per-item <b>weight</b> × section <b>weight</b> ({" "}
                    <span className="mono">0</span> excludes an item or section). Conditional fields use{" "}
                    <b>Show only when…</b> in the field&apos;s properties.
                  </span>
                </div>

                {draft.sections.map((section, si) => (
                  <div
                    key={section.id}
                    className="k-surface mb-3.5 overflow-visible p-0"
                    onDragOver={(e) => {
                      if (!section.items.length) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      const ft = e.dataTransfer.getData("field-type");
                      if (ft) {
                        e.preventDefault();
                        addItem(si, ft as FormItemType);
                      } else if (drag) {
                        e.preventDefault();
                        moveItem(drag, si, section.items.length);
                        setDrag(null);
                      }
                    }}
                  >
                    {/* Section header */}
                    <div className="flex items-center gap-2.5 rounded-t-md border-b border-border bg-bg-subtle px-3.5 py-3">
                      <span
                        className="flex items-center justify-center rounded-md text-[12px] font-bold text-white"
                        style={{ width: 26, height: 26, background: "var(--accent)" }}
                      >
                        {si + 1}
                      </span>
                      <input
                        value={section.title}
                        onChange={(e) => patchSection(si, { title: e.target.value })}
                        placeholder="Section title"
                        aria-label={`Section ${si + 1} title`}
                        className="min-w-0 flex-1 border-none bg-transparent text-[14.5px] font-bold text-text outline-none"
                      />
                      <span className="whitespace-nowrap text-[10.5px] font-semibold text-muted">
                        {section.items.length} {section.items.length === 1 ? "field" : "fields"}
                      </span>
                      <div className="h-4 w-px bg-border" />
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          value={section.weight}
                          onChange={(e) => patchSection(si, { weight: Number(e.target.value) })}
                          aria-label={`Section ${si + 1} weight`}
                          className="h-[26px] w-[46px] rounded-sm border border-border bg-surface px-1.5 text-right text-[11px]"
                        />
                        <span className="text-[11px] text-muted">wt</span>
                      </div>
                      <button
                        onClick={() => deleteSection(si)}
                        className="rounded-sm p-1.5 text-muted hover:text-danger"
                        title="Delete section"
                        aria-label={`Delete section ${si + 1}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Items */}
                    <div className="p-2">
                      {section.items.map((it, ii) => {
                        const selected = sel?.s === si && sel.i === ii;
                        const m = META.get(it.type);
                        const Icon = m?.icon ?? Check;
                        return (
                          <div
                            key={it.id}
                            draggable
                            onDragStart={(e) => {
                              setDrag({ s: si, i: ii });
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            onDragOver={(e) => {
                              if (drag) e.preventDefault();
                            }}
                            onDrop={(e) => {
                              if (drag) {
                                e.preventDefault();
                                e.stopPropagation();
                                const r = e.currentTarget.getBoundingClientRect();
                                const before = e.clientY < r.top + r.height / 2;
                                moveItem(drag, si, before ? ii : ii + 1);
                                setDrag(null);
                              }
                            }}
                            onClick={() => setSel({ s: si, i: ii })}
                            className="group mb-1 flex cursor-pointer items-center gap-2.5 rounded-md border px-2.5 py-2.5"
                            style={{
                              background: selected ? "var(--accent-soft)" : "var(--surface)",
                              borderColor: selected ? "var(--accent)" : "var(--border)",
                            }}
                          >
                            <GripVertical size={13} className="shrink-0 cursor-grab text-subtle" />
                            <span
                              className="flex shrink-0 items-center justify-center rounded-md"
                              style={{ width: 26, height: 26, background: "var(--accent-soft)", color: "var(--accent)" }}
                            >
                              <Icon size={13} />
                            </span>
                            <span className="flex-1 truncate text-[13px] font-medium">{it.label}</span>
                            {it.required && (
                              <span className="text-[15px] leading-none text-danger" title="Required">
                                *
                              </span>
                            )}
                            {it.visibleWhen && (
                              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-accent-soft px-1.5 py-0.5 text-[9.5px] font-bold text-accent">
                                <GitBranch size={10} /> Conditional
                              </span>
                            )}
                            <span className="whitespace-nowrap rounded-full bg-bg-subtle px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                              {m?.label}
                            </span>
                            <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                              <button
                                onClick={(e) => { e.stopPropagation(); duplicateItem(si, ii); }}
                                className="rounded-sm p-1 text-muted hover:text-text"
                                title="Duplicate"
                              >
                                <Copy size={13} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteItem(si, ii); }}
                                className="rounded-sm p-1 text-muted hover:text-danger"
                                title="Delete"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      <AddFieldButton hasItems={section.items.length > 0} onAdd={(type) => addItem(si, type)} />
                    </div>
                  </div>
                ))}

                <button
                  onClick={addSection}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border-strong py-3.5 text-[13px] font-semibold text-muted hover:text-text"
                >
                  <Plus size={14} /> Add section
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right: properties */}
        {mode === "edit" && selItem !== undefined && (
          <PropertiesPanel
            item={selItem}
            schema={schema}
            selfId={selItem.id}
            onPatch={patchItem}
            onDelete={() => sel !== null && deleteItem(sel.s, sel.i)}
          />
        )}
      </div>
    </div>
  );
}

/** Drop `undefined`/empty keys so exactOptionalPropertyTypes stays happy and the
 *  published schema carries only meaningful fields. */
function pruneItem(it: FormItem): FormItem {
  const out: FormItem = {
    id: it.id,
    type: it.type,
    label: it.label,
    required: it.required,
    weight: it.weight,
    naAllowed: it.naAllowed,
  };
  if ((it.type === "select" || it.type === "multiselect") && it.options && it.options.length > 0) out.options = it.options;
  if (it.min !== undefined) out.min = it.min;
  if (it.max !== undefined) out.max = it.max;
  if (it.visibleWhen && it.visibleWhen.equals.length > 0) out.visibleWhen = it.visibleWhen;
  return out;
}

function AddFieldButton({ hasItems, onAdd }: { hasItems: boolean; onAdd: (t: FormItemType) => void }): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative mt-1">
      <button
        onClick={() => setOpen((o) => !o)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const ft = e.dataTransfer.getData("field-type");
          if (ft) { e.preventDefault(); e.stopPropagation(); onAdd(ft as FormItemType); }
        }}
        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border-strong py-2.5 text-[12px] font-semibold text-muted hover:text-text"
      >
        <Plus size={13} /> Add field {hasItems ? "· or drag one here" : "· or drag from the left"}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 grid grid-cols-2 gap-0.5 rounded-lg border border-border bg-surface p-1.5 shadow-lg">
            {FIELD_TYPES.map((f) => {
              const Icon = f.icon;
              return (
                <button
                  key={f.id}
                  onClick={() => { onAdd(f.id); setOpen(false); }}
                  className="flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12px] hover:bg-bg-subtle"
                >
                  <Icon size={13} className="text-accent" /> {f.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── properties panel ─────────────────────────────────────────────────────────

function PropertiesPanel({
  item,
  schema,
  selfId,
  onPatch,
  onDelete,
}: {
  item: FormItem;
  schema: FormSchema;
  selfId: string;
  onPatch: (patch: Partial<FormItem>) => void;
  onDelete: () => void;
}): React.ReactElement {
  const isChoice = item.type === "select" || item.type === "multiselect";
  const isNumeric = item.type === "number" || item.type === "score";
  const presentational = PRESENTATIONAL.has(item.type);

  return (
    <div className="w-[320px] shrink-0 overflow-y-auto border-l border-border bg-surface p-[18px] max-xl:w-[280px] max-lg:hidden">
      <div className="mb-3.5 flex items-center gap-1.5 text-[13px] font-semibold text-accent">
        <Settings2 size={14} /> Properties
      </div>

      <Prop label="Label">
        <textarea
          value={item.label}
          onChange={(e) => onPatch({ label: e.target.value })}
          rows={2}
          className="k-input min-h-[50px] resize-y p-2 text-[12.5px]"
          style={{ height: "auto" }}
        />
      </Prop>

      <Prop label="Field type">
        <select
          value={item.type}
          onChange={(e) => onPatch({ type: e.target.value as FormItemType })}
          className="k-input h-[30px] text-[12.5px]"
        >
          {FIELD_TYPES.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </Prop>

      {!presentational && (
        <>
          <Toggle label="Required" value={item.required} onChange={(v) => onPatch({ required: v })} />
          <Toggle label='Allow "N/A" (drops from score)' value={item.naAllowed} onChange={(v) => onPatch({ naAllowed: v })} />

          <Prop label="Scoring weight (0 = excluded)">
            <input
              type="number"
              min={0}
              step="0.1"
              value={item.weight}
              onChange={(e) => onPatch({ weight: Number(e.target.value) })}
              className="k-input h-[30px] text-[12.5px]"
            />
          </Prop>
        </>
      )}

      {isChoice && (
        <Prop label="Options (one per line)">
          <textarea
            value={(item.options ?? []).map((o) => o.label).join("\n")}
            onChange={(e) => {
              const labels = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean);
              onPatch({ options: labels.map((label) => ({ value: slug(label), label })) });
            }}
            rows={4}
            placeholder={"Option 1\nOption 2\nOption 3"}
            className="k-input min-h-[70px] resize-y p-2 text-[12.5px]"
            style={{ height: "auto" }}
          />
        </Prop>
      )}

      {isNumeric && (
        <div className="grid grid-cols-2 gap-2.5">
          <Prop label={item.type === "score" ? "Scale min" : "Min"}>
            <input
              type="number"
              value={item.min ?? ""}
              onChange={(e) => onPatch({ min: e.target.value === "" ? undefined : Number(e.target.value) })}
              placeholder="—"
              className="k-input h-[30px] text-[12.5px]"
            />
          </Prop>
          <Prop label={item.type === "score" ? "Scale max" : "Max"}>
            <input
              type="number"
              value={item.max ?? ""}
              onChange={(e) => onPatch({ max: e.target.value === "" ? undefined : Number(e.target.value) })}
              placeholder={item.type === "score" ? "5" : "—"}
              className="k-input h-[30px] text-[12.5px]"
            />
          </Prop>
        </div>
      )}

      {!presentational && <VisibleWhenEditor item={item} schema={schema} selfId={selfId} onPatch={onPatch} />}

      <div className="mt-4 border-t border-border pt-3.5">
        <button
          onClick={onDelete}
          className="flex w-full items-center justify-center gap-1.5 rounded-sm border border-danger/20 bg-danger/10 py-2 text-[12px] font-medium text-danger"
        >
          <Trash2 size={12} /> Delete field
        </button>
      </div>
    </div>
  );
}

/** The real conditional primitive: show this item only when another item's
 *  response equals a chosen value (`visibleWhen`, evaluated identically by the
 *  renderer and the server scorer). */
function VisibleWhenEditor({
  item,
  schema,
  selfId,
  onPatch,
}: {
  item: FormItem;
  schema: FormSchema;
  selfId: string;
  onPatch: (patch: Partial<FormItem>) => void;
}): React.ReactElement {
  const candidates = schema.sections
    .flatMap((s) => s.items)
    .filter((it) => it.id !== selfId && !PRESENTATIONAL.has(it.type));
  const trigger = candidates.find((c) => c.id === item.visibleWhen?.itemId);
  const values = triggerValues(trigger);

  const setTrigger = (id: string): void => {
    if (id === "") {
      onPatch({ visibleWhen: undefined });
      return;
    }
    const t = candidates.find((c) => c.id === id);
    const first = triggerValues(t)[0]?.value ?? "";
    onPatch({ visibleWhen: { itemId: id, equals: [first] } });
  };

  return (
    <div className="mt-3.5 border-t border-border pt-3">
      <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide text-muted">
        <GitBranch size={11} /> Show only when
      </div>
      {candidates.length === 0 ? (
        <p className="text-[11.5px] text-muted">Add another field first to make this one conditional.</p>
      ) : (
        <>
          <select
            value={item.visibleWhen?.itemId ?? ""}
            onChange={(e) => setTrigger(e.target.value)}
            className="k-input mb-2 h-[30px] text-[12.5px]"
            aria-label="Condition trigger field"
          >
            <option value="">Always shown</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          {item.visibleWhen && (
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-muted">equals</span>
              {values.length > 0 ? (
                <select
                  value={String(item.visibleWhen.equals[0] ?? "")}
                  onChange={(e) => onPatch({ visibleWhen: { itemId: item.visibleWhen!.itemId, equals: [e.target.value] } })}
                  className="k-input h-[30px] flex-1 text-[12.5px]"
                  aria-label="Condition value"
                >
                  {values.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={String(item.visibleWhen.equals[0] ?? "")}
                  onChange={(e) => onPatch({ visibleWhen: { itemId: item.visibleWhen!.itemId, equals: [e.target.value] } })}
                  placeholder="value"
                  className="k-input h-[30px] flex-1 text-[12.5px]"
                  aria-label="Condition value"
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** The response values a trigger item can equal — matching what the renderer
 *  emits (pass_fail → pass/fail, yes_no → yes/no, select → option values). */
function triggerValues(item: FormItem | undefined): { value: string; label: string }[] {
  if (item === undefined) return [];
  if (item.type === "pass_fail") return [{ value: "pass", label: "Pass" }, { value: "fail", label: "Fail" }];
  if (item.type === "yes_no") return [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }];
  if (item.type === "select") return (item.options ?? []).map((o) => ({ value: o.value, label: o.label }));
  return [];
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "option";
}

function Prop({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-[11px] font-semibold text-muted">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }): React.ReactElement {
  return (
    <div className="flex items-center justify-between border-b border-border py-2">
      <span className="text-[12.5px]">{label}</span>
      <button
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className="relative h-[18px] w-8 rounded-full transition-colors"
        style={{ background: value ? "var(--accent)" : "var(--border-strong)" }}
      >
        <span
          className="absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-all"
          style={{ left: value ? 16 : 2 }}
        />
      </button>
    </div>
  );
}

export { blankDraft, type Draft };
