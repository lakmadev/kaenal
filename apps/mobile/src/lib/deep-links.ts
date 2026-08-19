import type { Href } from "expo-router";

// Deep-link resolver (05 §3) — the SINGLE place an entity reference (kind + id)
// is turned into an in-app route. Used by:
//   • notification-center rows (tap → open the entity),
//   • push / local notification responses (background tap → open the entity),
//   • home-queue rows and anywhere else that carries an entity reference.
// Keeping it in one function means push, in-app taps and queue links can never
// drift apart. Unknown / sub-entity kinds (e.g. `capa_action`, whose id is the
// action, not a screen) resolve to `null` — the caller still marks the item read,
// it just doesn't navigate. Honest: we never invent a route that would 404.

/** Normalise the server's `entityKind` spellings to a canonical detail kind. */
function canonical(kind: string): string {
  const k = kind.toLowerCase();
  if (k === "8d" || k === "eight_d" || k === "eightd") return "eight_d";
  if (k === "document_version") return "document";
  return k;
}

/** Map a canonical entity kind → its mobile detail route template. */
const ROUTE: Record<string, (id: string) => Href> = {
  inspection: (id) => `/inspection/${id}` as Href,
  ncr: (id) => `/ncr/${id}` as Href,
  eight_d: (id) => `/8d/${id}` as Href,
  capa: (id) => `/capa/${id}` as Href,
  // The only document detail surface on mobile is the review/approval screen.
  document: (id) => `/approval/${id}` as Href,
};

/**
 * Resolve an entity reference to a route, or `null` when there is no mobile
 * screen for it (unknown kind, sub-entity, or a missing id).
 */
export function entityRoute(entityKind: string | null | undefined, entityId: string | null | undefined): Href | null {
  if (!entityKind || !entityId) return null;
  const make = ROUTE[canonical(entityKind)];
  return make ? make(entityId) : null;
}
