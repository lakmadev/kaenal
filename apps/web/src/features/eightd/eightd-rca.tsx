"use client";

import { useState } from "react";
import {
  BarChart3,
  Check,
  Clock,
  GitBranch,
  List,
  Package,
  Pencil,
  Plus,
  Settings,
  Sun,
  Target,
  TriangleAlert,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

/**
 * D4 root-cause analysis workspace (jsx `eightd.jsx` D4Step + method cards).
 * A user composes any number of methods; each is an interactive builder. The
 * whole composition (its content) is lifted to the D4 panel via `onChange` so it
 * persists into `steps.d4.data.analyses` through the normal step mutation.
 */

export type RcaType = "fivewhys" | "fishbone" | "pareto" | "fiveW2H" | "timeline" | "freeform";

export interface Analysis {
  readonly id: number;
  readonly type: RcaType;
  title: string;
  content?: unknown;
}

interface Method {
  readonly type: RcaType;
  readonly name: string;
  readonly icon: LucideIcon;
  readonly color: string;
  readonly desc: string;
}

export const ANALYSIS_METHODS: readonly Method[] = [
  { type: "fivewhys", name: "5 Whys", icon: GitBranch, color: "#2563eb", desc: 'Iteratively ask "why" to drill from symptom to systemic root.' },
  { type: "fishbone", name: "Fishbone (Ishikawa)", icon: Target, color: "#0891b2", desc: "Brainstorm candidate causes across the 6M categories." },
  { type: "pareto", name: "Pareto Analysis", icon: BarChart3, color: "#d97706", desc: "Rank causes by frequency to isolate the vital few (80/20)." },
  { type: "fiveW2H", name: "5W2H", icon: List, color: "#16a34a", desc: "Structured Who / What / When / Where / Why / How / How much." },
  { type: "timeline", name: "Timeline & Change", icon: Clock, color: "#9333ea", desc: "Sequence events and pinpoint what changed before failure." },
  { type: "freeform", name: "Free-form notes", icon: Pencil, color: "#64748b", desc: "Open narrative for evidence and reasoning." },
];

export function tintColor(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// ——— method picker popover ———
export function MethodPicker({ onPick }: { onPick: (m: Method) => void }): React.ReactElement {
  return (
    <div
      className="k-surface absolute right-0 top-full z-40 mt-2 flex w-[340px] flex-col gap-0.5 p-2"
      style={{ boxShadow: "var(--shadow-lg)" }}
    >
      <div className="k-overline px-2 pb-1 pt-1.5">Add analysis method</div>
      {ANALYSIS_METHODS.map((m) => {
        const I = m.icon;
        return (
          <button
            key={m.type}
            onClick={() => onPick(m)}
            className="flex items-start gap-2.5 rounded-md p-2 text-left transition-colors hover:bg-[var(--bg-subtle)]"
          >
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[var(--r-sm)]" style={{ background: tintColor(m.color, 0.13), color: m.color }}>
              <I size={14} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold">{m.name}</span>
              <span className="block text-[11px] leading-snug text-muted">{m.desc}</span>
            </span>
            <Plus size={14} />
          </button>
        );
      })}
    </div>
  );
}

export function methodFor(type: RcaType): Method {
  return ANALYSIS_METHODS.find((m) => m.type === type) ?? ANALYSIS_METHODS[0]!;
}

/** Renders the interactive builder for one analysis, controlled via onChange. */
export function RcaBuilder({ a, onChange }: { a: Analysis; onChange: (content: unknown) => void }): React.ReactElement {
  switch (a.type) {
    case "fivewhys":
      return <FiveWhysCard value={a.content as WhyRow[] | undefined} onChange={onChange} />;
    case "fishbone":
      return <Fishbone value={a.content as FishboneState | undefined} onChange={onChange} />;
    case "pareto":
      return <ParetoCard value={a.content as Factor[] | undefined} onChange={onChange} />;
    case "fiveW2H":
      return <FiveW2HCard value={a.content as Record<string, string> | undefined} onChange={onChange} />;
    case "timeline":
      return <TimelineCard value={a.content as TimelineEvent[] | undefined} onChange={onChange} />;
    case "freeform":
      return <FreeformCard value={a.content as string | undefined} onChange={onChange} />;
    default:
      return <></>;
  }
}

// ——————————————————————————————————— 5 Whys
interface WhyRow {
  why: string;
  answer: string;
}
function FiveWhysCard({ value, onChange }: { value?: WhyRow[] | undefined; onChange: (v: WhyRow[]) => void }): React.ReactElement {
  const [rows, setRows] = useState<WhyRow[]>(() => (value && value.length ? value.map((r) => ({ why: r.why ?? "", answer: r.answer ?? "" })) : [{ why: "", answer: "" }]));
  const push = (next: WhyRow[]): void => {
    setRows(next);
    onChange(next);
  };
  const update = (i: number, field: keyof WhyRow, val: string): void => push(rows.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)));
  const addRow = (): void => push([...rows, { why: "", answer: "" }]);
  const removeRow = (i: number): void => push(rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows);
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((row, i) => (
        <div key={i} className="flex items-start gap-3">
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
            style={{
              background: row.answer ? "var(--accent)" : "var(--bg-subtle)",
              color: row.answer ? "white" : "var(--text-muted)",
              border: row.answer ? "none" : "2px dashed var(--border-strong)",
            }}
          >
            {i + 1}
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <input className="k-input" placeholder={`Why ${i + 1}?`} value={row.why} onChange={(e) => update(i, "why", e.target.value)} />
            <input className="k-input" placeholder={i === rows.length - 1 ? 'Answer — becomes the next "why"' : "Answer"} value={row.answer} onChange={(e) => update(i, "answer", e.target.value)} />
          </div>
          <button className="k-btn-plain mt-0.5 p-1.5" title="Remove" onClick={() => removeRow(i)} disabled={rows.length <= 1} style={{ color: "var(--text-subtle)", opacity: rows.length <= 1 ? 0.3 : 1 }}>
            <X size={14} />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2.5">
        <button className="k-btn k-btn-ghost k-btn-sm" onClick={addRow}>
          <Plus size={12} />Add why
        </button>
        {rows.length >= 5 && (
          <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--success-600)" }}>
            <Check size={12} />Reached 5 whys — likely at systemic root
          </span>
        )}
      </div>
    </div>
  );
}

// ——————————————————————————————————— Pareto
interface Factor {
  label: string;
  count: number;
}
function ParetoCard({ value, onChange }: { value?: Factor[] | undefined; onChange: (v: Factor[]) => void }): React.ReactElement {
  const [factors, setFactors] = useState<Factor[]>(
    () =>
      value ?? [
        { label: "Regulator drift", count: 14 },
        { label: "Checklist skipped", count: 8 },
        { label: "Gas blend variation", count: 5 },
        { label: "Wire feed low", count: 3 },
        { label: "Floor draft", count: 2 },
      ],
  );
  const [label, setLabel] = useState("");
  const [count, setCount] = useState("");
  const push = (next: Factor[]): void => {
    setFactors(next);
    onChange(next);
  };
  const sorted = [...factors].sort((a, b) => b.count - a.count);
  const total = sorted.reduce((s, f) => s + f.count, 0) || 1;
  const max = sorted.length ? sorted[0]!.count : 1;
  let cum = 0;
  const rows = sorted.map((f) => {
    cum += f.count;
    return { ...f, cumPct: (cum / total) * 100 };
  });
  const add = (): void => {
    const n = parseInt(count, 10);
    if (!label.trim() || !n) return;
    push([...factors, { label: label.trim(), count: n }]);
    setLabel("");
    setCount("");
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="text-[11.5px] text-muted">
        Causes ranked by occurrence. The <strong>vital few</strong> (cumulative ≤ 80%) are highlighted — focus corrective action there.
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((f, idx) => {
          const vital = f.cumPct <= 80 || idx === 0;
          return (
            <div key={f.label} className="flex items-center gap-2.5">
              <div className="w-[140px] flex-shrink-0 truncate text-right text-[12.5px]" style={{ fontWeight: vital ? 600 : 400, color: vital ? "var(--text)" : "var(--text-muted)" }}>
                {f.label}
              </div>
              <div className="relative h-[26px] flex-1 overflow-hidden rounded-[var(--r-sm)]" style={{ background: "var(--bg-subtle)" }}>
                <div className="absolute inset-y-0 left-0 rounded-[var(--r-sm)] transition-[width]" style={{ width: `${(f.count / max) * 100}%`, background: vital ? "var(--accent)" : "var(--border-strong)" }} />
                <span className="mono absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold" style={{ color: vital ? "white" : "var(--text-muted)" }}>
                  {f.count}
                </span>
              </div>
              <div className="mono w-[46px] flex-shrink-0 text-right text-[11px] text-muted">{f.cumPct.toFixed(0)}%</div>
              <button className="k-btn-plain flex-shrink-0 p-1" onClick={() => push(factors.filter((x) => x.label !== f.label))} style={{ color: "var(--text-subtle)" }}>
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5">
        <input className="k-input h-[34px] flex-1" placeholder="Cause / factor" value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <input className="k-input h-[34px] w-[90px]" placeholder="Count" type="number" value={count} onChange={(e) => setCount(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="k-btn k-btn-ghost k-btn-sm" onClick={add}>
          <Plus size={12} />Add
        </button>
      </div>
    </div>
  );
}

// ——————————————————————————————————— 5W2H
function FiveW2HCard({ value, onChange }: { value?: Record<string, string> | undefined; onChange: (v: Record<string, string>) => void }): React.ReactElement {
  const FIELDS = [
    { k: "what", q: "What is the problem / defect?" },
    { k: "where", q: "Where does it occur?" },
    { k: "when", q: "When was it first seen?" },
    { k: "who", q: "Who detected it / is involved?" },
    { k: "why", q: "Why is it a problem?" },
    { k: "how", q: "How is it detected / manifested?" },
    { k: "howmuch", q: "How much — qty / cost / rate?" },
  ];
  const [vals, setVals] = useState<Record<string, string>>(() => value ?? {});
  const push = (next: Record<string, string>): void => {
    setVals(next);
    onChange(next);
  };
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
      {FIELDS.map((f) => (
        <div key={f.k} className="flex flex-col gap-1.5">
          <label className="k-overline">{f.q}</label>
          <textarea
            className="k-input"
            rows={2}
            value={vals[f.k] ?? ""}
            placeholder="…"
            onChange={(e) => push({ ...vals, [f.k]: e.target.value })}
            style={{ height: "auto", padding: 10, fontSize: 12.5, resize: "vertical", lineHeight: 1.4 }}
          />
        </div>
      ))}
    </div>
  );
}

// ——————————————————————————————————— Timeline
interface TimelineEvent {
  time: string;
  text: string;
  change: boolean;
}
function TimelineCard({ value, onChange }: { value?: TimelineEvent[] | undefined; onChange: (v: TimelineEvent[]) => void }): React.ReactElement {
  const [events, setEvents] = useState<TimelineEvent[]>(
    () =>
      value ?? [
        { time: "2026-04-08", text: "Preventive maintenance on Station 3B regulator deferred", change: true },
        { time: "2026-04-10", text: "First porosity rejects detected at final X-ray", change: false },
        { time: "2026-04-12", text: "Shielding-gas supplier switched to new blend lot", change: true },
        { time: "2026-04-16", text: "Reject rate climbs to 6%; 8D opened", change: false },
      ],
  );
  const [time, setTime] = useState("");
  const [text, setText] = useState("");
  const push = (next: TimelineEvent[]): void => {
    setEvents(next);
    onChange(next);
  };
  const add = (): void => {
    if (!text.trim()) return;
    push([...events, { time: time.trim() || "—", text: text.trim(), change: false }]);
    setTime("");
    setText("");
  };
  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-[11.5px] text-muted">
        Sequence what happened. Flag <strong style={{ color: "var(--warning-700)" }}>changes</strong> — a deviation from the norm is often the root trigger.
      </div>
      <div className="relative pl-[22px]">
        <div className="absolute left-[6px] top-1.5 bottom-[18px] w-0.5" style={{ background: "var(--border)" }} />
        {events.map((ev, i) => (
          <div key={i} className="relative flex items-start gap-3 pb-3.5">
            <div className="absolute left-[-22px] top-[3px] h-3.5 w-3.5 rounded-full" style={{ background: ev.change ? "var(--warning-500)" : "var(--surface)", border: ev.change ? "none" : "2px solid var(--border-strong)", boxShadow: "0 0 0 3px var(--surface)" }} />
            <div className="mono w-[88px] flex-shrink-0 pt-px text-[11px] text-muted">{ev.time}</div>
            <div className="flex-1 text-[12.5px] leading-snug">
              {ev.text}
              {ev.change && (
                <span className="ml-1.5 rounded-[3px] px-1.5 py-px align-middle text-[9px] font-bold tracking-wide" style={{ background: "var(--warning-100)", color: "var(--warning-700)" }}>
                  CHANGE
                </span>
              )}
            </div>
            <button className="k-btn-plain flex-shrink-0 p-1" title={ev.change ? "Unflag change" : "Flag as change"} onClick={() => push(events.map((e, idx) => (idx === i ? { ...e, change: !e.change } : e)))} style={{ color: ev.change ? "var(--warning-600)" : "var(--text-subtle)" }}>
              <TriangleAlert size={12} />
            </button>
            <button className="k-btn-plain flex-shrink-0 p-1" onClick={() => push(events.filter((_, idx) => idx !== i))} style={{ color: "var(--text-subtle)" }}>
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input className="k-input h-[34px] w-[120px]" placeholder="Date / time" value={time} onChange={(e) => setTime(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <input className="k-input h-[34px] flex-1" placeholder="What happened?" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="k-btn k-btn-ghost k-btn-sm" onClick={add}>
          <Plus size={12} />Add
        </button>
      </div>
    </div>
  );
}

// ——————————————————————————————————— Free-form
function FreeformCard({ value, onChange }: { value?: string | undefined; onChange: (v: string) => void }): React.ReactElement {
  const [text, setText] = useState(value ?? "");
  return (
    <textarea
      className="k-input"
      rows={7}
      value={text}
      placeholder="Open narrative for evidence and reasoning…"
      onChange={(e) => {
        setText(e.target.value);
        onChange(e.target.value);
      }}
      style={{ height: "auto", padding: 14, resize: "vertical", lineHeight: 1.6, fontSize: 13 }}
    />
  );
}

// ——————————————————————————————————— Fishbone (6M)
const FB_CATS = [
  { name: "Machine", color: "#2563eb", icon: Settings, hint: "Equipment, tooling, fixtures" },
  { name: "Method", color: "#16a34a", icon: GitBranch, hint: "Process, procedures, SOPs" },
  { name: "Material", color: "#d97706", icon: Package, hint: "Raw stock, consumables" },
  { name: "Man", color: "#9333ea", icon: Users, hint: "People, training, handoffs" },
  { name: "Measurement", color: "#db2777", icon: Target, hint: "Gauges, MSA, data" },
  { name: "Environment", color: "#0891b2", icon: Sun, hint: "Ambient, layout, conditions" },
] as const;

interface FishboneState {
  causes: Record<string, string[]>;
  roots: string[];
}
function Fishbone({ value, onChange }: { value?: FishboneState | undefined; onChange: (v: FishboneState) => void }): React.ReactElement {
  const [causes, setCauses] = useState<Record<string, string[]>>(
    () =>
      value?.causes ?? {
        Machine: ["Regulator drift — Station 3B", "Wire feed speed 10% low", "Gas mixer past service"],
        Method: ["No inline gas-flow monitoring", "Pre-weld checklist skipped"],
        Material: ["Wire batch ER70S-6 edge-of-spec", "Shielding gas blend variation"],
        Man: ["Welder training current", "Shift handoff log incomplete"],
        Measurement: ["Amperage drift not flagged", "Gauge MSA overdue"],
        Environment: ["Humidity nominal", "Floor draft from Bay 4 doors"],
      },
  );
  const [roots, setRoots] = useState<Set<string>>(() => new Set(value?.roots ?? ["Machine::Regulator drift — Station 3B"]));
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const keyOf = (cat: string, text: string): string => `${cat}::${text}`;

  const emit = (nextCauses: Record<string, string[]>, nextRoots: Set<string>): void => {
    onChange({ causes: nextCauses, roots: [...nextRoots] });
  };
  const addCause = (cat: string, raw: string): void => {
    const text = raw.trim();
    if (!text) return;
    const next = causes[cat]?.includes(text) ? causes : { ...causes, [cat]: [...(causes[cat] ?? []), text] };
    setCauses(next);
    emit(next, roots);
    setDraft("");
    setAddingFor(null);
  };
  const removeCause = (cat: string, text: string): void => {
    const next = { ...causes, [cat]: (causes[cat] ?? []).filter((x) => x !== text) };
    const nr = new Set(roots);
    nr.delete(keyOf(cat, text));
    setCauses(next);
    setRoots(nr);
    emit(next, nr);
  };
  const toggleRoot = (cat: string, text: string): void => {
    const k = keyOf(cat, text);
    const nr = new Set(roots);
    if (nr.has(k)) nr.delete(k);
    else nr.add(k);
    setRoots(nr);
    emit(causes, nr);
  };
  const totalCauses = Object.values(causes).reduce((a, list) => a + list.length, 0);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="k-surface flex items-center gap-3.5 p-4" style={{ borderLeft: "3px solid var(--danger-500)" }}>
        <div className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-[var(--r-md)]" style={{ background: "var(--danger-50)", color: "var(--danger-600)" }}>
          <TriangleAlert size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="k-overline" style={{ color: "var(--danger-600)" }}>Effect — problem under analysis</div>
          <div className="mt-0.5 text-[15px] font-bold tracking-tight">
            Weld porosity <span className="font-medium text-muted">· Part #A-7742</span>
          </div>
          <div className="mt-[3px] text-[11.5px] text-muted">
            {FB_CATS.length} categories · {totalCauses} candidate causes · {roots.size} flagged root candidate{roots.size === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(248px, 1fr))" }}>
        {FB_CATS.map((c) => {
          const list = causes[c.name] ?? [];
          const adding = addingFor === c.name;
          const I = c.icon;
          return (
            <div key={c.name} className="k-surface flex flex-col overflow-hidden p-0">
              <div className="flex items-center gap-2.5 border-b px-3.5 py-3" style={{ borderColor: "var(--border)", background: tintColor(c.color, 0.05) }}>
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[var(--r-sm)]" style={{ background: tintColor(c.color, 0.14), color: c.color }}>
                  <I size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold" style={{ color: c.color }}>{c.name}</div>
                  <div className="truncate text-[10px] text-subtle">{c.hint}</div>
                </div>
                <span className="mono inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-muted" style={{ background: "var(--bg-subtle)" }}>
                  {list.length}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-2.5">
                {list.length === 0 && <div className="py-3.5 text-center text-[11.5px] italic text-subtle">No causes yet</div>}
                {list.map((text) => {
                  const isRoot = roots.has(keyOf(c.name, text));
                  return (
                    <div
                      key={text}
                      className="group flex items-center gap-2 rounded-[var(--r-md)] py-[7px] pl-2.5 pr-2"
                      style={{ background: isRoot ? tintColor(c.color, 0.1) : "transparent", border: isRoot ? `1px solid ${tintColor(c.color, 0.4)}` : "1px solid transparent" }}
                    >
                      <span className="h-[7px] w-[7px] flex-shrink-0 rounded-full" style={{ background: isRoot ? c.color : "var(--border-strong)" }} />
                      <span className="flex-1 text-[12.5px] leading-snug" style={{ color: isRoot ? "var(--text)" : "var(--text-muted)", fontWeight: isRoot ? 600 : 400 }}>{text}</span>
                      <button title={isRoot ? "Unflag root candidate" : "Flag as root candidate"} onClick={() => toggleRoot(c.name, text)} className="flex-shrink-0 p-1" style={{ color: isRoot ? c.color : "var(--text-subtle)", opacity: isRoot ? 1 : undefined }}>
                        <TriangleAlert size={13} />
                      </button>
                      <button title="Remove cause" onClick={() => removeCause(c.name, text)} className="flex-shrink-0 p-1 opacity-0 transition-opacity group-hover:opacity-100" style={{ color: "var(--text-subtle)" }}>
                        <X size={13} />
                      </button>
                    </div>
                  );
                })}
                {adding ? (
                  <input
                    className="k-input h-8 text-[12.5px]"
                    autoFocus
                    value={draft}
                    placeholder={`Add ${c.name.toLowerCase()} cause…`}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addCause(c.name, draft);
                      if (e.key === "Escape") {
                        setAddingFor(null);
                        setDraft("");
                      }
                    }}
                    onBlur={() => {
                      if (!draft.trim()) {
                        setAddingFor(null);
                        setDraft("");
                      }
                    }}
                  />
                ) : (
                  <button
                    onClick={() => {
                      setAddingFor(c.name);
                      setDraft("");
                    }}
                    className="mt-0.5 flex w-full items-center gap-1.5 rounded-[var(--r-md)] px-2.5 py-[7px] text-[12px] font-medium"
                    style={{ border: "1px dashed var(--border-strong)", background: "transparent", color: "var(--text-subtle)" }}
                  >
                    <Plus size={12} />Add cause
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
