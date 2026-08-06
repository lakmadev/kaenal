"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Star,
  Check,
  Trash2,
  RefreshCw,
  Search,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { NotificationDto } from "@kaenal/types";
import { relativeTime } from "@/lib/format";
import { entityHref, entityIcon, entityLabel } from "@/lib/entity-routes";
import { useMemberLookup } from "@/hooks/use-members";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useStarNotification,
  useDismissNotification,
  notificationItems,
} from "@/hooks/use-notifications";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui";
import { notifMeta, NotifAvatar } from "./notification-bits";

type View = "all" | "unread" | "starred";

/**
 * The full-page notifications center (notifications-center.jsx): a type rail on
 * the left, the inbox on the right with per-row star / mark-read / dismiss and
 * bulk actions. Everything is backed by `/v1/notifications` — one page (100) is
 * fetched and filtered client-side, so the rail counts are exact.
 */
export function NotificationsCenter(): React.ReactElement {
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching } = useNotifications({ limit: 100 });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const star = useStarNotification();
  const dismiss = useDismissNotification();
  const members = useMemberLookup();

  const [view, setView] = useState<View>("all");
  const [type, setType] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const all = notificationItems(data);
  const unreadCount = all.filter((n) => n.readAt === null).length;
  const starredCount = all.filter((n) => n.starred).length;

  // Distinct entity kinds present, with counts, for the "By type" rail.
  const typeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of all) {
      if (n.entityKind !== null) m.set(n.entityKind, (m.get(n.entityKind) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [all]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((n) => {
      if (view === "unread" && n.readAt !== null) return false;
      if (view === "starred" && !n.starred) return false;
      if (type !== null && n.entityKind !== type) return false;
      if (q !== "" && !`${n.title} ${n.body ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [all, view, type, search]);

  const toggleSelect = (id: string): void =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearSelection = (): void => setSelected(new Set());
  const selectAll = (): void => setSelected(new Set(filtered.map((n) => n.id)));

  const openRow = (n: NotificationDto): void => {
    if (n.readAt === null) markRead.mutate(n.id);
    const href = n.entityKind !== null && n.entityId !== null ? entityHref(n.entityKind, n.entityId) : null;
    if (href !== null) router.push(href);
  };

  const bulkRead = (): void => {
    for (const id of selected) {
      const n = all.find((x) => x.id === id);
      if (n !== undefined && n.readAt === null) markRead.mutate(id);
    }
    clearSelection();
  };
  const bulkDismiss = (): void => {
    for (const id of selected) dismiss.mutate(id);
    clearSelection();
  };

  const railTop: { id: View; icon: LucideIcon; label: string; count: number }[] = [
    { id: "all", icon: Bell, label: "All", count: all.length },
    { id: "unread", icon: Bell, label: "Unread", count: unreadCount },
    { id: "starred", icon: Star, label: "Starred", count: starredCount },
  ];

  return (
    <div className="flex flex-col md:h-[calc(100vh-56px)] md:flex-row">
      {/* Rail */}
      <aside className="shrink-0 border-b border-border bg-surface md:w-60 md:overflow-y-auto md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <h2 className="text-[16px] font-bold">Inbox</h2>
          {unreadCount > 0 && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-[var(--accent-fg)]">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:gap-0 md:overflow-visible md:px-0">
          {railTop.map((r) => (
            <RailItem
              key={r.id}
              icon={r.icon}
              label={r.label}
              count={r.count}
              active={view === r.id && type === null}
              onClick={() => {
                setView(r.id);
                setType(null);
              }}
            />
          ))}
        </div>
        {typeCounts.length > 0 && (
          <>
            <div className="px-4 pb-1.5 pt-3 text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted">
              By type
            </div>
            <div className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:gap-0 md:overflow-visible md:px-0">
              {typeCounts.map(([kind, count]) => (
                <RailItem
                  key={kind}
                  icon={entityIcon(kind)}
                  label={`${entityLabel(kind)}s`}
                  count={count}
                  active={type === kind}
                  onClick={() => {
                    setType(kind);
                    setView("all");
                  }}
                />
              ))}
            </div>
          </>
        )}
        <div className="mt-2 border-t border-border p-3">
          <button
            type="button"
            onClick={() => router.push("/settings/notifications")}
            className="k-btn k-btn-secondary w-full justify-start"
          >
            <Settings size={13} /> Notification settings
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col md:overflow-hidden">
        <div className="px-4 pt-5 sm:px-7">
          <PageHeader
            title="Notifications"
            description={`${filtered.length} shown · ${unreadCount} unread`}
            actions={
              selected.size > 0 ? (
                <>
                  <span className="text-[12px] text-muted">{selected.size} selected</span>
                  <button type="button" onClick={bulkRead} className="k-btn k-btn-secondary">
                    <Check size={13} /> Mark read
                  </button>
                  <button type="button" onClick={bulkDismiss} className="k-btn k-btn-secondary">
                    <Trash2 size={13} /> Dismiss
                  </button>
                  <button type="button" onClick={clearSelection} className="k-btn k-btn-plain k-btn-icon">
                    ✕
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => markAll.mutate()}
                    disabled={unreadCount === 0 || markAll.isPending}
                    className="k-btn k-btn-secondary disabled:opacity-40"
                  >
                    <Check size={13} /> Mark all read
                  </button>
                  <button
                    type="button"
                    onClick={() => void refetch()}
                    className="k-btn k-btn-secondary"
                    disabled={isRefetching}
                  >
                    <RefreshCw size={13} className={isRefetching ? "animate-spin" : ""} /> Refresh
                  </button>
                </>
              )
            }
          />
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-7">
          <input
            type="checkbox"
            aria-label="Select all"
            checked={selected.size > 0 && selected.size === filtered.length}
            onChange={(e) => (e.target.checked ? selectAll() : clearSelection())}
          />
          <div className="relative max-w-80 flex-1">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-2.5 text-muted" />
            <input
              className="k-input h-8 w-full pl-8 text-[12.5px]"
              placeholder="Search notifications…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 md:overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2 p-4 sm:px-7">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-20 text-center text-muted">
              <Check size={32} />
              <div className="text-[14px]">You&apos;re all caught up</div>
              <div className="text-[12px]">No notifications match this filter.</div>
            </div>
          ) : (
            filtered.map((n) => {
              const meta = notifMeta(n.kind, n.entityKind);
              const actorName = n.actorId !== null ? members.nameOf(n.actorId) : null;
              return (
                <div
                  key={n.id}
                  className="flex items-start gap-3 border-b border-border px-4 py-3 hover:bg-bg-subtle sm:px-7"
                  style={{ background: n.readAt === null ? "var(--accent-soft)" : undefined }}
                >
                  <input
                    type="checkbox"
                    className="mt-2"
                    aria-label="Select notification"
                    checked={selected.has(n.id)}
                    onChange={() => toggleSelect(n.id)}
                  />
                  <button
                    type="button"
                    onClick={() => star.mutate({ id: n.id, starred: !n.starred })}
                    className="mt-1 shrink-0"
                    style={{ color: n.starred ? "#f59e0b" : "var(--text-muted)" }}
                    aria-label={n.starred ? "Un-star" : "Star"}
                  >
                    <Star size={15} fill={n.starred ? "#f59e0b" : "none"} />
                  </button>
                  <NotifAvatar meta={meta} actorName={actorName} size={36} />
                  <button type="button" onClick={() => openRow(n)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className={`text-[13.5px] ${n.readAt === null ? "font-bold" : "font-medium"}`}>
                        {n.title}
                      </span>
                      {n.readAt === null && <span className="h-2 w-2 rounded-full bg-accent" />}
                    </div>
                    {n.body !== null && n.body !== "" && (
                      <div className="mt-0.5 text-[12.5px] leading-snug text-muted">{n.body}</div>
                    )}
                    <div className="mt-1 flex items-center gap-2.5 text-[11px] text-muted">
                      <span>{relativeTime(n.createdAt)}</span>
                      {n.entityKind !== null && <span className="mono">{entityLabel(n.entityKind)}</span>}
                    </div>
                  </button>
                  <div className="flex shrink-0 gap-1">
                    {n.readAt === null && (
                      <button
                        type="button"
                        onClick={() => markRead.mutate(n.id)}
                        className="k-btn k-btn-plain k-btn-icon"
                        aria-label="Mark read"
                      >
                        <Check size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => dismiss.mutate(n.id)}
                      className="k-btn k-btn-plain k-btn-icon"
                      aria-label="Dismiss"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function RailItem({
  icon: Icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap px-4 py-2 text-[13px] md:w-full ${
        active ? "font-semibold text-accent" : "font-medium text-text hover:bg-bg-subtle"
      }`}
      style={{ borderLeft: active ? "3px solid var(--accent)" : "3px solid transparent", background: active ? "var(--accent-soft)" : undefined }}
    >
      <Icon size={14} />
      <span className="flex-1 text-left">{label}</span>
      {count > 0 && <span className={active ? "text-accent" : "text-muted"}>{count}</span>}
    </button>
  );
}
