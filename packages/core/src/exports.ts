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
