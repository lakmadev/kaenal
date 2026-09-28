"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, FileDown } from "lucide-react";
import { unwrap } from "@kaenal/api-client";
import type { ExportDto } from "@kaenal/types";
import { getApiClient } from "@/lib/api";
import { Button } from "@/components/ui";
import { useForecastPackExport } from "@/hooks/use-predictions";

/**
 * "Forecast pack" export (P3/P4, `predictive.jsx` line 192) — wired to the
 * real `predictive_forecast_pack` export pipeline (`run-export.ts`), the same
 * create-then-poll UX as `audit_report`/`AiPdfAction` (progress → notification
 * → download), never the jsx's fire-and-forget `kToast('Export started…')`.
 */
export function ForecastPackExportButton(): React.ReactElement {
  const client = getApiClient();
  const create = useForecastPackExport();

  const exportId = create.data?.id;
  const { data: polled, isError: pollFailed } = useQuery({
    queryKey: ["exports", "forecast-pack", exportId],
    enabled: exportId !== undefined,
    queryFn: () => client.getExport({ params: { id: exportId ?? "" } }).then((r) => unwrap<ExportDto>(r)),
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return status === "completed" || status === "failed" ? false : 1500;
    },
  });

  const status = polled?.status ?? create.data?.status;

  if (status === "completed" && polled?.downloadUrl != null) {
    return (
      <a href={polled.downloadUrl} className="k-btn k-btn-ghost" download>
        <Download size={13} aria-hidden />
        Download pack
      </a>
    );
  }
  if (create.isPending || status === "queued" || status === "processing") {
    return (
      <Button loading disabled>
        Preparing pack…
      </Button>
    );
  }
  if (create.isError || status === "failed" || pollFailed) {
    return (
      <Button variant="ghost" onClick={() => create.mutate()}>
        <FileDown size={13} aria-hidden /> Retry forecast pack
      </Button>
    );
  }
  return (
    <Button variant="ghost" onClick={() => create.mutate()}>
      <FileDown size={13} aria-hidden /> Forecast pack
    </Button>
  );
}
