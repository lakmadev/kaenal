import type { Tx } from "@kaenal/db";
import type {
  DashAuditItem,
  DashboardDto,
  DashKpi,
  DashQueueItem,
  DashRow,
  DashTeamMember,
} from "@kaenal/types";

/**
 * Home-dashboard aggregation (05 §M5) — pure query functions over the request's
 * tenant-scoped transaction. RLS confines every statement to the caller's
 * workspace, so none of these add a tenant predicate (identical to every other
 * service). control.users is outside RLS and readable by the app role, so the
 * actor/name joins are safe.
 *
 * Every metric is computed from real columns. The ONE exception is the admin
 * "Failed syncs" tile: there is no tenant-wide sync-failure telemetry anywhere
 * server-side (the offline engine is client-only), so its value is returned as
 * null and rendered as "—" — never a fabricated number. See PROGRESS known
 * issues; it wants a device sync-failure report channel (M11/M13).
 */

const NCR_OPEN = ["draft", "open", "assigned", "in_progress", "escalated", "reopened"];
const NCR_ACTIONABLE = ["open", "assigned", "in_progress", "reopened", "escalated"];

/** Two-letter initials from a display name ("Sara Chen" → "SC"). */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** count(*)::int for a scalar count query. */
async function count(tx: Tx, sql: string, params: unknown[]): Promise<number> {
  const r = await tx.query<{ n: number }>(sql, params);
  return r.rows[0]?.n ?? 0;
}

function pct(numerator: number, denominator: number): string | null {
  if (denominator === 0) return null;
  return `${Math.round((numerator / denominator) * 100)}%`;
}

// ── Inspector ────────────────────────────────────────────────────────────────
async function inspector(tx: Tx, userId: string): Promise<DashboardDto> {
  const assigned = await count(
    tx,
    `SELECT count(*)::int AS n FROM inspections
      WHERE inspector_id = $1 AND deleted_at IS NULL AND status IN ('scheduled','in_progress')`,
    [userId],
  );
  const dueToday = await count(
    tx,
    `SELECT count(*)::int AS n FROM inspections
      WHERE inspector_id = $1 AND deleted_at IS NULL AND status IN ('scheduled','in_progress')
        AND scheduled_at IS NOT NULL AND scheduled_at::date <= now()::date`,
    [userId],
  );
  const overdue = await count(
    tx,
    `SELECT count(*)::int AS n FROM inspections
      WHERE inspector_id = $1 AND deleted_at IS NULL AND status IN ('scheduled','in_progress')
        AND scheduled_at IS NOT NULL AND scheduled_at < now()`,
    [userId],
  );
  // Pass rate over my completed inspections in the last 7 days: passed = no
  // critical finding recorded against it.
  const passStat = await tx.query<{ total: number; passed: number }>(
    `SELECT
        count(*)::int AS total,
        count(*) FILTER (
          WHERE NOT EXISTS (
            SELECT 1 FROM findings f
             WHERE f.inspection_id = i.id AND f.deleted_at IS NULL AND f.severity = 'critical'
          )
        )::int AS passed
      FROM inspections i
      WHERE i.inspector_id = $1 AND i.deleted_at IS NULL AND i.status = 'completed'
        AND i.completed_at >= now() - interval '7 days'`,
    [userId],
  );
  const ps = passStat.rows[0] ?? { total: 0, passed: 0 };

  const kpis: DashKpi[] = [
    { label: "Assigned", value: String(assigned), tone: "default", delta: dueToday > 0 ? `${dueToday} due` : undefined },
    { label: "Overdue", value: String(overdue), tone: overdue > 0 ? "danger" : "default" },
    { label: "Pass rate", value: pct(ps.passed, ps.total), tone: "default", delta: "wk" },
  ];

  const queueRows = await tx.query<{
    id: string;
    code: string;
    title: string;
    risk: string | null;
    scheduled_at: Date | null;
    overdue: boolean;
    site: string | null;
    questions: number;
  }>(
    `SELECT i.id, i.code, i.title, i.risk, i.scheduled_at,
            (i.scheduled_at IS NOT NULL AND i.scheduled_at < now()) AS overdue,
            coalesce(p.name, a.name) AS site,
            coalesce((
              SELECT sum(jsonb_array_length(s->'items'))::int
                FROM jsonb_array_elements(t.schema->'sections') s
               WHERE jsonb_typeof(s->'items') = 'array'
            ), 0) AS questions
       FROM inspections i
       LEFT JOIN plants p ON p.id = i.plant_id
       LEFT JOIN areas  a ON a.id = i.area_id
       LEFT JOIN inspection_templates t ON t.id = i.template_id
      WHERE i.inspector_id = $1 AND i.deleted_at IS NULL AND i.status IN ('scheduled','in_progress')
      ORDER BY i.scheduled_at ASC NULLS LAST
      LIMIT 5`,
    [userId],
  );
  const queue: DashQueueItem[] = queueRows.rows.map((r) => ({
    ref: { kind: "inspection", id: r.id },
    code: r.code,
    title: r.title,
    sev: sevFrom(r.risk),
    dueAt: r.scheduled_at ? r.scheduled_at.toISOString() : null,
    overdue: r.overdue,
    site: r.site ?? "Unassigned",
    meta: `${r.questions} question${r.questions === 1 ? "" : "s"}`,
  }));

  // Assigned to me: NCRs I own that still need action, then CAPAs I own.
  const ncrRows = await tx.query<{ id: string; code: string; title: string; priority: string; status: string }>(
    `SELECT id, code, title, priority, status FROM ncrs
      WHERE owner_id = $1 AND deleted_at IS NULL AND status = ANY($2)
      ORDER BY due_at ASC NULLS LAST LIMIT 4`,
    [userId, NCR_ACTIONABLE],
  );
  const capaRows = await tx.query<{ id: string; code: string; title: string; status: string }>(
    `SELECT id, code, title, status FROM capas
      WHERE owner_id = $1 AND deleted_at IS NULL AND status <> 'closed'
      ORDER BY due_at ASC NULLS LAST LIMIT 3`,
    [userId],
  );
  const assignedRows: DashRow[] = [
    ...ncrRows.rows.map<DashRow>((r) => ({
      ref: { kind: "ncr", id: r.id },
      icon: "alert",
      iconTone: "danger",
      title: `${r.code} needs your action`,
      sub: `${r.title} · ${cap(r.priority)}`,
      status: { tone: "open", label: cap(r.status) },
    })),
    ...capaRows.rows.map<DashRow>((r) => ({
      ref: { kind: "capa", id: r.id },
      icon: "tool",
      iconTone: "info",
      title: `${r.code} · ${r.title}`,
      sub: statusLabel(r.status),
      status: { tone: "progress", label: cap(r.status) },
    })),
  ];

  return { variant: "inspector", kpis, queue, assigned: assignedRows };
}

// ── Viewer (+ auditor) ────────────────────────────────────────────────────────
async function viewer(tx: Tx): Promise<DashboardDto> {
  const openNcrs = await count(
    tx,
    `SELECT count(*)::int AS n FROM ncrs WHERE deleted_at IS NULL AND status = ANY($1)`,
    [NCR_OPEN],
  );
  const wkStat = await tx.query<{ total: number; passed: number }>(
    `SELECT count(*)::int AS total,
            count(*) FILTER (
              WHERE NOT EXISTS (
                SELECT 1 FROM findings f
                 WHERE f.inspection_id = i.id AND f.deleted_at IS NULL AND f.severity = 'critical'
              ))::int AS passed
       FROM inspections i
      WHERE i.deleted_at IS NULL AND i.status = 'completed'
        AND i.completed_at >= now() - interval '7 days'`,
    [],
  );
  const wk = wkStat.rows[0] ?? { total: 0, passed: 0 };
  const passLabel = pct(wk.passed, wk.total);

  const kpis: DashKpi[] = [
    { label: "Open NCRs", value: String(openNcrs), tone: "default" },
    {
      label: "Inspections wk",
      value: String(wk.total),
      tone: "default",
      delta: passLabel ? `${passLabel} pass` : undefined,
    },
  ];

  // Recent records: newest NCRs + inspections by update time.
  const recentNcrs = await tx.query<{ id: string; code: string; title: string; status: string }>(
    `SELECT id, code, title, status FROM ncrs
      WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT 3`,
    [],
  );
  const recentIns = await tx.query<{ id: string; code: string; title: string; status: string }>(
    `SELECT id, code, title, status FROM inspections
      WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT 3`,
    [],
  );
  const recent: DashRow[] = [
    ...recentNcrs.rows.map<DashRow>((r) => ({
      ref: { kind: "ncr", id: r.id },
      icon: "alert",
      iconTone: "danger",
      title: r.title,
      sub: `${r.code} · ${cap(r.status)}`,
      status: { tone: ncrTone(r.status), label: cap(r.status) },
    })),
    ...recentIns.rows.map<DashRow>((r) => ({
      ref: { kind: "inspection", id: r.id },
      icon: "clipboard",
      iconTone: "success",
      title: r.title,
      sub: `${r.code} · ${cap(r.status)}`,
      status: { tone: r.status === "completed" ? "done" : "progress", label: cap(r.status) },
    })),
  ];

  return { variant: "viewer", kpis, recent };
}

// ── Manager ───────────────────────────────────────────────────────────────────
async function manager(tx: Tx, userId: string, plantIds: readonly string[]): Promise<DashboardDto> {
  const docsAwaiting = await count(
    tx,
    `SELECT count(*)::int AS n FROM documents WHERE deleted_at IS NULL AND status = 'review'`,
    [],
  );
  const ncrDispositions = await count(
    tx,
    `SELECT count(*)::int AS n FROM ncrs WHERE deleted_at IS NULL AND status = 'resolved'`,
    [],
  );
  const awaiting = docsAwaiting + ncrDispositions;
  const openNcrs = await count(
    tx,
    `SELECT count(*)::int AS n FROM ncrs WHERE deleted_at IS NULL AND status = ANY($1)`,
    [NCR_OPEN],
  );
  const onTime = await tx.query<{ total: number; ontime: number }>(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE due_at IS NULL OR closed_at <= due_at)::int AS ontime
       FROM ncrs
      WHERE deleted_at IS NULL AND status = 'closed' AND closed_at >= now() - interval '30 days'`,
    [],
  );
  const ot = onTime.rows[0] ?? { total: 0, ontime: 0 };

  const kpis: DashKpi[] = [
    { label: "Awaiting", value: String(awaiting), tone: awaiting > 0 ? "warn" : "default" },
    { label: "Open NCRs", value: String(openNcrs), tone: "default" },
    { label: "On-time", value: pct(ot.ontime, ot.total), tone: "default" },
  ];

  // Team today: other members (scoped to the manager's plants when they have a
  // scope; else the whole workspace), with today's inspection activity.
  const scoped = plantIds.length > 0;
  const teamRows = await tx.query<{
    user_id: string;
    name: string;
    done: number;
    in_progress: number;
    online: boolean;
  }>(
    `SELECT m.user_id, u.name,
            coalesce(d.done, 0)::int AS done,
            coalesce(d.in_progress, 0)::int AS in_progress,
            EXISTS (
              SELECT 1 FROM sessions s
               WHERE s.user_id = m.user_id AND s.revoked_at IS NULL AND s.expires_at > now()
            ) AS online
       FROM memberships m
       JOIN control.users u ON u.id = m.user_id
       LEFT JOIN LATERAL (
         SELECT count(*) FILTER (WHERE i.status = 'completed' AND i.completed_at::date = now()::date) AS done,
                count(*) FILTER (WHERE i.status = 'in_progress') AS in_progress
           FROM inspections i
          WHERE i.inspector_id = m.user_id AND i.deleted_at IS NULL
       ) d ON true
      WHERE m.user_id <> $1
        AND ($2::boolean = false OR m.plant_ids && $3::uuid[])
      ORDER BY u.name
      LIMIT 8`,
    [userId, scoped, scoped ? plantIds : []],
  );
  const team: DashTeamMember[] = teamRows.rows.map((r) => {
    const bits: string[] = [];
    if (r.done > 0) bits.push(`${r.done} done`);
    if (r.in_progress > 0) bits.push(`${r.in_progress} in progress`);
    return {
      userId: r.user_id,
      initials: initialsOf(r.name),
      name: r.name,
      summary: bits.length > 0 ? bits.join(" · ") : r.online ? "Active" : "No activity today",
      online: r.online,
    };
  });

  return {
    variant: "manager",
    kpis,
    approvals: { documents: docsAwaiting, ncrDispositions, total: awaiting },
    team,
  };
}

// ── Admin ─────────────────────────────────────────────────────────────────────
async function admin(tx: Tx): Promise<DashboardDto> {
  const activeToday = await count(
    tx,
    `SELECT count(DISTINCT actor_id)::int AS n FROM audit_events
      WHERE actor_id IS NOT NULL AND created_at::date = now()::date`,
    [],
  );
  const totalMembers = await count(tx, `SELECT count(*)::int AS n FROM memberships`, []);
  const docsAwaiting = await count(
    tx,
    `SELECT count(*)::int AS n FROM documents WHERE deleted_at IS NULL AND status = 'review'`,
    [],
  );
  const ncrDispositions = await count(
    tx,
    `SELECT count(*)::int AS n FROM ncrs WHERE deleted_at IS NULL AND status = 'resolved'`,
    [],
  );
  const awaiting = docsAwaiting + ncrDispositions;

  const kpis: DashKpi[] = [
    { label: "Active today", value: String(activeToday), tone: "default", delta: `/ ${totalMembers}` },
    // No tenant-wide sync-failure telemetry exists server-side — honest "—", not a fake 0.
    { label: "Failed syncs", value: null, tone: "danger" },
    { label: "Awaiting", value: String(awaiting), tone: awaiting > 0 ? "warn" : "default" },
  ];

  // Needs attention — real security/ops signals from the audit trail + SLA state.
  const needsAttention: DashRow[] = [];
  const failedSignins = await count(
    tx,
    `SELECT count(*)::int AS n FROM audit_events
      WHERE action = 'sign_in_failed' AND created_at::date = now()::date`,
    [],
  );
  if (failedSignins > 0) {
    needsAttention.push({
      ref: { kind: "audit", id: "00000000-0000-0000-0000-000000000000" },
      icon: "shield",
      iconTone: "warn",
      title: `${failedSignins} failed sign-in${failedSignins === 1 ? "" : "s"} today`,
      sub: "Review the audit log for anomalies",
      status: { tone: "warn", label: "Review" },
    });
  }
  const breached = await count(
    tx,
    `SELECT count(*)::int AS n FROM ncrs WHERE deleted_at IS NULL AND sla_state = 'breached' AND status = ANY($1)`,
    [NCR_OPEN],
  );
  if (breached > 0) {
    needsAttention.push({
      ref: { kind: "ncr", id: "00000000-0000-0000-0000-000000000000" },
      icon: "alert",
      iconTone: "danger",
      title: `${breached} NCR${breached === 1 ? "" : "s"} breached SLA`,
      sub: "Past due — needs escalation",
      status: { tone: "danger", label: "Breached" },
    });
  }

  // Audit highlights — recent sensitive events, actor-named.
  const SENSITIVE = ["role_changed", "settings_changed", "exported", "deleted", "purged", "entitlement_changed"];
  const auditRows = await tx.query<{
    id: string;
    action: string;
    entity_kind: string;
    actor_name: string | null;
    created_at: Date;
  }>(
    `SELECT a.id::text AS id, a.action, a.entity_kind, u.name AS actor_name, a.created_at
       FROM audit_events a
       LEFT JOIN control.users u ON u.id = a.actor_id
      WHERE a.action = ANY($1)
      ORDER BY a.created_at DESC
      LIMIT 5`,
    [SENSITIVE],
  );
  const auditHighlights: DashAuditItem[] = auditRows.rows.map((r) => ({
    id: r.id,
    icon: auditIcon(r.action),
    title: auditTitle(r.action),
    detail: `${r.entity_kind}${r.actor_name ? ` · by ${r.actor_name}` : ""}`,
    at: r.created_at.toISOString(),
  }));

  return { variant: "admin", kpis, needsAttention, auditHighlights };
}

// ── Dispatch ──────────────────────────────────────────────────────────────────
export function buildDashboard(
  tx: Tx,
  role: string,
  userId: string,
  plantIds: readonly string[],
): Promise<DashboardDto> {
  switch (role) {
    case "inspector":
      return inspector(tx, userId);
    case "manager":
      return manager(tx, userId, plantIds);
    case "admin":
      return admin(tx);
    // auditor + viewer + anything unknown → the read-only viewer surface.
    default:
      return viewer(tx);
  }
}

// ── Small presentation-neutral mappers ─────────────────────────────────────────
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}
function statusLabel(s: string): string {
  return cap(s);
}
function sevFrom(risk: string | null): DashQueueItem["sev"] {
  switch (risk) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    case "medium":
      return "medium";
    case "low":
      return "low";
    default:
      return undefined;
  }
}
function ncrTone(status: string): string {
  if (status === "closed" || status === "verified") return "done";
  if (status === "escalated" || status === "reopened") return "danger";
  if (status === "in_progress" || status === "assigned") return "progress";
  return "open";
}
function auditIcon(action: string): string {
  switch (action) {
    case "role_changed":
      return "key";
    case "settings_changed":
      return "settings";
    case "exported":
      return "download";
    case "deleted":
    case "purged":
      return "trash";
    case "entitlement_changed":
      return "shield";
    default:
      return "activity";
  }
}
function auditTitle(action: string): string {
  switch (action) {
    case "role_changed":
      return "Role changed";
    case "settings_changed":
      return "Settings changed";
    case "exported":
      return "Bulk export";
    case "deleted":
      return "Record deleted";
    case "purged":
      return "Record purged";
    case "entitlement_changed":
      return "Entitlement changed";
    default:
      return cap(action);
  }
}
