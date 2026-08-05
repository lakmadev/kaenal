"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiQueries } from "@kaenal/api-client";
import type { Page } from "@kaenal/types";
import { GripVertical, X, ChevronLeft, ChevronRight, Plus, Info, LayoutGrid, Pencil, Check, Download } from "lucide-react";
import { getApiClient } from "@/lib/api";
import { useToast } from "@/components/ui";
import { WIDGET_REGISTRY, PRESETS, SIZE_TO_COLS, type WidgetCtx, type WidgetSize } from "./widgets";

/** `n` loaded, with a trailing `+` when the cursor shows there are more. */
function pageCount<T>(page: Page<T> | undefined): string | undefined {
  if (page === undefined) return undefined;
  return `${page.items.length}${page.nextCursor !== null ? "+" : ""}`;
}

const LS_LAYOUT = "k_layout";
const LS_SIZES = "k_sizes";
const LS_PRESET = "k_preset";

/**
 * Dashboard (04 §5) — a faithful rebuild of `dashboard.jsx` (design rule #9): a
 * customizable widget board with role presets, an add-widget catalog, drag-drop
 * reordering, per-widget resize, and localStorage persistence. KPI tiles read live
 * counts from the cursor-paginated endpoints; the analytics widgets render the
 * design's fixture data until their aggregate endpoints land (flagged in PROGRESS).
 */
export function DashboardView(): React.ReactElement {
  const client = getApiClient();
  const router = useRouter();
  const toast = useToast();

  const openNcrs = useQuery(apiQueries.ncrs.list(client, { query: { status: "open" } }));
  const inspections = useQuery(apiQueries.inspections.list(client));
  const eightDs = useQuery(apiQueries.eightDs.list(client, { query: { status: "active" } }));

  const inspCount = pageCount(inspections.data);
  const ncrCount = pageCount(openNcrs.data);
  const eightDCount = pageCount(eightDs.data);
  const kpis: WidgetCtx["kpis"] = {
    ...(inspCount !== undefined ? { inspections: inspCount } : {}),
    ...(ncrCount !== undefined ? { ncrs: ncrCount } : {}),
    ...(eightDCount !== undefined ? { eightds: eightDCount } : {}),
  };
  const ctx: WidgetCtx = { router, kpis };

  const [editing, setEditing] = useState(false);
  const [preset, setPreset] = useState("default");
  const [layout, setLayout] = useState<string[]>(PRESETS.default!.layout);
  const [sizes, setSizes] = useState<Record<string, WidgetSize>>({});
  const [showCatalog, setShowCatalog] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Hydrate from localStorage after mount (avoids SSR/first-render mismatch).
  useEffect(() => {
    const savedPreset = localStorage.getItem(LS_PRESET);
    if (savedPreset !== null && PRESETS[savedPreset] !== undefined) setPreset(savedPreset);
    const savedLayout = localStorage.getItem(LS_LAYOUT);
    if (savedLayout !== null) {
      try {
        setLayout(JSON.parse(savedLayout) as string[]);
      } catch {
        /* ignore corrupt state */
      }
    }
    const savedSizes = localStorage.getItem(LS_SIZES);
    if (savedSizes !== null) {
      try {
        setSizes(JSON.parse(savedSizes) as Record<string, WidgetSize>);
      } catch {
        /* ignore corrupt state */
      }
    }
  }, []);

  const persist = (next: string[], nextSizes?: Record<string, WidgetSize>): void => {
    setLayout(next);
    localStorage.setItem(LS_LAYOUT, JSON.stringify(next));
    if (nextSizes !== undefined) {
      setSizes(nextSizes);
      localStorage.setItem(LS_SIZES, JSON.stringify(nextSizes));
    }
  };

  const applyPreset = (k: string): void => {
    setPreset(k);
    localStorage.setItem(LS_PRESET, k);
    persist(PRESETS[k]!.layout, {});
  };

  const removeWidget = (id: string): void => persist(layout.filter((x) => x !== id));
  const addWidget = (id: string): void => {
    persist([...layout, id]);
    setShowCatalog(false);
  };
  const toggleSize = (id: string): void => {
    const w = WIDGET_REGISTRY[id];
    if (w === undefined) return;
    const cur = sizes[id] ?? w.size;
    const nextSize: WidgetSize = cur === "small" ? "half" : cur === "half" ? "wide" : cur === "wide" ? "full" : "small";
    persist(layout, { ...sizes, [id]: nextSize });
  };

  const onDrop = (idx: number): void => {
    if (draggedIdx === null || idx === draggedIdx) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }
    const next = [...layout];
    const [moved] = next.splice(draggedIdx, 1);
    next.splice(idx, 0, moved!);
    persist(next);
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  return (
    <div className="fade-in">
      {/* Page header */}
      <div className="flex flex-col gap-4 px-4 pt-6 sm:flex-row sm:flex-wrap sm:items-start sm:gap-5 sm:px-7">
        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-[24px] font-bold tracking-[-0.02em]">Dashboard</h1>
          <p className="m-0 mt-1 text-[13px] text-muted">
            {editing
              ? "Edit mode — drag widgets to rearrange, click + to add"
              : `${PRESETS[preset]?.label ?? "Custom"} layout · ${layout.length} widgets`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setShowPresets(true)} className="k-btn k-btn-ghost">
            <LayoutGrid size={14} /> Presets
          </button>
          {!editing ? (
            <button onClick={() => setEditing(true)} className="k-btn k-btn-ghost">
              <Pencil size={14} /> Customize
            </button>
          ) : (
            <>
              <button onClick={() => setShowCatalog(true)} className="k-btn k-btn-ghost">
                <Plus size={14} /> Add widget
              </button>
              <button onClick={() => setEditing(false)} className="k-btn k-btn-primary">
                <Check size={14} /> Done
              </button>
            </>
          )}
          <button className="k-btn k-btn-ghost" onClick={() => toast.success("Export started — dashboard-snapshot.pdf")}>
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-5 px-4 pb-7 pt-5 sm:px-7">
        {editing && (
          <div
            className="flex items-center gap-3 rounded-md px-4 py-3 text-[13px]"
            style={{ background: "var(--accent-soft)", border: "1px solid var(--accent)", color: "var(--accent)" }}
          >
            <Info size={16} />
            <div className="flex-1">
              <strong>Edit mode active.</strong> Drag widgets by the grip handle to rearrange. Use the chevron to resize.
              Use + to add from the catalog.
            </div>
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-12 gap-4" style={{ gridAutoRows: "minmax(160px, auto)" }}>
          {layout.map((id, i) => {
            const w = WIDGET_REGISTRY[id];
            if (w === undefined) return null;
            const sz: WidgetSize = sizes[id] ?? w.defaultSize ?? w.size;
            const cols = SIZE_TO_COLS[sz];
            // On phones a KPI tile (span 3) shows 2-up; everything wider stacks
            // full-width. `md+` uses the real /12 span (see `.dash-cell` in globals).
            const mobileCols = cols <= 3 ? 6 : 12;
            const isDropTarget = dragOverIdx === i && draggedIdx !== i;
            return (
              <div
                key={id}
                style={{ ["--col" as string]: cols, ["--col-m" as string]: mobileCols, position: "relative" }}
                className={`dash-cell ${isDropTarget ? "rounded-[7px] outline-2 outline-dashed outline-[var(--accent)]" : ""}`}
                onDragOver={
                  editing
                    ? (e) => {
                        e.preventDefault();
                        if (draggedIdx !== null && i !== draggedIdx) setDragOverIdx(i);
                      }
                    : undefined
                }
                onDrop={editing ? (e) => { e.preventDefault(); onDrop(i); } : undefined}
              >
                <div
                  draggable={editing}
                  onDragStart={editing ? () => setDraggedIdx(i) : undefined}
                  onDragEnd={editing ? () => { setDraggedIdx(null); setDragOverIdx(null); } : undefined}
                >
                  <WidgetShell
                    title={w.label}
                    subtitle={editing ? `${cols}/12 cols` : undefined}
                    editing={editing}
                    size={sz}
                    dragging={draggedIdx === i}
                    onRemove={() => removeWidget(id)}
                    onResize={() => toggleSize(id)}
                  >
                    {w.render(ctx)}
                  </WidgetShell>
                </div>
              </div>
            );
          })}

          {editing && (
            <button
              onClick={() => setShowCatalog(true)}
              className="col-span-6 flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-[7px] text-[13px] font-medium text-muted transition-colors"
              style={{ border: "2px dashed var(--border-strong)", background: "transparent" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--accent)";
                e.currentTarget.style.color = "var(--accent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-strong)";
                e.currentTarget.style.color = "var(--text-muted)";
              }}
            >
              <Plus size={20} />
              <span>Add widget</span>
            </button>
          )}
        </div>
      </div>

      {showCatalog && <WidgetCatalog onAdd={addWidget} onClose={() => setShowCatalog(false)} currentLayout={layout} />}
      {showPresets && (
        <PresetSelector current={preset} onPick={applyPreset} onClose={() => setShowPresets(false)} />
      )}
    </div>
  );
}

function WidgetShell({
  title,
  subtitle,
  children,
  editing,
  onRemove,
  onResize,
  size,
  dragging,
}: {
  title: string;
  subtitle?: string | undefined;
  children: React.ReactNode;
  editing: boolean;
  onRemove: () => void;
  onResize: () => void;
  size: WidgetSize;
  dragging: boolean;
}): React.ReactElement {
  return (
    <div
      className="k-surface flex flex-col overflow-hidden p-0 transition-all"
      style={{ position: "relative", opacity: dragging ? 0.5 : 1 }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {editing && (
            <span className="flex cursor-grab text-muted" title="Drag to move">
              <GripVertical size={14} />
            </span>
          )}
          <div className="min-w-0">
            <div className="text-[14px] font-semibold leading-tight">{title}</div>
            {subtitle !== undefined && <div className="mt-0.5 text-[11px] text-muted">{subtitle}</div>}
          </div>
        </div>
        {editing && (
          <div className="flex gap-1">
            <button
              onClick={onResize}
              className="k-btn-icon k-btn-plain k-btn-sm"
              title="Resize"
              style={{ height: 26, width: 26 }}
            >
              {size === "wide" || size === "full" ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
            </button>
            <button
              onClick={onRemove}
              className="k-btn-icon k-btn-plain k-btn-sm"
              title="Remove"
              style={{ height: 26, width: 26, color: "var(--danger-600)" }}
            >
              <X size={13} />
            </button>
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

function WidgetCatalog({
  onAdd,
  onClose,
  currentLayout,
}: {
  onAdd: (id: string) => void;
  onClose: () => void;
  currentLayout: string[];
}): React.ReactElement {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[90] flex items-center justify-center"
      style={{ background: "rgba(15,23,42,0.4)", backdropFilter: "blur(4px)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-[720px] max-w-[90vw] flex-col overflow-hidden rounded-[7px] bg-surface"
        style={{ boxShadow: "var(--shadow-xl)" }}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <div className="text-[16px] font-semibold">Add widget</div>
            <div className="text-[12px] text-muted">Pick from {Object.keys(WIDGET_REGISTRY).length} available widgets</div>
          </div>
          <button onClick={onClose} className="k-btn-icon k-btn-plain">
            <X size={16} />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2.5 overflow-y-auto p-4 sm:grid-cols-2">
          {Object.entries(WIDGET_REGISTRY).map(([k, w]) => {
            const inLayout = currentLayout.includes(k);
            const WIcon = w.icon;
            return (
              <button
                key={k}
                onClick={() => !inLayout && onAdd(k)}
                disabled={inLayout}
                className="flex items-start gap-3 rounded-md border border-border p-3.5 text-left transition-all"
                style={{ background: inLayout ? "var(--bg-subtle)" : "var(--surface)", opacity: inLayout ? 0.6 : 1, cursor: inLayout ? "not-allowed" : "pointer" }}
                onMouseEnter={(e) => { if (!inLayout) e.currentTarget.style.borderColor = w.color; }}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
              >
                <div
                  className="flex shrink-0 items-center justify-center rounded-md"
                  style={{ width: 32, height: 32, background: w.color + "18", color: w.color }}
                >
                  <WIcon size={16} strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 text-[13px] font-semibold">{w.label}</div>
                  <div className="text-[11px] leading-snug text-muted">{w.description}</div>
                </div>
                {inLayout && (
                  <span className="k-chip" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)", height: 20, fontSize: 10 }}>
                    Added
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PresetSelector({
  current,
  onPick,
  onClose,
}: {
  current: string;
  onPick: (k: string) => void;
  onClose: () => void;
}): React.ReactElement {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[90] flex items-center justify-center"
      style={{ background: "rgba(15,23,42,0.4)", backdropFilter: "blur(4px)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[600px] max-w-[90vw] overflow-hidden rounded-[7px] bg-surface"
        style={{ boxShadow: "var(--shadow-xl)" }}
      >
        <div className="border-b border-border px-5 py-4">
          <div className="text-[16px] font-semibold">Choose a layout preset</div>
          <div className="text-[12px] text-muted">Tailored views for different roles. You can customize after applying.</div>
        </div>
        <div className="flex flex-col gap-1.5 p-3">
          {Object.entries(PRESETS).map(([k, p]) => {
            const active = current === k;
            const PIcon = p.icon;
            return (
              <button
                key={k}
                onClick={() => { onPick(k); onClose(); }}
                className="flex items-center gap-3.5 rounded-md p-3.5 text-left transition-all"
                style={{
                  background: active ? "var(--accent-soft)" : "var(--surface)",
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--bg-subtle)"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "var(--surface)"; }}
              >
                <div
                  className="flex items-center justify-center rounded-md"
                  style={{ width: 38, height: 38, background: "var(--accent-soft)", color: "var(--accent)" }}
                >
                  <PIcon size={18} strokeWidth={1.75} />
                </div>
                <div className="flex-1">
                  <div className="mb-0.5 text-[14px] font-semibold">{p.label}</div>
                  <div className="text-[12px] text-muted">{p.description} · {p.layout.length} widgets</div>
                </div>
                {active && <Check size={16} strokeWidth={2.5} style={{ color: "var(--accent)" }} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
