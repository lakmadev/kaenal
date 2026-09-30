import {
  ClipboardCheck,
  TriangleAlert,
  ClipboardList,
  FileText,
  Brain,
  FileWarning,
  GitBranch,
  Grid3x3,
  MessageSquare,
  Package,
  Shield,
  Truck,
  Award,
  ShieldCheck,
  Wrench,
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
    case "audit":
      return `/audits/${id}`;
    // Sprint 04 R3 AC3 — `/risk`/`/fmea` are select-in-list pages; their
    // record route is a `?id=` deep-link (R1 AC7), not `/kind/:id`.
    case "risk":
      return `/risk?id=${id}`;
    case "fmea":
      return `/fmea?id=${id}`;
    // Sprint 05 X1 AC5 (B9) — calibration/training notification deep links.
    // `/calibration`/`/training` are select-in-list pages, same `?id=`
    // pattern as risk/fmea above, not `/kind/:id`.
    case "instrument":
      return `/calibration?id=${id}`;
    case "competency":
      return `/training?competencyId=${id}`;
    case "training_record":
      return `/training?recordId=${id}`;
    // Sprint 06 X1 AC3 — complaints/ECN are select-in-list pages, same
    // `?id=` deep-link pattern as risk/fmea/calibration/training above.
    case "complaint":
      return `/complaints?id=${id}`;
    case "ecn":
      return `/ecn?id=${id}`;
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
  // `ClipboardCheck` (visually a clipboard+check) is already `inspection`'s
  // glyph — reusing it for `audit` would collide in search/notifications, so
  // audits get `ShieldCheck` instead (DESIGN-02-audits.md §2.5).
  audit: ShieldCheck,
  // Matches `navigation.ts`'s existing risk/FMEA nav glyphs (R3 AC3).
  risk: Shield,
  fmea: Grid3x3,
  // Matches `navigation.ts`'s existing calibration/training nav glyphs (X1 AC5).
  instrument: Wrench,
  competency: Award,
  training_record: Award,
  // Matches `navigation.ts`'s existing complaints/ECN nav glyphs (X1 AC3).
  complaint: MessageSquare,
  ecn: GitBranch,
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
  audit: "Audit",
  risk: "Risk",
  fmea: "FMEA",
  instrument: "Instrument",
  competency: "Competency",
  training_record: "Training record",
  complaint: "Complaint",
  ecn: "ECN",
};

export function entityLabel(kind: string): string {
  return LABELS[kind] ?? kind;
}
