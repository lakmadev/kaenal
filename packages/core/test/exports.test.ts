import { describe, expect, it } from "vitest";
import { chunkRows, csvCell, EXPORT_ROW_CAP, needsChunking, toCsv } from "../src/exports.js";

/**
 * Export rendering (03 §8). The CSV quoting and the 100k-row chunking are the
 * two rules the spec pins, so they are exercised directly — quoting because a
 * comma in a title otherwise corrupts every following column, chunking because
 * it is the "larger → zip" edge case and must hold at the boundary.
 */

describe("csvCell — RFC 4180 quoting", () => {
  it("leaves plain values untouched", () => {
    expect(csvCell("NCR-2026-0001")).toBe("NCR-2026-0001");
    expect(csvCell("")).toBe("");
  });

  it("quotes values containing a comma, quote, CR or LF", () => {
    expect(csvCell("Weld porosity, line 3")).toBe('"Weld porosity, line 3"');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
    expect(csvCell("carriage\rreturn")).toBe('"carriage\rreturn"');
  });

  it("doubles embedded quotes", () => {
    expect(csvCell('he said "stop"')).toBe('"he said ""stop"""');
  });
});

describe("toCsv", () => {
  it("joins header + rows with CRLF and a trailing terminator", () => {
    const csv = toCsv(["code", "title"], [
      ["NCR-1", "Porosity"],
      ["NCR-2", "Crack, hairline"],
    ]);
    expect(csv).toBe('code,title\r\nNCR-1,Porosity\r\nNCR-2,"Crack, hairline"\r\n');
  });

  it("emits just the header when there are no rows", () => {
    expect(toCsv(["a", "b"], [])).toBe("a,b\r\n");
  });
});

describe("chunkRows — the 100k cap", () => {
  it("keeps a set at or below the cap as a single chunk", () => {
    const rows = Array.from({ length: 5 }, (_, i) => i);
    expect(chunkRows(rows, 5)).toEqual([rows]);
  });

  it("splits one past the cap into two chunks at the boundary", () => {
    const rows = Array.from({ length: 6 }, (_, i) => i);
    const chunks = chunkRows(rows, 5);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(5);
    expect(chunks[1]).toEqual([5]);
  });

  it("yields exactly one empty chunk for no rows (one empty file, not zero)", () => {
    expect(chunkRows([], 5)).toEqual([[]]);
  });

  it("rejects a non-positive cap", () => {
    expect(() => chunkRows([1, 2], 0)).toThrow();
  });

  it("defaults to the 100k cap", () => {
    expect(EXPORT_ROW_CAP).toBe(100_000);
    expect(needsChunking(EXPORT_ROW_CAP)).toBe(false);
    expect(needsChunking(EXPORT_ROW_CAP + 1)).toBe(true);
  });
});
