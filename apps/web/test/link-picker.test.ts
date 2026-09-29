import { describe, expect, it } from "vitest";
import { filterLinkPickerRecords, shouldShowKindChips, type LinkPickerRecord } from "@/lib/link-picker";

/**
 * `LinkPicker`'s pure logic (Sprint 04 R3 slice 5). The component itself needs
 * jsdom + Testing Library to mount, which this app's `vitest.config.ts` doesn't
 * wire up yet (node env, pure-logic tests only per its own comment) — so the
 * two behaviours the sprint calls out are covered at the function level, the
 * same node-only style every other test in this directory uses.
 */
describe("filterLinkPickerRecords", () => {
  const records: LinkPickerRecord[] = [
    { kind: "fmea", id: "1", title: "FMEA-0001", subtitle: "Fuel injector housing" },
    { kind: "fmea", id: "2", title: "FMEA-0002", subtitle: "Brake caliper bracket" },
  ];

  it("returns everything for an empty query", () => {
    expect(filterLinkPickerRecords(records, "")).toEqual(records);
    expect(filterLinkPickerRecords(records, "   ")).toEqual(records);
  });

  it("matches by title (code), case-insensitively", () => {
    expect(filterLinkPickerRecords(records, "fmea-0002")).toEqual([records[1]]);
  });

  it("matches by subtitle (name)", () => {
    expect(filterLinkPickerRecords(records, "brake")).toEqual([records[1]]);
  });

  it("returns no rows when nothing matches", () => {
    expect(filterLinkPickerRecords(records, "does-not-exist")).toEqual([]);
  });
});

describe("shouldShowKindChips", () => {
  it("hides the filter-chip row for this sprint's single-kind (FMEA-only) call site", () => {
    expect(shouldShowKindChips(["fmea"])).toBe(false);
  });

  it("shows the chip row once a future call site adds a second kind", () => {
    expect(shouldShowKindChips(["fmea", "ncr"])).toBe(true);
  });

  it("hides the chip row for zero kinds too (nothing to filter between)", () => {
    expect(shouldShowKindChips([])).toBe(false);
  });
});
