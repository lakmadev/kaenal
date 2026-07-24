import type { LucideIcon } from "lucide-react";
import { ClipboardList } from "lucide-react";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  body?: string;
  action?: React.ReactNode;
}

/** Empty-state pattern (04 §6.2): icon + one line + a primary CTA. */
export function EmptyState({ icon: Icon = ClipboardList, title, body, action }: EmptyStateProps): React.ReactElement {
  return (
    <div className="px-6 py-12 text-center text-muted">
      <div className="mb-4 inline-flex rounded-full bg-bg-subtle p-4">
        <Icon size={32} strokeWidth={1.5} aria-hidden />
      </div>
      <div className="mb-1 text-[16px] font-semibold text-text">{title}</div>
      {body !== undefined && <div className="mb-4 text-[13px]">{body}</div>}
      {action}
    </div>
  );
}
