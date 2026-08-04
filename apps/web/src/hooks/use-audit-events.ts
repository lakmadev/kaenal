"use client";

import { useQuery } from "@tanstack/react-query";
import { apiQueries } from "@kaenal/api-client";
import type { EntityKind } from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/**
 * The audit trail for one record (07 §1). Read-only: every mutation writes an
 * event in-transaction (`withAudit`), so this is the record's real activity
 * history — who did what and when, without leaking payloads. Powers the detail
 * "Activity" tab in place of any fabricated timeline.
 */
export function useAuditEvents(entityKind: EntityKind, entityId: string) {
  return useQuery(apiQueries.auditEvents.list(getApiClient(), entityKind, entityId));
}
