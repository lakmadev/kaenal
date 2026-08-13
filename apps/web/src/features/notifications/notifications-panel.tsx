"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, X } from "lucide-react";
import type { NotificationDto } from "@kaenal/types";
import { relativeTime } from "@/lib/format";
import { entityHref } from "@/lib/entity-routes";
import { useMemberLookup } from "@/hooks/use-members";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  notificationItems,
} from "@/hooks/use-notifications";
import { notifMeta, isAssignment, NotifAvatar } from "./notification-bits";

type Filter = "all" | "unread" | "assigned";

/**
 * The bell dropdown (notifications.jsx `NotificationsPanel`): the most recent
 * notifications with All / Unread / Assigned filters, mark-all-read, and
 * click-through that marks the row read and opens the linked record. Deeper
 * management (star, dismiss, type rail) lives on the full center page.
 */
export function NotificationsPanel({ onClose }: { onClose: () => void }): React.ReactElement {
  const router = useRouter();
  const { data, isLoading } = useNotifications({ limit: 30 });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const members = useMemberLookup();
  const [filter, setFilter] = useState<Filter>("all");

  const all = notificationItems(data);
  const unreadCount = all.filter((n) => n.readAt === null).length;

  const filtered = useMemo(() => {
    if (filter === "unread") return all.filter((n) => n.readAt === null);
    if (filter === "assigned") return all.filter((n) => isAssignment(n.kind));
    return all;
  }, [all, filter]);

  const open = (n: NotificationDto): void => {
    if (n.readAt === null) markRead.mutate(n.id);
    const href = n.entityKind !== null && n.entityId !== null ? entityHref(n.entityKind, n.entityId) : null;
    onClose();
    if (href !== null) router.push(href);
  };

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "unread", label: `Unread (${unreadCount})` },
    { id: "assigned", label: "Assigned" },
  ];

  return (
    <>
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        className="fixed inset-0 z-40 cursor-default"
      />
      <div
        role="menu"
        className="k-surface fade-in fixed right-2 top-14 z-50 flex max-h-[calc(100vh-80px)] w-[min(420px,calc(100vw-16px))] flex-col p-0 shadow-xl sm:right-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell size={16} />
            <h3 className="text-[14px] font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <span className="rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => markAll.mutate()}
              disabled={unreadCount === 0 || markAll.isPending}
              className="k-btn k-btn-plain px-2 text-[11.5px] text-accent disabled:opacity-40"
            >
              Mark all read
            </button>
            <button type="button" onClick={onClose} className="k-btn k-btn-plain k-btn-icon" aria-label="Close">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-1 px-3 pt-2.5">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-md px-2.5 py-1 text-[11.5px] font-medium ${
                filter === f.id ? "bg-accent-soft text-accent" : "text-muted hover:text-text"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto py-1">
          {isLoading ? (
            <div className="px-4 py-10 text-center text-[13px] text-muted">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-10 text-center text-muted">
              <Check size={26} />
              <div className="text-[13px]">You&apos;re all caught up</div>
            </div>
          ) : (
            filtered.map((n) => {
              const meta = notifMeta(n.kind, n.entityKind);
              const actorName = n.actorId !== null ? members.nameOf(n.actorId) : null;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => open(n)}
                  className="flex w-full items-start gap-2.5 px-4 py-3 text-left hover:bg-bg-subtle"
                  style={{
                    borderLeft: `3px solid ${n.readAt === null ? meta.color : "transparent"}`,
                    background: n.readAt === null ? "var(--accent-soft)" : undefined,
                  }}
                >
                  <NotifAvatar meta={meta} actorName={actorName} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className={`text-[13px] leading-snug ${n.readAt === null ? "font-semibold" : "font-medium"}`}>
                      {n.title}
                    </div>
                    {n.body !== null && n.body !== "" && (
                      <div className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-muted">{n.body}</div>
                    )}
                    <div className="mt-1 text-[10.5px] text-muted">{relativeTime(n.createdAt)}</div>
                  </div>
                  {n.readAt === null && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: meta.color }} />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
          <button
            type="button"
            onClick={() => {
              onClose();
              router.push("/notifications");
            }}
            className="text-[12px] font-semibold text-accent"
          >
            See all notifications →
          </button>
          <span className="text-[11px] text-muted">{all.length} shown</span>
        </div>
      </div>
    </>
  );
}
