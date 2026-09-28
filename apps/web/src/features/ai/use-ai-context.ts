"use client";

import { usePathname } from "next/navigation";
import { EntityKind, type AiChatEntityRef } from "@kaenal/types";
import { breadcrumbsFor } from "@/config/breadcrumbs";
import { useEntityCode } from "@/hooks/use-entity-code";

/** Detail-route root -> the entity kind the chat API resolves under RLS. */
const ROOT_KIND: Record<string, string> = {
  inspections: "inspection",
  ncrs: "ncr",
  "8d": "eight_d",
  capa: "capa",
  documents: "document",
  suppliers: "supplier",
  scars: "scar",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AiContext {
  /** Sent to the API when the user is on a record's detail page. */
  entityRef: AiChatEntityRef | undefined;
  /** Shown in the drawer header: "Context aware · {label}". */
  label: string;
}

/** What the assistant is looking at: the record on a detail route, else the page name. */
export function useAiContext(): AiContext {
  const pathname = usePathname();
  const code = useEntityCode(pathname);
  const [root, id, extra] = pathname.split("/").filter(Boolean);

  const kind = root !== undefined ? EntityKind.safeParse(ROOT_KIND[root]) : undefined;
  const entityRef =
    kind?.success === true && id !== undefined && extra === undefined && UUID.test(id)
      ? { kind: kind.data, id }
      : undefined;

  const crumbs = breadcrumbsFor(pathname, null, code);
  const label = crumbs[crumbs.length - 1]?.label ?? "Kaenal";
  return { entityRef, label };
}
