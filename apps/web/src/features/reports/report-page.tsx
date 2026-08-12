"use client";

import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState, Spinner } from "@/components/ui";
import { useCan } from "@/hooks/use-me";
import { useReport } from "@/hooks/use-reports";
import { ReportBuilder } from "./report-builder";
import { ReportCanvas } from "./report-canvas";

/**
 * One report or dashboard. A `report:manage` role edits a saved report in the
 * builder; everyone else (and any built-in dashboard) sees the read-only render
 * — both go through the same query engine.
 */
export function ReportPage({ id }: { id: string }): React.ReactElement {
  const canManage = useCan("report:manage");
  const { data: report, isLoading, isError } = useReport(id);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }
  if (isError || report === undefined) {
    return <EmptyState icon={BarChart3} title="Report not found" body="It may have been deleted, or you don't have access." />;
  }

  const editable = canManage && !report.builtin;
  if (editable) return <ReportBuilder report={report} />;

  return (
    <div>
      <PageHeader title={report.name} description={report.builtin ? "Built-in dashboard · live" : report.description || "Report"} />
      <div className="px-7 pb-8">
        <ReportCanvas tiles={report.tiles} />
      </div>
    </div>
  );
}
