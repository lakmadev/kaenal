"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button, Segmented } from "@/components/ui";

export type EcnView = "list" | "kanban";

/**
 * `ECNWorkbench`'s header (`qms-modules.jsx:528-547`) — title/description,
 * the List/Kanban segmented toggle, and "New ECN". Shared by
 * `EcnListPage`/`EcnKanbanPage` so both views render the exact same chrome
 * the jsx draws once around a swappable body.
 */
export function EcnHeader({
  view,
  onViewChange,
  canManage,
}: {
  view: EcnView;
  onViewChange: (v: EcnView) => void;
  canManage: boolean;
}): React.ReactElement {
  const router = useRouter();
  return (
    <PageHeader
      title="Engineering change notices"
      description="Multi-stage approval workflow for design, process, tooling, and material changes. Auto-revises affected documents."
      actions={
        <>
          <Segmented
            size="sm"
            value={view}
            onChange={onViewChange}
            ariaLabel="View"
            options={[
              { value: "list", label: "List" },
              { value: "kanban", label: "Kanban" },
            ]}
          />
          {canManage && (
            <Button variant="primary" onClick={() => router.push("/create/ecn")}>
              <Plus size={14} aria-hidden /> New ECN
            </Button>
          )}
        </>
      }
    />
  );
}
