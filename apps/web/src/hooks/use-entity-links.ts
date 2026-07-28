"use client";

import { useQuery } from "@tanstack/react-query";
import { apiQueries } from "@kaenal/api-client";
import type { EntityKind } from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/**
 * Related records (FEATURES §329). Read-only here — the document detail's
 * "Linked records" tab lists edges touching the record on either side. Links are
 * created by cross-module flows (and the `/v1/entity-links` write endpoints);
 * this hook just reads them.
 */
export function useEntityLinks(entityKind: EntityKind, entityId: string) {
  return useQuery(apiQueries.entityLinks.list(getApiClient(), entityKind, entityId));
}
