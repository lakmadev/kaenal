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
  type LucideIcon,
} from "lucide-react";
import type { DocumentCategory, DocumentStatus } from "@kaenal/types";
import { Chip } from "@/components/ui";

/**
 * The eight controlled-document categories (`DocumentCategory` enum), with the
 * labels + icons from `documents.jsx`'s folder rail. Drives the library sidebar.
 */
export const CATEGORIES: { id: DocumentCategory; label: string; icon: LucideIcon }[] = [
  { id: "manual", label: "Manuals", icon: BookOpen },
  { id: "sop", label: "SOPs", icon: FileText },
  { id: "work_instruction", label: "Work Instructions", icon: Wrench },
  { id: "form", label: "Forms & Templates", icon: ClipboardList },
  { id: "record", label: "Records", icon: FileCheck },
  { id: "audit_report", label: "Audit Reports", icon: ShieldCheck },
  { id: "supplier", label: "Supplier Documents", icon: Truck },
  { id: "training", label: "Training Records", icon: Award },
];

export function categoryLabel(id: DocumentCategory): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
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
      <span
        className="inline-flex items-center justify-center rounded-full"
        style={{ width: 20, height: 20, background: "var(--bg-subtle)", color: "var(--text-muted)" }}
      >
        <User size={12} />
      </span>
      {isMe ? "You" : <span className="mono text-muted">{userId.slice(0, 8)}</span>}
    </span>
  );
}
