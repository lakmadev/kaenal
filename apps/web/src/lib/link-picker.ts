import type { EntityKind } from "@kaenal/types";

/** One selectable record in `LinkPicker`'s result list, kind-agnostic. */
export interface LinkPickerRecord {
  kind: EntityKind;
  id: string;
  title: string;
  subtitle?: string;
}

/**
 * Client-side name/code match (Sprint 04 R3 AC — no new search-index work this
 * sprint, filtered against the existing unpaginated list the caller fetched).
 * Kept as a plain function, separate from the component, so it's unit-testable
 * without mounting a dialog.
 */
export function filterLinkPickerRecords(records: LinkPickerRecord[], query: string): LinkPickerRecord[] {
  const q = query.trim().toLowerCase();
  if (q === "") return records;
  return records.filter((r) => r.title.toLowerCase().includes(q) || (r.subtitle?.toLowerCase().includes(q) ?? false));
}

/**
 * Sprint 04 R3 AC6 / design audit §0: `LinkPicker.dc.html` drew all five
 * kind-filter chips against a sprint scoped to one kind (FMEA); the corrected
 * behaviour is to never render the row once there's only one kind to filter
 * between — a filter with one always-active option is a dead control (rule 10),
 * not four disabled chips next to it.
 */
export function shouldShowKindChips(kinds: EntityKind[]): boolean {
  return kinds.length > 1;
}
