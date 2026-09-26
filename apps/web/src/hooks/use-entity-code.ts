"use client";

import { skipToken, useQuery } from "@tanstack/react-query";
import { z } from "zod";

/** URL root -> the first segment of that entity's detail query key (api-client query-keys.ts). */
const KEY_ROOT: Record<string, string> = {
  inspections: "inspections",
  ncrs: "ncrs",
  capa: "capas",
  documents: "documents",
  suppliers: "suppliers",
  ppap: "ppap",
  scars: "scars",
  "8d": "eightDs",
};

const WithCode = z.object({ code: z.string().nullable().optional() });

/**
 * The entity code (e.g. "NCR-0012") for a detail-page path, read from the
 * already-loaded detail record in the query cache (D-02c). Never fetches:
 * `skipToken` makes this a passive subscription, so it is null until the page
 * itself has loaded the record and the breadcrumb falls back to "Detail".
 */
export function useEntityCode(pathname: string): string | null {
  const [root, id, extra] = pathname.split("/").filter(Boolean);
  const keyRoot = root !== undefined ? KEY_ROOT[root] : undefined;
  const isDetail = keyRoot !== undefined && id !== undefined && extra === undefined;
  const { data } = useQuery({
    queryKey: isDetail ? [keyRoot, "detail", id] : ["entity-code", "none"],
    queryFn: skipToken,
  });
  if (!isDetail) return null;
  const parsed = WithCode.safeParse(data);
  return parsed.success ? (parsed.data.code ?? null) : null;
}
