/** Shared display formatters (04 §8 — dates via `Intl`). */

/** Short date like "Mar 4". Returns "—" for null/empty. */
export function shortDate(iso: string | null | undefined): string {
  if (iso === null || iso === undefined || iso === "") return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Full date like "4 Mar 2026". */
export function longDate(iso: string | null | undefined): string {
  if (iso === null || iso === undefined || iso === "") return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** Title-case an enum-ish token: `in_progress` → `In Progress`. */
export function titleCase(s: string): string {
  return s
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
