import {
  ClipboardCheck,
  TriangleAlert,
  ClipboardList,
  FileText,
  Brain,
  FileWarning,
  Package,
  Truck,
  Award,
  type LucideIcon,
} from "lucide-react";

/**
 * The single map from a record's `kind`/`entityKind` string to its detail route
 * and glyph. Shared by the command palette (search hits) and the notifications
 * surfaces (click-through), so both agree on where a record lives. Returns
 * `null` for kinds with no built detail screen — callers fall back to a
 * non-navigating row rather than routing to a 404.
 */
export function entityHref(kind: string, id: string): string | null {
  switch (kind) {
    case "inspection":
      return `/inspections/${id}`;
    case "ncr":
      return `/ncrs/${id}`;
    case "capa":
      return `/capa/${id}`;
    case "document":
      return `/documents/${id}`;
    case "8d":
    case "eight_d":
    case "eightd":
      return `/8d/${id}`;
    case "scar":
      return `/scars/${id}`;
    case "ppap":
      return `/ppap/${id}`;
    case "supplier":
      return `/suppliers/${id}`;
    default:
      return null;
  }
}

const ICONS: Record<string, LucideIcon> = {
  inspection: ClipboardCheck,
  ncr: TriangleAlert,
  capa: ClipboardList,
  document: FileText,
  "8d": Brain,
  eight_d: Brain,
  eightd: Brain,
  scar: FileWarning,
  ppap: Package,
  supplier: Truck,
  training: Award,
};

export function entityIcon(kind: string): LucideIcon {
  return ICONS[kind] ?? FileText;
}

const LABELS: Record<string, string> = {
  inspection: "Inspection",
  ncr: "NCR",
  capa: "CAPA",
  document: "Document",
  "8d": "8D",
  eight_d: "8D",
  eightd: "8D",
  scar: "SCAR",
  ppap: "PPAP",
  supplier: "Supplier",
  training: "Training",
};

export function entityLabel(kind: string): string {
  return LABELS[kind] ?? kind;
}
