"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ArrowRight,
  LayoutDashboard,
  ClipboardCheck,
  TriangleAlert,
  Brain,
  ClipboardList,
  FileText,
  Truck,
  BarChart3,
  Bell,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useUiStore } from "@/lib/stores/ui";
import { useSearch, useDebouncedValue } from "@/hooks/use-search";
import { entityHref, entityIcon, entityLabel } from "@/lib/entity-routes";

interface PaletteItem {
  id: string;
  label: string;
  sublabel?: string;
  icon: LucideIcon;
  href: string;
}

/** Curated navigation targets shown when the box is empty and matched by label
 *  once the user types (so "8d" surfaces both the nav shortcut and records). */
const QUICK_ACTIONS: PaletteItem[] = [
  { id: "nav-dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { id: "nav-inspections", label: "Inspections", icon: ClipboardCheck, href: "/inspections" },
  { id: "nav-ncrs", label: "Non-Conformities (NCRs)", icon: TriangleAlert, href: "/ncrs" },
  { id: "nav-8d", label: "8D Reports", icon: Brain, href: "/8d" },
  { id: "nav-capa", label: "CAPA", icon: ClipboardList, href: "/capa" },
  { id: "nav-documents", label: "Documents", icon: FileText, href: "/documents" },
  { id: "nav-suppliers", label: "Suppliers", icon: Truck, href: "/suppliers" },
  { id: "nav-reports", label: "Reports", icon: BarChart3, href: "/reports" },
  { id: "nav-notifications", label: "Notifications", icon: Bell, href: "/notifications" },
  { id: "nav-settings", label: "Settings", icon: Settings, href: "/settings/profile" },
];

/**
 * The ⌘K command palette (04, notifications.jsx `CommandPalette`). It is mounted
 * once in the shell and always listens for the global ⌘K/Ctrl-K toggle; the modal
 * itself renders only when open. Typing federates over `GET /v1/search`
 * (inspections, NCRs, CAPAs, documents) and matches navigation shortcuts by
 * label. ↑/↓ move the selection, ↵ opens it, esc closes.
 */
export function CommandPalette(): React.ReactElement {
  const router = useRouter();
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const toggle = useUiStore((s) => s.toggleCommand);

  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const debounced = useDebouncedValue(query);
  const { data, isFetching } = useSearch(debounced);

  // Global ⌘K / Ctrl-K toggle — active whether or not the palette is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  // Reset + focus on each open.
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      const t = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open]);

  const q = query.trim().toLowerCase();

  const actions = useMemo(
    () => (q === "" ? QUICK_ACTIONS : QUICK_ACTIONS.filter((a) => a.label.toLowerCase().includes(q))),
    [q],
  );

  const records = useMemo<PaletteItem[]>(() => {
    if (q === "" || data === undefined) return [];
    return data.items.map((it) => ({
      id: `${it.kind}-${it.id}`,
      label: it.title,
      sublabel: `${entityLabel(it.kind)} · ${it.code}`,
      icon: entityIcon(it.kind),
      href: entityHref(it.kind, it.id) ?? "#",
    }));
  }, [q, data]);

  const flat = useMemo(() => [...actions, ...records], [actions, records]);

  // Keep the selection in range as results change.
  useEffect(() => {
    setSelectedIdx((i) => (i >= flat.length ? Math.max(0, flat.length - 1) : i));
  }, [flat.length]);

  const run = (item: PaletteItem): void => {
    setOpen(false);
    if (item.href !== "#") router.push(item.href);
  };

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flat[selectedIdx];
      if (item !== undefined) run(item);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  if (!open) return <></>;

  let runningIdx = -1;
  const renderGroup = (label: string, items: PaletteItem[]): React.ReactElement | null => {
    if (items.length === 0) return null;
    return (
      <div>
        <div className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
          {label}
        </div>
        {items.map((item) => {
          runningIdx += 1;
          const idx = runningIdx;
          const selected = idx === selectedIdx;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => run(item)}
              onMouseEnter={() => setSelectedIdx(idx)}
              className={`flex w-full items-center gap-3 px-4 py-2 text-left ${
                selected ? "bg-accent-soft text-accent" : "text-text"
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                  selected ? "bg-accent text-[var(--accent-fg)]" : "bg-bg-subtle text-muted"
                }`}
              >
                <Icon size={14} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{item.label}</span>
                {item.sublabel !== undefined && (
                  <span className="mono block truncate text-[11px] text-muted">{item.sublabel}</span>
                )}
              </span>
              <ArrowRight size={14} className="shrink-0 text-subtle" />
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={() => setOpen(false)}
        className="fixed inset-0 z-[200] cursor-default bg-[rgba(15,23,42,0.4)] backdrop-blur-[3px]"
      />
      <div
        role="dialog"
        aria-label="Command palette"
        className="k-surface fade-in fixed left-1/2 top-[15vh] z-[201] flex max-h-[70vh] w-[min(640px,92vw)] -translate-x-1/2 flex-col p-0 shadow-2xl"
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <Search size={18} className="text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIdx(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search NCRs, inspections, CAPAs, documents…"
            className="flex-1 border-none bg-transparent py-1 text-[15px] text-text outline-none placeholder:text-muted"
          />
          <span className="kbd">ESC</span>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {flat.length === 0 ? (
            <div className="px-4 py-10 text-center text-[13px] text-muted">
              {q === "" ? "Type to search…" : isFetching ? "Searching…" : `No results for "${query.trim()}"`}
            </div>
          ) : (
            <>
              {renderGroup("Navigation", actions)}
              {renderGroup("Records", records)}
            </>
          )}
        </div>

        <div className="flex items-center gap-3.5 border-t border-border px-4 py-2 text-[11px] text-muted">
          <span>
            <span className="kbd mr-1">↑</span>
            <span className="kbd">↓</span> navigate
          </span>
          <span>
            <span className="kbd">↵</span> select
          </span>
          <span>
            <span className="kbd">esc</span> close
          </span>
          <span className="ml-auto">{flat.length} results</span>
        </div>
      </div>
    </>
  );
}
