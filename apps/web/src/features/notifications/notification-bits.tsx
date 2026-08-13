"use client";

import {
  UserPlus,
  TriangleAlert,
  ShieldAlert,
  FileClock,
  Download,
  Bell,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/avatar";
import { entityIcon } from "@/lib/entity-routes";

/** Visual metadata for a notification `kind` (colour dot + glyph + category).
 *  Categories drive the "Assigned" panel filter and the center's type rail. */
export interface NotifMeta {
  icon: LucideIcon;
  color: string;
  category: "assignment" | "alert" | "document" | "export" | "system";
}

export function notifMeta(kind: string, entityKind: string | null): NotifMeta {
  if (kind.endsWith("_assigned")) {
    return { icon: entityKind !== null ? entityIcon(entityKind) : UserPlus, color: "#2563eb", category: "assignment" };
  }
  switch (kind) {
    case "ncr_escalated":
      return { icon: TriangleAlert, color: "#dc2626", category: "alert" };
    case "file_infected":
      return { icon: ShieldAlert, color: "#dc2626", category: "alert" };
    case "document_expiring":
      return { icon: FileClock, color: "#d97706", category: "document" };
    case "export_ready":
      return { icon: Download, color: "#16a34a", category: "export" };
    default:
      return { icon: Bell, color: "var(--accent)", category: "system" };
  }
}

/** True when a notification is an assignment (for the "Assigned" filter). */
export function isAssignment(kind: string): boolean {
  return kind.endsWith("_assigned");
}

/**
 * The leading disc of a notification row: the actor's initials avatar with a
 * small kind badge, or — for system/job notifications with no actor — a tinted
 * kind disc. `actorName` is resolved by the caller via the members directory.
 */
export function NotifAvatar({
  meta,
  actorName,
  size = 36,
}: {
  meta: NotifMeta;
  actorName: string | null;
  size?: number;
}): React.ReactElement {
  const Icon = meta.icon;
  const badge = Math.round(size * 0.5);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {actorName !== null ? (
        <Avatar name={actorName} size={size} />
      ) : (
        <span
          className="flex items-center justify-center rounded-full"
          style={{ width: size, height: size, background: `${meta.color}22`, color: meta.color }}
        >
          <Icon size={Math.round(size * 0.45)} />
        </span>
      )}
      <span
        className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full text-white"
        style={{ width: badge, height: badge, background: meta.color, border: "2px solid var(--surface)" }}
      >
        <Icon size={Math.round(badge * 0.55)} />
      </span>
    </div>
  );
}
