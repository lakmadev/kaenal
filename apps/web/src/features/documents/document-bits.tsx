import {
  BookOpen,
  FileText,
  Wrench,
  ClipboardList,
  FileCheck,
  ShieldCheck,
  Truck,
  Award,
  User,
  File as FileIcon,
  Image as ImageIcon,
  Sheet,
  type LucideIcon,
} from "lucide-react";
import type { DocumentCategory, DocumentStatus } from "@kaenal/types";
import { Chip } from "@/components/ui";

/**
 * The eight controlled-document categories (`DocumentCategory` enum), with the
 * labels, icons AND accent colours from `documents.jsx`'s folder rail. The
 * colour drives the tinted folder icon in the rail and the compliance matrix.
 */
export const CATEGORIES: { id: DocumentCategory; label: string; icon: LucideIcon; color: string }[] = [
  { id: "manual", label: "Manuals", icon: BookOpen, color: "#2563eb" },
  { id: "sop", label: "SOPs", icon: FileText, color: "#0d9488" },
  { id: "work_instruction", label: "Work Instructions", icon: Wrench, color: "#ea580c" },
  { id: "form", label: "Forms & Templates", icon: ClipboardList, color: "#7c3aed" },
  { id: "record", label: "Records", icon: FileCheck, color: "#dc2626" },
  { id: "audit_report", label: "Audit Reports", icon: ShieldCheck, color: "#16a34a" },
  { id: "supplier", label: "Supplier Documents", icon: Truck, color: "#0891b2" },
  { id: "training", label: "Training Records", icon: Award, color: "#f59e0b" },
];

export function categoryLabel(id: DocumentCategory): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export function categoryColor(id: DocumentCategory): string {
  return CATEGORIES.find((c) => c.id === id)?.color ?? "var(--accent)";
}

/**
 * File-type icon + colour, keyed off the attached file's mime — the DocList /
 * DocGrid colour coding from `documents.jsx` (pdf red, word blue, excel green,
 * image purple), degrading to a neutral document glyph when nothing is attached.
 */
export function fileTypeIcon(mime: string | null): { Icon: LucideIcon; color: string } {
  if (mime === null) return { Icon: FileText, color: "var(--text-muted)" };
  if (mime.startsWith("image/")) return { Icon: ImageIcon, color: "#7c3aed" };
  if (mime === "application/pdf") return { Icon: FileText, color: "#dc2626" };
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv"))
    return { Icon: Sheet, color: "#16a34a" };
  if (mime.includes("word") || mime.includes("document")) return { Icon: FileText, color: "#2563eb" };
  return { Icon: FileIcon, color: "var(--text-muted)" };
}

/** Human file size, matching the prototype's `fmt` (MB / KB / B). */
export function formatBytes(bytes: number | null): string | null {
  if (bytes === null) return null;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/**
 * Controlled-document status chip — the exact semantic palette from
 * `documents.jsx`'s `DocStatus`, extended to the real lifecycle (`rejected`,
 * `archived`). Colour always pairs with the label (04 §8).
 */
const STATUS: Record<DocumentStatus, { label: string; bg: string; fg: string }> = {
  draft: { label: "Draft", bg: "var(--bg-subtle)", fg: "var(--text-muted)" },
  pending: { label: "Pending", bg: "rgba(245,158,11,0.14)", fg: "#b45309" },
  approved: { label: "Approved", bg: "rgba(34,197,94,0.14)", fg: "#15803d" },
  rejected: { label: "Rejected", bg: "rgba(220,38,38,0.12)", fg: "#b91c1c" },
  archived: { label: "Archived", bg: "rgba(100,116,139,0.16)", fg: "#475569" },
};

export function DocStatus({ status }: { status: DocumentStatus }): React.ReactElement {
  const s = STATUS[status];
  return (
    <Chip bg={s.bg} fg={s.fg}>
      {s.label}
    </Chip>
  );
}

/** A bare avatar circle (no label) — used in the grid card, mirroring the jsx. */
export function UserAvatar({ size = 20 }: { size?: number }): React.ReactElement {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full"
      style={{ width: size, height: size, background: "var(--bg-subtle)", color: "var(--text-muted)" }}
    >
      <User size={Math.round(size * 0.6)} />
    </span>
  );
}

/**
 * Owner/approver display. The API exposes only user ids (no members endpoint
 * yet), so we show "You"/short-id, never a fabricated name. Mirrors the NCR/CAPA
 * modules.
 */
export function UserCell({
  userId,
  meId,
  emptyLabel = "—",
}: {
  userId: string | null;
  meId: string | undefined;
  emptyLabel?: string;
}): React.ReactElement {
  if (userId === null) return <span className="text-subtle">{emptyLabel}</span>;
  const isMe = meId !== undefined && userId === meId;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px]">
      <UserAvatar />
      {isMe ? "You" : <span className="mono text-muted">{userId.slice(0, 8)}</span>}
    </span>
  );
}
