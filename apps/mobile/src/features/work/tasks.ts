import type { CapaDto, EightDDto } from "@kaenal/types";

// Pure unified-inbox aggregation (05 §M9) — no React/RN imports, so it is
// unit-testable and identical to what the UI shows.

export type TaskKind = "ncr" | "capa" | "inspection" | "eightd";

export interface UnifiedTask {
  kind: TaskKind;
  id: string;
  code: string;
  title: string;
  dueAt: string | null;
  tag: string;
  route: string;
}

const NCR_OPEN = new Set(["draft", "open", "assigned", "in_progress", "reopened", "escalated"]);

/**
 * The "assigned to me" inbox, aggregated CLIENT-SIDE from the per-module lists
 * filtered to the caller — there is no `/v1/me/tasks` endpoint yet, so this is
 * bounded by the plant-scoped lists (a backend aggregation would make it
 * exhaustive; flagged in PROGRESS).
 */
export function buildTasks(
  userId: string | undefined,
  ncrs: { id: string; code: string; title: string; ownerId: string | null; status: string; dueAt: string | null }[],
  capas: CapaDto[],
  inspections: { id: string; code: string; title: string; inspectorId: string | null; status: string; scheduledAt: string | null }[],
  eightDs: EightDDto[],
): UnifiedTask[] {
  if (userId === undefined) return [];
  const tasks: UnifiedTask[] = [];

  for (const n of ncrs) {
    if (n.ownerId === userId && NCR_OPEN.has(n.status)) {
      tasks.push({ kind: "ncr", id: n.id, code: n.code, title: n.title, dueAt: n.dueAt, tag: "NCR", route: `/ncr/${n.id}` });
    }
  }
  for (const c of capas) {
    if (c.ownerId === userId && c.status !== "closed") {
      tasks.push({ kind: "capa", id: c.id, code: c.code, title: c.title, dueAt: c.dueAt, tag: "CAPA", route: `/capa/${c.id}` });
    }
  }
  for (const i of inspections) {
    if (i.inspectorId === userId && (i.status === "scheduled" || i.status === "in_progress")) {
      tasks.push({ kind: "inspection", id: i.id, code: i.code, title: i.title, dueAt: i.scheduledAt, tag: "Inspection", route: `/inspection/${i.id}` });
    }
  }
  for (const e of eightDs) {
    const mine = e.teamLeadId === userId || e.championId === userId || e.memberIds.includes(userId);
    if (mine && e.status === "active") {
      tasks.push({ kind: "eightd", id: e.id, code: `${e.code} · D${e.currentStep}`, title: e.title, dueAt: e.targetAt, tag: "8D", route: `/8d/${e.id}` });
    }
  }
  return tasks;
}
