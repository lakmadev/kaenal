"use client";

import { useQuery } from "@tanstack/react-query";
import { apiQueries } from "@kaenal/api-client";
import type { Query } from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/**
 * The query engine (`/v1/query*`). The report builder and every bound widget
 * run a `Query` through these — the same engine the API compiles server-side, so
 * a tile's preview and its persisted render are identical. A run is disabled
 * until the query names a source (and, for a series, a dimension).
 */
export function useQuerySources() {
  return useQuery(apiQueries.query.sources(getApiClient()));
}

function hasSource(q: Query | null): q is Query {
  return q !== null && typeof q.sourceId === "string" && q.sourceId !== "";
}

export function useQueryRows(q: Query | null) {
  const client = getApiClient();
  return useQuery({
    ...apiQueries.query.rows(client, q ?? { sourceId: "" }),
    enabled: hasSource(q),
  });
}

export function useQueryMetric(q: Query | null) {
  const client = getApiClient();
  return useQuery({
    ...apiQueries.query.metric(client, q ?? { sourceId: "" }),
    enabled: hasSource(q),
  });
}

export function useQuerySeries(q: Query | null) {
  const client = getApiClient();
  const ready = hasSource(q) && typeof q.dimension === "string" && q.dimension !== "";
  return useQuery({
    ...apiQueries.query.series(client, q ?? { sourceId: "" }),
    enabled: ready,
  });
}
