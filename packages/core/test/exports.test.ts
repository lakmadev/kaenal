import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import {
  chunkRows,
  columnLetter,
  csvCell,
  EXPORT_ROW_CAP,
  needsChunking,
  toCsv,
  toPdf,
  toXlsx,
} from "../src/exports.js";

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

describe("columnLetter", () => {
  it("maps zero-based indexes to spreadsheet columns", () => {
    expect(columnLetter(0)).toBe("A");
    expect(columnLetter(25)).toBe("Z");
    expect(columnLetter(26)).toBe("AA");
    expect(columnLetter(27)).toBe("AB");
  });
});

describe("toXlsx", () => {
  it("produces a valid one-sheet workbook with the header + data as inline strings", () => {
    const xlsx = toXlsx(["Code", "Title"], [["NCR-1", "Weld & <flux> issue"]]);
    const files = unzipSync(xlsx);

    // The required OOXML parts are present.
    expect(files["[Content_Types].xml"]).toBeDefined();
    expect(files["xl/workbook.xml"]).toBeDefined();
    expect(files["xl/worksheets/sheet1.xml"]).toBeDefined();

    const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]!);
    expect(sheet).toContain("<t xml:space=\"preserve\">Code</t>");
    expect(sheet).toContain("<t xml:space=\"preserve\">NCR-1</t>");
    // XML metacharacters in a value are escaped, not left to corrupt the sheet.
    expect(sheet).toContain("Weld &amp; &lt;flux&gt; issue");
    // Cell references are addressed (row 1 header, row 2 data).
    expect(sheet).toContain('r="A1"');
    expect(sheet).toContain('r="B2"');
  });

  it("handles an empty data set (header row only)", () => {
    const sheet = strFromU8(unzipSync(toXlsx(["Code"], []))["xl/worksheets/sheet1.xml"]!);
    expect(sheet).toContain('<row r="1">');
    expect(sheet).not.toContain('<row r="2">');
  });
});

describe("toPdf", () => {
  it("produces a structurally valid PDF containing the data", () => {
    const bytes = toPdf("ncrs export", ["Code", "Title"], [["NCR-1", "Weld porosity"]]);
    const text = Buffer.from(bytes).toString("latin1");

    expect(text.startsWith("%PDF-1.")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    // Header, title and a data value are laid into the content stream.
    expect(text).toContain("(ncrs export)");
    expect(text).toContain("Code");
    expect(text).toContain("NCR-1");
    // A well-formed xref + single-page catalog.
    expect(text).toContain("/Type /Catalog");
    expect(text).toContain("startxref");
  });

  it("paginates large row sets across multiple page objects", () => {
    const rows = Array.from({ length: 200 }, (_, i) => [`R-${i}`, "x"]);
    const text = Buffer.from(toPdf("big", ["Code", "V"], rows)).toString("latin1");
    // 200 rows exceed one page → more than one /Type /Page object.
    expect(text.match(/\/Type \/Page[^s]/g)?.length ?? 0).toBeGreaterThan(1);
  });

  it("escapes PDF-literal metacharacters so a value can't break the stream", () => {
    const text = Buffer.from(toPdf("t", ["V"], [["a(b)c\\d"]])).toString("latin1");
    expect(text).toContain("a\\(b\\)c\\\\d");
  });
});
