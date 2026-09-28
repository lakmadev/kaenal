import {
  Brain,
  ClipboardCheck,
  FileText,
  Search,
  ShieldCheck,
  Truck,
  TriangleAlert,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { EntityKind } from "@kaenal/types";

/**
 * Node-type metadata for the knowledge graph explorer's own closed
 * vocabulary (`graph-explorer.jsx` `G_TYPES`, lines 13-22). These hex colours
 * are the jsx's own literal design values for this module — design-rules.md
 * treats per-entity-kind glyph colours the same way `entity-routes.ts` does,
 * so they're reproduced as literals here, not tokens.
 *
 * Icon choices are 1:1 against `primitives.jsx`'s `ICONS` path dictionary,
 * confirmed in DESIGN-03-graph.md §2: `finding` = lucide `Search` (no
 * collision — this vocabulary never renders alongside `entity-routes.ts`),
 * `capa` = lucide `Wrench` (deliberately different from `entity-routes.ts`'s
 * `ClipboardList` — the jsx's own explicit choice for this screen).
 */
export interface GraphKindMeta {
  readonly label: string;
  readonly card: string;
  readonly color: string;
  readonly soft: string;
  readonly icon: LucideIcon;
  readonly layer: number;
}

export const GRAPH_KINDS: Record<EntityKind, GraphKindMeta> = {
  inspection: { label: "Inspection", card: "Inspection", color: "#0ea5e9", soft: "rgba(14,165,233,0.12)", icon: ClipboardCheck, layer: 0 },
  supplier: { label: "Supplier", card: "Supplier", color: "#0d9488", soft: "rgba(13,148,136,0.12)", icon: Truck, layer: 0 },
  finding: { label: "Inspection finding", card: "Finding", color: "#0891b2", soft: "rgba(8,145,178,0.12)", icon: Search, layer: 1 },
  audit: { label: "Audit", card: "Audit", color: "#ea580c", soft: "rgba(234,88,12,0.12)", icon: ShieldCheck, layer: 1 },
  ncr: { label: "Non-conformity", card: "Non-conformity", color: "#dc2626", soft: "rgba(220,38,38,0.12)", icon: TriangleAlert, layer: 2 },
  eight_d: { label: "8D case", card: "8D case", color: "#6366f1", soft: "rgba(99,102,241,0.12)", icon: Brain, layer: 3 },
  document: { label: "Document", card: "Document", color: "#9333ea", soft: "rgba(147,51,234,0.12)", icon: FileText, layer: 4 },
  capa: { label: "Corrective action", card: "Corrective", color: "#d97706", soft: "rgba(217,119,6,0.14)", icon: Wrench, layer: 5 },
  // `scar` never appears in the graph module (entity_links' own CHECK
  // constraint excludes it) — present only so the Record<EntityKind,...> is total.
  scar: { label: "SCAR", card: "SCAR", color: "#64748b", soft: "rgba(100,116,139,0.12)", icon: FileText, layer: 5 },
};

/** The 8 kinds the graph explorer actually renders (mirrors `GRAPH_KINDS` in `graph.service.ts`). */
export const GRAPH_NODE_KINDS: readonly EntityKind[] = [
  "inspection",
  "supplier",
  "finding",
  "audit",
  "ncr",
  "eight_d",
  "document",
  "capa",
];

export const NODE_W = 188;
export const NODE_H = 60;

export const fmt = (n: number): string => n.toLocaleString("en-US");

/** `kind:id` composite key — matches the API's own `nodeKey`/`edgeKeys` format exactly. */
export function nodeKey(kind: string, id: string): string {
  return `${kind}:${id}`;
}
