/**
 * Deterministic customer color chip (SPRINT-06 §2 C1 AC1, corrected §0 S6).
 *
 * `complaints.customer` is free text with no master table (P18 §2), so the
 * register's customer chip color cannot be user-picked or stored — it is
 * derived, on every read, from the customer name string itself. This mirrors
 * the codebase's own established norm (`rbac.ts`'s carried-over Sprint 05 C1a
 * comment: never a stored, cheaply-derivable display value) — `ComplaintDto.
 * customerColor` is a computed response field, never a column.
 *
 * The 10-color palette is fixed design tokens: the jsx's own 5 literal hex
 * values (`qms-modules.jsx`), plus 5 more chosen for WCAG-AA contrast against
 * white chip text, exactly as SPRINT-06 §2 C1 AC1 specifies.
 */

const CUSTOMER_COLOR_PALETTE: readonly string[] = [
  // The jsx's own 5 literal values, verbatim.
  "#003c64",
  "#1c1c1c",
  "#cc0000",
  "#0066b1",
  "#0a8541",
  // 5 more, chosen for WCAG-AA contrast against white chip text.
  "#5b3a9e",
  "#a8501c",
  "#0f6b6b",
  "#7a1f4d",
  "#3d5a1f",
];

/**
 * A small, well-distributed string hash (FNV-1a). Deterministic across runs
 * and platforms — never `Math.random`, never a hash that depends on object
 * identity or insertion order.
 */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    // 32-bit FNV prime multiplication, kept in unsigned 32-bit range.
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Deterministically maps a customer name to one of the 10 fixed palette
 * colors. Pure and stable: the same `name` always yields the same color, on
 * every call, in every process — never randomness, never a stored value.
 */
export function customerColor(name: string): string {
  const normalized = name.trim().toLowerCase();
  const hash = fnv1a(normalized);
  const index = hash % CUSTOMER_COLOR_PALETTE.length;
  const color = CUSTOMER_COLOR_PALETTE[index];
  if (color === undefined) throw new Error("Unreachable: palette index out of range");
  return color;
}
