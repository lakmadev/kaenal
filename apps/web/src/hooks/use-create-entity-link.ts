"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys, unwrap } from "@kaenal/api-client";
import type { CreateEntityLinkBody, EntityLinkDto } from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/**
 * Writes a real `entity_links` row (Sprint 04 R3 AC1/AC6). `POST /v1/entity-links`
 * already exists on the API; this is the first web caller of the write side (the
 * three existing consumers of `useEntityLinks` only read). Invalidates BOTH ends'
 * `entityLinks.list` query — a link is stored once but read from either side, so
 * both the "from" record's panel and the "to" record's reverse pane must refetch.
 */
export function useCreateEntityLink() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateEntityLinkBody) => client.createEntityLink({ body }).then((r) => unwrap<EntityLinkDto>(r)),
    onSuccess: (link) => {
      void qc.invalidateQueries({ queryKey: queryKeys.entityLinks.list(link.fromKind, link.fromId) });
      void qc.invalidateQueries({ queryKey: queryKeys.entityLinks.list(link.toKind, link.toId) });
    },
  });
}
