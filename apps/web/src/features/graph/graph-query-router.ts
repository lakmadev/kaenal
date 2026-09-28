import type { GraphQueryId } from "@kaenal/types";

/**
 * The typed-query keyword router (`graph-explorer.jsx` `matchTyped`, line
 * 255), reproduced as-is — a simple client-side keyword match, not a smarter
 * NLU layer, per the task's explicit instruction.
 */
export function matchTyped(text: string): GraphQueryId {
  const s = text.toLowerCase();
  if (s.includes("block") || s.includes("clos")) return "blocking";
  if (s.includes("document") || s.includes("impact") || s.includes("porosity")) return "docs-impacted";
  if (s.includes("capa") || s.includes("corrective")) return "open-capas";
  return "supplier-nc-8d";
}

/** "Interpreted as" chips (jsx `qSupplierD8`/`qBlocking`/`qDocsImpacted`/`qOpenCapas`'s own `interpreted` arrays) — the fixed, per-query wording. */
export function interpretedFor(queryId: GraphQueryId): string[] {
  switch (queryId) {
    case "supplier-nc-8d":
      return ["entity = supplier", "relation = NC → triggered → 8D"];
    case "blocking":
      return ["relation = open dependencies", "state = not closed"];
    case "docs-impacted":
      return ["relation = impacts → document", "type = document"];
    case "open-capas":
      return ["type = corrective action", "state = open"];
  }
}
