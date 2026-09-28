import type pg from "pg";
import { zipSync } from "fflate";
import { withTenant } from "@kaenal/db";
import {
  chunkRows,
  EXPORT_ROW_CAP,
  isPlantScoped,
  toCsv,
  toPdf,
  toXlsx,
  type Membership,
} from "@kaenal/core";
import { AiReplyExportPayload } from "@kaenal/types";
import type { NotificationsService } from "../../notifications/notifications.service.js";
import type { Storage } from "../../files/storage.js";
import type { RunExportJob } from "../job-types.js";

/**
 * Render a requested export server-side (03 §8, 06 `reports`). The job:
 *   1. claims the `queued` row (→ `processing`), which also makes it idempotent
 *      — a retry finds it no longer `queued` and stops, so no double-render;
 *   2. re-derives the requester's role + plant scope and queries the resource
 *      through the SAME tenant transaction, so RLS and plant scoping apply to an
 *      export exactly as they do to the list endpoint — an export is not a way
 *      to read rows the requester cannot see;
 *   3. serialises to CSV, splitting into a zip of ≤100k-row files past the cap;
 *   4. uploads the artifact and flips the row to `completed`, then notifies the
 *      requester that it is ready to download.
 * Any failure lands as `status = 'failed'` with the message, so the poller sees
 * a terminal state instead of a row stuck at `processing`.
 *
 * Table/column selection comes only from the fixed `EXPORTABLES` map, never from
 * request input — the same rule the search federation follows.
 */

interface Exportable {
  readonly table: string;
  readonly plantScoped: boolean;
  /** DB columns to select, in order. `created_at` is always the last sort key. */
  readonly columns: readonly string[];
  /** Human header row, aligned 1:1 with `columns`. */
  readonly headers: readonly string[];
}

const EXPORTABLES: Readonly<Record<string, Exportable>> = {
  ncrs: {
    table: "ncrs",
    plantScoped: true,
    columns: ["code", "title", "status", "priority", "created_at"],
    headers: ["Code", "Title", "Status", "Priority", "Created"],
  },
  inspections: {
    table: "inspections",
    plantScoped: true,
    columns: ["code", "title", "status", "created_at"],
    headers: ["Code", "Title", "Status", "Created"],
  },
  capas: {
    table: "capas",
    plantScoped: false,
    columns: ["code", "title", "type", "priority", "status", "created_at"],
    headers: ["Code", "Title", "Type", "Priority", "Status", "Created"],
  },
  audits: {
    table: "audits",
    plantScoped: true,
    columns: ["code", "title", "type", "status", "created_at"],
    headers: ["Code", "Title", "Type", "Status", "Created"],
  },
};

/** Not a table export: the frozen AI reply is rendered as label/value rows. */
const AI_REPLY_SPEC: Exportable = {
  table: "",
  plantScoped: false,
  columns: [],
  headers: ["AI reply"],
};

/** Not a table export either: one audit's report, rendered as label/value rows
 *  (title/standard/code/findings-summary) followed by its detailed findings. */
const AUDIT_REPORT_SPEC: Exportable = {
  table: "",
  plantScoped: false,
  columns: [],
  headers: ["Field", "Value"],
};

/** Not a table export either: the current ranked lines+suppliers forecast
 *  (Sprint 03 Part B, `predictive.jsx` "Forecast pack"). */
const PREDICTIVE_FORECAST_PACK_SPEC: Exportable = {
  table: "",
  plantScoped: false,
  columns: [],
  headers: ["Kind", "Subject", "Horizon", "Predicted", "Confidence", "80% band", "Driver"],
};

/**
 * Render ONE audit's report (S2-2 AC5/6) — re-derived from the DB at render
 * time, never from the stored `filters` payload alone: the requester's plant
 * scope is re-checked here exactly as `fetchRows` does for table exports, so a
 * scope that narrowed between `create` and render still fails closed.
 */
async function auditReportRows(
  tx: Parameters<Parameters<typeof withTenant>[2]>[0],
  filters: { auditId?: string },
  membership: Membership,
): Promise<unknown[][]> {
  const auditId = filters.auditId;
  if (typeof auditId !== "string") throw new Error("audit_report export is missing filters.auditId");

  const { rows } = await tx.query<{
    code: string;
    title: string;
    standard: string | null;
    type: string;
    status: string;
    plant_id: string | null;
  }>("SELECT code, title, standard, type, status, plant_id FROM audits WHERE id = $1 AND deleted_at IS NULL", [
    auditId,
  ]);
  const audit = rows[0];
  if (audit === undefined) throw new Error("Audit not found");
  if (isPlantScoped(membership.role) && membership.plantIds.length > 0) {
    if (audit.plant_id === null || !membership.plantIds.includes(audit.plant_id)) {
      throw new Error("Audit is out of scope");
    }
  }

  const { rows: findings } = await tx.query<{
    clause: string | null;
    kind: string;
    title: string | null;
    description: string;
  }>(
    "SELECT clause, kind, title, description FROM audit_findings WHERE audit_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC",
    [auditId],
  );
  const summary: Record<string, number> = { major_nc: 0, minor_nc: 0, opportunity: 0 };
  for (const f of findings) summary[f.kind] = (summary[f.kind] ?? 0) + 1;

  const out: unknown[][] = [
    ["Title", audit.title],
    ["Code", audit.code],
    ["Standard", audit.standard ?? ""],
    ["Type", audit.type],
    ["Status", audit.status],
    ["Major NCs", summary["major_nc"] ?? 0],
    ["Minor NCs", summary["minor_nc"] ?? 0],
    ["Opportunities", summary["opportunity"] ?? 0],
    ["Findings", findings.length],
  ];
  for (const f of findings) {
    out.push([f.clause ?? "—", `${f.kind}: ${f.title ?? f.description.slice(0, 80)}`]);
  }
  return out;
}

/**
 * Render the current ranked lines+suppliers forecast (Sprint 03 Part B, P4),
 * scoped to the requesting caller exactly like every other export — re-derived
 * from the DB at render time, never from a stale `filters` snapshot. Line
 * subjects are plant-scoped through their `areas.plant_id` (mirrors
 * `SearchService`'s per-kind plant filter); suppliers carry no plant, so they
 * are never narrowed. Capped at 200 rows, ranked by predicted volume.
 */
async function forecastPackRows(
  tx: Parameters<Parameters<typeof withTenant>[2]>[0],
  membership: Membership,
): Promise<unknown[][]> {
  const params: unknown[] = [];
  let where = "WHERE rp.deleted_at IS NULL";
  if (isPlantScoped(membership.role) && membership.plantIds.length > 0) {
    params.push(membership.plantIds);
    where += ` AND (rp.subject_kind <> 'line' OR a.plant_id = ANY($${params.length}::uuid[]))`;
  }

  const { rows } = await tx.query<{
    subject_kind: string;
    subject_name: string | null;
    horizon: string;
    predicted_value: string;
    confidence: number;
    band_low: string;
    band_high: string;
    reasoning: string;
  }>(
    `SELECT rp.subject_kind, COALESCE(a.name, s.name) AS subject_name, rp.horizon,
            rp.predicted_value, rp.confidence, rp.band_low, rp.band_high, rp.reasoning
       FROM risk_predictions rp
       LEFT JOIN areas a ON rp.subject_kind = 'line' AND a.id = rp.subject_id AND a.tenant_id = rp.tenant_id
       LEFT JOIN suppliers s ON rp.subject_kind = 'supplier' AND s.id = rp.subject_id AND s.tenant_id = rp.tenant_id
       ${where}
       ORDER BY rp.predicted_value DESC, rp.id DESC
       LIMIT 200`,
    params,
  );

  return rows.map((r) => [
    r.subject_kind,
    r.subject_name ?? "—",
    r.horizon,
    Number(r.predicted_value),
    r.confidence,
    `${Number(r.band_low)}–${Number(r.band_high)}`,
    r.reasoning,
  ]);
}

/** Wrap the reply text to the PDF column width and append provenance lines. */
function aiReplyRows(p: AiReplyExportPayload): unknown[][] {
  const wrap = (text: string): string[] => {
    const out: string[] = [];
    for (const para of text.split(/\r?\n/)) {
      let line = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        if (line !== "" && line.length + 1 + word.length > 40) {
          out.push(line);
          line = word;
        } else line = line === "" ? word : `${line} ${word}`;
      }
      out.push(line);
    }
    return out;
  };
  const lines = [
    ...wrap(p.text),
    "",
    `Confidence: ${p.confidence}`,
    `Provider: ${p.provider ?? "unknown"}`,
    ...(p.generatedAt !== undefined ? [`Generated: ${p.generatedAt}`] : []),
    ...p.sources.map((s) => `Source: ${s.kind} ${s.id.slice(0, 8)}`),
    "AI-generated draft - verify before use.",
  ];
  return lines.map((l) => [l]);
}

interface ExportRow {
  resource: string;
  format: string;
  filters: { status?: string; auditId?: string };
  payload: unknown;
  requested_by: string | null;
}

/** MIME type for a rendered export, by format. */
const CONTENT_TYPE: Readonly<Record<string, string>> = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
  zip: "application/zip",
};

/** How a DB value becomes a CSV cell — dates as ISO, nulls as empty. The
 *  exported columns are scalar (text/enum/timestamptz), so this covers them
 *  without ever stringifying an object by its default format. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    return value.toString();
  }
  return JSON.stringify(value);
}

export async function runExport(
  payload: RunExportJob,
  deps: {
    storage: Storage;
    bucket: string;
    notifications: NotificationsService;
    /** Rows per file before splitting into a zip. Overridable in tests. */
    rowCap?: number;
    pool?: pg.Pool | undefined;
  },
): Promise<{ status: "completed" | "failed" | "skipped"; rowCount?: number; objectKey?: string }> {
  const cap = deps.rowCap ?? EXPORT_ROW_CAP;

  return withTenant(payload.tenantId, null, async (tx) => {
    // Claim the job: only a `queued` row transitions to `processing`. A retry of
    // an already-running/finished export updates 0 rows and bails.
    const claim = await tx.query<ExportRow>(
      `UPDATE exports SET status = 'processing', updated_at = now()
        WHERE id = $1 AND status = 'queued' AND deleted_at IS NULL
        RETURNING resource, format, filters, payload, requested_by`,
      [payload.exportId],
    );
    const job = claim.rows[0];
    if (job === undefined) return { status: "skipped" };

    try {
      const aiReply = job.resource === "ai_reply" ? AiReplyExportPayload.parse(job.payload) : null;
      const isAuditReport = job.resource === "audit_report";
      const isForecastPack = job.resource === "predictive_forecast_pack";
      const spec = isAuditReport
        ? AUDIT_REPORT_SPEC
        : isForecastPack
          ? PREDICTIVE_FORECAST_PACK_SPEC
          : aiReply !== null
            ? AI_REPLY_SPEC
            : EXPORTABLES[job.resource];
      if (spec === undefined) throw new Error(`Unknown export resource: ${job.resource}`);

      const membership = job.requested_by === null ? null : await loadMembership(tx, job.requested_by);
      if (membership === null) throw new Error("Requester is no longer an active member");

      const rows = isAuditReport
        ? await auditReportRows(tx, job.filters, membership)
        : isForecastPack
          ? await forecastPackRows(tx, membership)
          : aiReply !== null
            ? aiReplyRows(aiReply)
            : await fetchRows(tx, spec, job.filters, membership);
      const stringRows = rows.map((r) => r.map(cell));

      // Serialise per format. XLSX/PDF are single documents (they page/scroll
      // internally); CSV stays one file at/under the cap, a zip of chunked CSVs
      // past it.
      let body: Buffer;
      let ext: string;
      if (job.format === "xlsx") {
        body = Buffer.from(toXlsx(spec.headers, stringRows));
        ext = "xlsx";
      } else if (job.format === "pdf") {
        body = Buffer.from(toPdf(`${job.resource} export`, spec.headers, stringRows));
        ext = "pdf";
      } else {
        const chunks = chunkRows(stringRows, cap);
        if (chunks.length === 1) {
          body = Buffer.from(toCsv(spec.headers, chunks[0]!), "utf8");
          ext = "csv";
        } else {
          const files: Record<string, Uint8Array> = {};
          chunks.forEach((chunk, i) => {
            const name = `${job.resource}-part-${String(i + 1).padStart(2, "0")}.csv`;
            files[name] = new Uint8Array(Buffer.from(toCsv(spec.headers, chunk), "utf8"));
          });
          body = Buffer.from(zipSync(files));
          ext = "zip";
        }
      }

      const objectKey = `${payload.tenantId}/exports/${payload.exportId}.${ext}`;
      const { sizeBytes } = await deps.storage.put(objectKey, body, CONTENT_TYPE[ext] ?? "application/octet-stream");

      await tx.query(
        `UPDATE exports
            SET status = 'completed', row_count = $2, bucket = $3, object_key = $4,
                byte_size = $5, error = NULL, updated_at = now()
          WHERE id = $1`,
        [payload.exportId, rows.length, deps.bucket, objectKey, sizeBytes],
      );

      if (job.requested_by !== null) {
        await deps.notifications.notify(tx, payload.tenantId, {
          userId: job.requested_by,
          kind: "export_ready",
          title: `Your ${job.resource} export is ready`,
          entityKind: "export",
          entityId: payload.exportId,
          dedupeKey: `export-ready:${payload.exportId}`,
        });
      }

      return { status: "completed", rowCount: rows.length, objectKey };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Export failed";
      await tx.query("UPDATE exports SET status = 'failed', error = $2, updated_at = now() WHERE id = $1", [
        payload.exportId,
        message.slice(0, 2000),
      ]);
      return { status: "failed" };
    }
  }, deps.pool);
}

async function loadMembership(
  tx: Parameters<Parameters<typeof withTenant>[2]>[0],
  userId: string,
): Promise<Membership | null> {
  const { rows } = await tx.query<{ role: string; plant_ids: string[] }>(
    "SELECT role, plant_ids FROM memberships WHERE user_id = $1 AND status = 'active'",
    [userId],
  );
  const m = rows[0];
  return m === undefined ? null : { role: m.role as Membership["role"], plantIds: m.plant_ids };
}

async function fetchRows(
  tx: Parameters<Parameters<typeof withTenant>[2]>[0],
  spec: Exportable,
  filters: { status?: string },
  membership: Membership,
): Promise<unknown[][]> {
  const params: unknown[] = [];
  let where = "WHERE deleted_at IS NULL";

  if (typeof filters.status === "string" && filters.status.length > 0) {
    params.push(filters.status);
    where += ` AND status = $${params.length}`;
  }
  if (spec.plantScoped && isPlantScoped(membership.role) && membership.plantIds.length > 0) {
    params.push(membership.plantIds);
    where += ` AND plant_id = ANY($${params.length}::uuid[])`;
  }

  const select = spec.columns.map((c) => `"${c}"`).join(", ");
  const { rows } = await tx.query<Record<string, unknown>>(
    `SELECT ${select} FROM ${spec.table} ${where} ORDER BY created_at ASC, id ASC`,
    params,
  );
  return rows.map((row) => spec.columns.map((c) => row[c]));
}
