import { DEFAULT_LOCALE, formatDate, formatRelative } from "@kaenal/core";

/** Shared display formatters (04 §8 — dates via `Intl`, in the active locale). */

/** The page locale (`<html lang>` is set from the resolved locale); "en" on the server. */
function activeLocale(): string {
  return typeof document === "undefined" ? DEFAULT_LOCALE : document.documentElement.lang || DEFAULT_LOCALE;
}

/** Short date like "Mar 4". Returns "—" for null/empty. */
export function shortDate(iso: string | null | undefined): string {
  if (iso === null || iso === undefined || iso === "") return "—";
  return formatDate(iso, activeLocale(), { month: "short", day: "numeric" });
}

/** Full date like "4 Mar 2026". */
export function longDate(iso: string | null | undefined): string {
  if (iso === null || iso === undefined || iso === "") return "—";
  return formatDate(iso, activeLocale(), { day: "numeric", month: "short", year: "numeric" });
}

/** Relative time like "just now", "8m ago", "3h ago", "2d ago"; falls back to a
 *  short date beyond a week. Used by the notification feeds. */
export function relativeTime(iso: string | null | undefined): string {
  if (iso === null || iso === undefined || iso === "") return "—";
  return formatRelative(iso, activeLocale()) ?? shortDate(iso);
}

/** Title-case an enum-ish token: `in_progress` → `In Progress`. */
export function titleCase(s: string): string {
  return s
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** "Manjunath Kumar" -> "Manjunath K." (top-bar profile button, shell.jsx). */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined;
  return last !== undefined && last !== "" ? `${first} ${last.charAt(0).toUpperCase()}.` : first;
}
