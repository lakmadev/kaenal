import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/ui";

/**
 * Placeholder for a module whose screens are not built yet. Renders inside the
 * shell so navigation is complete during the foundation phase; each module
 * replaces this with its real list/detail slice (04 §5).
 */
export function ModulePlaceholder({
  title,
  icon,
  description,
}: {
  title: string;
  icon: LucideIcon;
  description?: string;
}): React.ReactElement {
  return (
    <div className="mx-auto max-w-7xl p-6">
      <h1 className="mb-6 text-[26px] font-bold tracking-tight text-text">{title}</h1>
      <div className="k-surface">
        <EmptyState
          icon={icon}
          title={`${title} is coming soon`}
          body={description ?? "This module's screens are next on the build plan."}
        />
      </div>
    </div>
  );
}
