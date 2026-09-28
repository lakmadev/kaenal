import { randomUUID } from "node:crypto";
import type { Tx } from "@kaenal/db";
import type { EntityPersonInput } from "@kaenal/types";
import { isPastDue } from "@kaenal/core";
import { ApiError, notFound } from "../errors.js";
import type { NotificationsService } from "../notifications/notifications.service.js";

/**
 * Shared pieces of the CreateWizard create paths (Sprint 01 S1-1): validating
 * the foreign ids the wizard sends and persisting the "Assignees & approvals"
 * step. Every check runs on the request's RLS-scoped transaction, so an id that
 * belongs to another tenant is invisible and reads as 404 (rule 8) — never 403.
 */

/** A plant that exists in this tenant (RLS hides foreign ones) → else 404. */
export async function assertPlantExists(tx: Tx, plantId: string | null | undefined): Promise<void> {
  if (plantId == null) return;
  const { rows } = await tx.query("SELECT 1 FROM plants WHERE id = $1 AND deleted_at IS NULL", [plantId]);
  if (rows.length === 0) throw notFound();
}

/** Every person must be an active member of THIS tenant → else 404. */
export async function assertPeopleAreMembers(
  tx: Tx,
  people: readonly EntityPersonInput[] | undefined,
): Promise<void> {
  if (people === undefined || people.length === 0) return;
  const ids = [...new Set(people.map((p) => p.userId))];
  const { rows } = await tx.query<{ user_id: string }>(
    "SELECT user_id FROM memberships WHERE user_id = ANY($1::uuid[]) AND status = 'active' AND deleted_at IS NULL",
    [ids],
  );
  if (rows.length !== ids.length) throw notFound();
}

/** One entry per user (a later duplicate wins, so the UI's last role change sticks). */
export function dedupePeople(people: readonly EntityPersonInput[] | undefined): EntityPersonInput[] {
  const byUser = new Map<string, EntityPersonInput>();
  for (const p of people ?? []) byUser.set(p.userId, p);
  return [...byUser.values()];
}

/** The first person holding `role`, if any. */
export function firstWithRole(people: readonly EntityPersonInput[], role: EntityPersonInput["role"]): string | null {
  return people.find((p) => p.role === role)?.userId ?? null;
}

export type PeopleEntityKind = "inspection" | "ncr" | "eight_d" | "document";

/** Persist the wizard's people (one row per person + role) in the caller's tx. */
export async function insertEntityPeople(
  t: Tx,
  tenantId: string,
  actorId: string,
  kind: PeopleEntityKind,
  entityId: string,
  people: readonly EntityPersonInput[],
): Promise<void> {
  for (const p of people) {
    await t.query(
      `INSERT INTO entity_people (id, tenant_id, entity_kind, entity_id, user_id, role, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7)`,
      [randomUUID(), tenantId, kind, entityId, p.userId, p.role, actorId],
    );
  }
}

const NOTIFY_KIND: Readonly<Record<PeopleEntityKind, string>> = {
  inspection: "inspection_assigned",
  ncr: "ncr_assigned",
  eight_d: "eight_d_assigned",
  document: "document_assigned",
};

/**
 * "Assignees get an in-app + email notification" (createwizard.jsx step 3):
 * in-app rows in the same transaction (the notify queue fans out to email/push).
 * Never notifies the creator of their own action.
 */
export async function notifyPeople(
  t: Tx,
  notifications: NotificationsService,
  tenantId: string,
  actorId: string,
  kind: PeopleEntityKind,
  entityId: string,
  code: string,
  people: readonly EntityPersonInput[],
): Promise<void> {
  for (const p of people) {
    if (p.userId === actorId) continue;
    await notifications.notify(t, tenantId, {
      userId: p.userId,
      actorId,
      kind: NOTIFY_KIND[kind],
      title: `${code} — you were added as ${p.role}`,
      entityKind: kind,
      entityId,
      dedupeKey: `wizard-people:${kind}:${entityId}:${p.userId}`,
    });
  }
}

/** "Due date can't be in the past" as a field-mapped 422 (wizard W7-G). */
export function assertNotPast(field: string, iso: string | null | undefined): void {
  if (iso == null) return;
  if (isPastDue(iso, new Date())) {
    throw new ApiError("VALIDATION_FAILED", "Request is invalid", {
      issues: [{ path: field, message: "Due date can't be in the past" }],
    });
  }
}
