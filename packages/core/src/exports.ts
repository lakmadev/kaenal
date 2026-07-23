import { strToU8, zipSync } from "fflate";

/**
 * Export rendering primitives (03 §8, 06 `reports`).
 *
 * The two rules the spec pins down live here, pure and unit-tested, so the job
 * processor is left with only I/O (query rows, upload bytes):
 *
 *   1. CSV serialisation is RFC 4180 — a field is quoted when it contains a
 *      comma, quote, CR or LF, and embedded quotes are doubled. Getting this
 *      wrong is how an NCR title with a comma silently shifts every column.
 *   2. A single export file caps at 100 000 rows; anything larger is split into
 *      that many rows per file and the files are zipped (03 §8/§10). Chunking is
 *      pure list math and is the headline edge case, so it is testable without a
 *      100k-row database.
 */

/** Max rows per export file before it must be split into a zip (03 §8). */
export const EXPORT_ROW_CAP = 100_000;

/** Quote a single CSV field per RFC 4180 (only when it needs it). */
export function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/**
 * Serialise a header row + data rows to CSV text. Rows are arrays of already-
 * stringified cells (the caller decides how a null/date/number renders), so
 * this function stays about the format, not the data model. Lines are CRLF
 * terminated, including a trailing terminator, per RFC 4180.
 */
export function toCsv(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(","));
  return lines.length === 0 ? "" : lines.join("\r\n") + "\r\n";
}

/**
 * Split rows into chunks of at most `cap`. An empty input yields a single empty
 * chunk, so an export with no matching rows still produces exactly one (empty)
 * file rather than a zero-file zip. `cap` must be positive.
 */
export function chunkRows<T>(rows: readonly T[], cap: number = EXPORT_ROW_CAP): T[][] {
  if (cap < 1) throw new Error("chunk cap must be >= 1");
  if (rows.length === 0) return [[]];
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += cap) {
    chunks.push(rows.slice(i, i + cap));
  }
  return chunks;
}

/** True when the row count forces a chunked zip rather than one flat file. */
export function needsChunking(rowCount: number, cap: number = EXPORT_ROW_CAP): boolean {
  return rowCount > cap;
}

// ---------------------------------------------------------------------------
// XLSX — a minimal, dependency-light OOXML SpreadsheetML workbook.
//
// A .xlsx is a zip of XML parts. We write the smallest valid set (no styles, no
// sharedStrings — every cell is an inline string), which every spreadsheet app
// opens. Values arrive already stringified, exactly like toCsv, so this stays a
// pure serialiser.
// ---------------------------------------------------------------------------

/** Escape a value for XML text/attribute content, dropping chars invalid in XML 1.0. */
function xmlEscape(value: string): string {
  return value
    // Strip control chars invalid in XML 1.0 before escaping the rest.
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/** Zero-based column index → spreadsheet column letters (0→A, 25→Z, 26→AA). */
export function columnLetter(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function sheetRowXml(cells: readonly string[], rowNumber: number): string {
  const cs = cells
    .map(
      (v, i) =>
        `<c r="${columnLetter(i)}${rowNumber}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(v)}</t></is></c>`,
    )
    .join("");
  return `<row r="${rowNumber}">${cs}</row>`;
}

const XLSX_CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
  "</Types>";

const XLSX_ROOT_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
  "</Relationships>";

const XLSX_WORKBOOK =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
  '<sheets><sheet name="Export" sheetId="1" r:id="rId1"/></sheets></workbook>';

const XLSX_WORKBOOK_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
  "</Relationships>";

/** Serialise a header row + string rows to a minimal .xlsx workbook (one sheet). */
export function toXlsx(headers: readonly string[], rows: readonly (readonly string[])[]): Uint8Array {
  const sheetData = [headers, ...rows].map((r, i) => sheetRowXml(r, i + 1)).join("");
  const sheet =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetData>${sheetData}</sheetData></worksheet>`;

  return zipSync({
    "[Content_Types].xml": strToU8(XLSX_CONTENT_TYPES),
    "_rels/.rels": strToU8(XLSX_ROOT_RELS),
    "xl/workbook.xml": strToU8(XLSX_WORKBOOK),
    "xl/_rels/workbook.xml.rels": strToU8(XLSX_WORKBOOK_RELS),
    "xl/worksheets/sheet1.xml": strToU8(sheet),
  });
}

// ---------------------------------------------------------------------------
// PDF — a minimal, dependency-light tabular document.
//
// Uses the standard Courier font (metrics built into every PDF reader, so no
// font embedding) and fixed, space-padded columns, so the monospaced glyphs
// line up into a table. Rows paginate. This is the interim renderer; a branded
// PDF via headless Chromium + print routes (06 `reports`, 09) supersedes it.
// ---------------------------------------------------------------------------

const PDF_PAGE_W = 612; // US Letter, points
const PDF_PAGE_H = 792;
const PDF_MARGIN = 40;
const PDF_FONT_SIZE = 8;
const PDF_LINE_H = 12;
const PDF_COL_MAX = 40; // cap a column's character width so one long cell can't blow out the row

/** Rows of text per page, given the margins and line height. */
const PDF_ROWS_PER_PAGE = Math.floor((PDF_PAGE_H - 2 * PDF_MARGIN - PDF_LINE_H) / PDF_LINE_H);

/** Escape a string for a PDF literal `( … )` and flatten to printable ASCII. */
function pdfText(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, " ")
    // Collapse anything outside printable ASCII to a placeholder.
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/([\\()])/g, "\\$1");
}

/** Pad/truncate a cell to `width` monospaced characters. */
function padCell(value: string, width: number): string {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length > width ? `${flat.slice(0, width - 1)}…` : flat.padEnd(width, " ");
}

/** Column widths: the widest of header/cell per column, capped. */
function columnWidths(headers: readonly string[], rows: readonly (readonly string[])[]): number[] {
  return headers.map((h, i) => {
    let w = h.length;
    for (const row of rows) w = Math.max(w, (row[i] ?? "").replace(/\s+/g, " ").trim().length);
    return Math.min(Math.max(w, 3), PDF_COL_MAX);
  });
}

/**
 * Render a header + string rows to a simple paginated tabular PDF. Returns the
 * document bytes. Values arrive already stringified (like toCsv/toXlsx).
 */
export function toPdf(
  title: string,
  headers: readonly string[],
  rows: readonly (readonly string[])[],
): Uint8Array {
  const widths = columnWidths(headers, rows);
  const line = (cells: readonly string[]): string => cells.map((c, i) => padCell(c ?? "", widths[i]!)).join("  ");
  const headerLine = line(headers);

  // Break rows into pages, each led by the title + header line.
  const pages: string[][] = [];
  for (let i = 0; i < Math.max(rows.length, 1); i += PDF_ROWS_PER_PAGE) {
    pages.push(rows.slice(i, i + PDF_ROWS_PER_PAGE).map((r) => line(r)));
  }

  const objects: string[] = [];
  const addObject = (body: string): number => {
    objects.push(body);
    return objects.length; // 1-based object number
  };

  // Fixed objects: 1 = Catalog, 2 = Pages, 3 = Font. Page/content objects follow.
  addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesObjNumber = 2;
  addObject(""); // placeholder for Pages (needs kid refs known first)
  const fontObjNumber = addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
  );

  const pageObjNumbers: number[] = [];
  for (const pageLines of pages) {
    const textLines = [pdfText(title), pdfText(headerLine), ...pageLines.map(pdfText)];
    let stream = "BT\n";
    stream += `/F1 ${PDF_FONT_SIZE} Tf\n`;
    stream += `${PDF_LINE_H} TL\n`;
    stream += `${PDF_MARGIN} ${PDF_PAGE_H - PDF_MARGIN} Td\n`;
    for (const t of textLines) stream += `(${t}) Tj T*\n`;
    stream += "ET";

    const contentNumber = addObject(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const pageNumber = addObject(
      `<< /Type /Page /Parent ${pagesObjNumber} 0 R /MediaBox [0 0 ${PDF_PAGE_W} ${PDF_PAGE_H}] ` +
        `/Resources << /Font << /F1 ${fontObjNumber} 0 R >> >> /Contents ${contentNumber} 0 R >>`,
    );
    pageObjNumbers.push(pageNumber);
  }

  // Fill in the Pages object now that its kids are known.
  objects[pagesObjNumber - 1] =
    `<< /Type /Pages /Count ${pageObjNumbers.length} ` +
    `/Kids [${pageObjNumbers.map((n) => `${n} 0 R`).join(" ")}] >>`;

  // Assemble the file, tracking byte offsets for the xref table.
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets[i] = pdf.length;
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${off.toString().padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return strToU8(pdf);
}
