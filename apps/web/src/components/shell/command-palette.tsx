"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Search,
  ArrowRight,
  Moon,
  Keyboard,
  LogOut,
  WifiOff,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { useUiStore } from "@/lib/stores/ui";
import { useTheme } from "@/lib/theme";
import { useMe, hasCapability } from "@/hooks/use-me";
import { useOnline } from "@/hooks/use-online";
import { usePreferences } from "@/hooks/use-preferences";
import { useSignOut } from "@/hooks/use-sign-out";
import { useSearch, useDebouncedValue } from "@/hooks/use-search";
import { roleSeesRoute } from "@/config/rbac";
import { QUICK_CREATE } from "@/config/quick-create";
import { NAV_TARGETS } from "@/config/palette-nav";
import { shortcutKeys, type ShortcutKey } from "@/config/shortcuts";
import { entityHref, entityIcon, entityLabel } from "@/lib/entity-routes";
import { Skeleton } from "@/components/ui";
import { KeyCaps } from "./key-caps";

interface PaletteItem {
  id: string;
  label: string;
  sublabel?: string;
  icon: LucideIcon;
  /** Key caps for a really bound shortcut (deviation D-P1); absent otherwise. */
  keys?: readonly ShortcutKey[];
  run: () => void;
}

/** Quick-create shortcut chips: only the two really bound keys carry one. */
const CREATE_KEYS: Partial<Record<string, readonly ShortcutKey[]>> = {
  inspection: shortcutKeys("newInspection"),
  "8d": shortcutKeys("newEightD"),
};

/**
 * The ⌘K command palette (notifications.jsx `CommandPalette`, boards W4). One
 * palette, three groups: Quick actions (real behaviour, capability-filtered),
 * Navigation (role-filtered) and Records (`GET /v1/search`; kinds without a
 * detail route are left out so no row is a dead click). ↑/↓ move, ↵ runs, esc
 * closes. The ⌘K binding itself lives in `useGlobalShortcuts`.
 */
export function CommandPalette(): React.ReactElement {
  const t = useTranslations("palette");
  const router = useRouter();
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen);
  const { toggleTheme } = useTheme();
  const signOut = useSignOut();
  const { data: me } = useMe();
  const { values: prefs } = usePreferences();
  const online = useOnline();

  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const debounced = useDebouncedValue(query);
  const search = useSearch(online ? debounced : "");

  // Effect is required: moving focus into the input after the modal mounts is a DOM side effect.
  useEffect(() => {
    if (!open) return undefined;
    setQuery("");
    setSelectedIdx(0);
    const timer = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(timer);
  }, [open]);

  const q = query.trim().toLowerCase();
  const matches = (label: string): boolean => q === "" || label.toLowerCase().includes(q);

  const actions: PaletteItem[] = [];
  for (const target of QUICK_CREATE) {
    if (!hasCapability(me, target.capability)) continue;
    actions.push({
      id: `create-${target.id}`,
      label: t(target.labelKey),
      icon: target.icon,
      ...(prefs.keyboardShortcuts && CREATE_KEYS[target.id] !== undefined ? { keys: CREATE_KEYS[target.id] } : {}),
      run: () => router.push(target.href),
    });
  }
  actions.push({ id: "toggle-theme", label: t("toggleTheme"), icon: Moon, run: toggleTheme });
  actions.push({
    id: "shortcuts",
    label: t("openShortcuts"),
    icon: Keyboard,
    ...(prefs.keyboardShortcuts ? { keys: shortcutKeys("shortcuts") } : {}),
    run: () => setShortcutsOpen(true),
  });
  actions.push({ id: "sign-out", label: t("signOut"), icon: LogOut, run: () => signOut.mutate() });
  const shownActions = actions.filter((a) => matches(a.label));

  const shownNav: PaletteItem[] = NAV_TARGETS.filter(
    (n) => roleSeesRoute(me?.role, n.href) && matches(t("goTo", { name: t(n.labelKey) })),
  ).map((n) => ({
    id: n.id,
    label: t("goTo", { name: t(n.labelKey) }),
    icon: n.icon,
    run: () => router.push(n.href),
  }));

  const records = useMemo<PaletteItem[]>(() => {
    if (q === "" || search.data === undefined) return [];
    const rows: PaletteItem[] = [];
    for (const it of search.data.items) {
      const href = entityHref(it.kind, it.id);
      if (href === null) continue; // no detail route yet: never a dead click
      rows.push({
        id: `${it.kind}-${it.id}`,
        label: it.title,
        sublabel: `${entityLabel(it.kind)} · ${it.code}`,
        icon: entityIcon(it.kind),
        run: () => router.push(href),
      });
    }
    return rows;
  }, [q, search.data, router]);

  const flat = [...shownActions, ...shownNav, ...records];
  const selected = Math.min(selectedIdx, Math.max(0, flat.length - 1));

  const run = (item: PaletteItem): void => {
    setOpen(false);
    item.run();
  };

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx(Math.min(selected + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx(Math.max(selected - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flat[selected];
      if (item !== undefined) run(item);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  if (!open) return <></>;

  let runningIdx = -1;
  const renderGroup = (label: string, items: PaletteItem[], footer?: React.ReactNode): React.ReactElement | null => {
    if (items.length === 0 && footer === undefined) return null;
    return (
      <div>
        <div className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">{label}</div>
        {items.map((item) => {
          runningIdx += 1;
          const idx = runningIdx;
          const isSelected = idx === selected;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => run(item)}
              onMouseEnter={() => setSelectedIdx(idx)}
              className={`flex w-full items-center gap-3 px-4 py-2 text-left ${
                isSelected ? "bg-accent-soft text-accent" : "text-text"
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                  isSelected ? "bg-accent text-[var(--accent-fg)]" : "bg-bg-subtle text-muted"
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
              {item.keys !== undefined ? (
                <KeyCaps keys={item.keys} />
              ) : (
                <ArrowRight size={14} className="shrink-0 text-subtle" />
              )}
            </button>
          );
        })}
        {footer}
      </div>
    );
  };

  // Records footer: skeleton while in flight, offline notice, or error + Retry (W4-B/E/F).
  let recordsFooter: React.ReactNode;
  if (q !== "") {
    if (!online) {
      recordsFooter = (
        <div className="flex items-center gap-2.5 px-4 py-2.5 text-[12.5px] text-muted">
          <WifiOff size={14} className="shrink-0" style={{ color: "var(--warning-500)" }} aria-hidden />
          {t("recordsOffline")}
        </div>
      );
    } else if (search.isError) {
      recordsFooter = (
        <div className="flex items-center gap-2.5 px-4 py-2 text-[12.5px] text-muted">
          <span className="flex-1">{t("recordsError")}</span>
          <button type="button" onClick={() => void search.refetch()} className="k-btn k-btn-ghost k-btn-sm">
            <RefreshCw size={13} aria-hidden /> {t("retry")}
          </button>
        </div>
      );
    } else if (search.data === undefined || (search.isFetching && records.length === 0)) {
      recordsFooter = (
        <div className="space-y-2 px-4 py-2" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-7 w-7 rounded-md" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-2.5 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      );
    }
  }
  const hasRecordsBlock = recordsFooter !== undefined;
  const showEmpty = flat.length === 0 && !hasRecordsBlock;

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
        aria-modal="true"
        aria-label={t("title")}
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
            placeholder={t("placeholder")}
            aria-label={t("title")}
            className="flex-1 border-none bg-transparent py-1 text-[15px] text-text outline-none placeholder:text-muted"
          />
          <span className="kbd">ESC</span>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {showEmpty ? (
            <div className="px-4 py-10 text-center text-[13px] text-muted">{t("noResults", { query: query.trim() })}</div>
          ) : (
            <>
              {renderGroup(t("groupActions"), shownActions)}
              {renderGroup(t("groupNavigation"), shownNav)}
              {q !== "" && renderGroup(t("groupRecords"), records, recordsFooter)}
            </>
          )}
        </div>

        <div className="flex items-center gap-3.5 border-t border-border px-4 py-2 text-[11px] text-muted">
          <span>
            <span className="kbd mr-1">↑</span>
            <span className="kbd">↓</span> {t("navigate")}
          </span>
          <span>
            <span className="kbd">↵</span> {t("select")}
          </span>
          <span>
            <span className="kbd">esc</span> {t("close")}
          </span>
          <span className="ml-auto">{t("resultCount", { count: flat.length })}</span>
        </div>
      </div>
    </>
  );
}
