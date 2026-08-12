"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, LayoutDashboard, Plus } from "lucide-react";
import type { ReportDefinitionDto } from "@kaenal/types";
import { PageHeader } from "@/components/page-header";
import { Button, Card, CardContent, EmptyState, Segmented, Spinner, useToast } from "@/components/ui";
import { useCan } from "@/hooks/use-me";
import { useCreateReport, useReports } from "@/hooks/use-reports";

type View = "dashboards" | "reports";

function ReportCard({ report, onOpen }: { report: ReportDefinitionDto; onOpen: () => void }): React.ReactElement {
  return (
    <Card className="cursor-pointer transition-shadow hover:shadow-sm" onClick={onOpen}>
      <CardContent className="pt-5">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-sm font-semibold">{report.name}</span>
          {report.builtin && (
            <span className="rounded-full bg-[var(--accent-soft,var(--bg-subtle))] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">Built-in</span>
          )}
        </div>
        <p className="mb-3 line-clamp-2 text-xs text-[var(--text-muted)]">{report.description || "No description"}</p>
        <div className="text-[11px] text-[var(--text-subtle)]">{report.tiles.length} tile{report.tiles.length === 1 ? "" : "s"}</div>
      </CardContent>
    </Card>
  );
}

export function ReportsHome(): React.ReactElement {
  const router = useRouter();
  const toast = useToast();
  const canManage = useCan("report:manage");
  const { data, isLoading } = useReports();
  const create = useCreateReport();
  const [view, setView] = useState<View>("dashboards");

  const items = data?.items ? [...data.items] : [];
  const dashboards = items.filter((r) => r.builtin);
  const saved = items.filter((r) => !r.builtin);
  const shown = view === "dashboards" ? dashboards : saved;

  const newReport = (): void => {
    create.mutate(
      { name: "Untitled report", description: "" },
      {
        onSuccess: (dto) => router.push(`/reports/${dto.id}`),
        onError: () => toast.error("Couldn't create the report."),
      },
    );
  };

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Live dashboards and custom reports, all on one query engine."
        actions={
          canManage ? (
            <Button variant="primary" onClick={newReport} loading={create.isPending}>
              <Plus size={14} /> New report
            </Button>
          ) : undefined
        }
      />

      <div className="px-7 pb-8">
        <div className="mb-5">
          <Segmented
            value={view}
            onChange={setView}
            ariaLabel="Report view"
            options={[
              { value: "dashboards", label: "Dashboards", icon: LayoutDashboard },
              { value: "reports", label: "My reports", icon: BarChart3 },
            ]}
          />
        </div>

        {isLoading ? (
          <Spinner />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title={view === "dashboards" ? "No dashboards" : "No saved reports yet"}
            body={view === "dashboards" ? "Built-in dashboards will appear here." : canManage ? "Create your first report to get started." : "Reports your team builds will appear here."}
            action={view === "reports" && canManage ? <Button variant="primary" onClick={newReport}><Plus size={14} /> New report</Button> : undefined}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((r) => (
              <ReportCard key={r.id} report={r} onOpen={() => router.push(`/reports/${r.id}`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
