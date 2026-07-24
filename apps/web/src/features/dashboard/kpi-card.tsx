import type { LucideIcon } from "lucide-react";
import { Card, Skeleton } from "@/components/ui";

export interface KpiCardProps {
  label: string;
  value: string | undefined;
  icon: LucideIcon;
  loading?: boolean;
  isError?: boolean;
}

/** A dashboard KPI tile (04 §5 Dashboard). Handles its own loading/error state. */
export function KpiCard({ label, value, icon: Icon, loading, isError }: KpiCardProps): React.ReactElement {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="k-overline">{label}</div>
        <Icon size={16} className="text-subtle" aria-hidden />
      </div>
      <div className="mono mt-3 text-[28px] font-bold leading-none text-text">
        {loading ? <Skeleton className="h-7 w-16" /> : isError ? "—" : (value ?? "0")}
      </div>
    </Card>
  );
}
