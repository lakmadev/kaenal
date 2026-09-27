"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { FileDown } from "lucide-react";
import { unwrap } from "@kaenal/api-client";
import type { ExportDto } from "@kaenal/types";
import { getApiClient } from "@/lib/api";
import { Button } from "@/components/ui";
import type { AiChatDone } from "./use-ai-chat";

/**
 * "Generate PDF" (Q7): an `ai_reply` export through the existing exports
 * pipeline. Idle -> preparing (poll `getExport`) -> ready ("Download PDF" with the
 * presigned URL) or failed ("Retry PDF" re-requests the export).
 */
export function AiPdfAction({ text, provenance }: { text: string; provenance: AiChatDone }): React.ReactElement {
  const t = useTranslations("ai");
  const client = getApiClient();

  const create = useMutation({
    mutationFn: () =>
      client
        .createExport({
          body: {
            resource: "ai_reply",
            format: "pdf",
            aiReply: {
              text: text.slice(0, 20_000),
              confidence: provenance.confidence,
              provider: provenance.provider.slice(0, 40),
              invocationId: provenance.invocationId,
              sources: provenance.sources.map((s) => ({ kind: s.kind.slice(0, 40), id: s.id.slice(0, 64) })),
              generatedAt: new Date().toISOString(),
            },
          },
        })
        .then((r) => unwrap<ExportDto>(r)),
  });

  const exportId = create.data?.id;
  const { data: polled, isError: pollFailed } = useQuery({
    queryKey: ["exports", "ai-reply", exportId],
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
      <a href={polled.downloadUrl} className="k-btn k-btn-sm k-btn-ghost" download>
        <FileDown size={13} aria-hidden />
        {t("downloadPdf")}
      </a>
    );
  }
  if (create.isPending || status === "queued" || status === "processing") {
    return (
      <Button size="sm" loading disabled>
        {t("preparingPdf")}
      </Button>
    );
  }
  if (create.isError || status === "failed" || pollFailed) {
    return (
      <Button size="sm" variant="ghost" loading={false} onClick={() => create.mutate()} title={t("pdfFailed")}>
        <FileDown size={13} aria-hidden />
        {t("retryPdf")}
      </Button>
    );
  }
  return (
    <Button size="sm" variant="ghost" loading={false} onClick={() => create.mutate()}>
      <FileDown size={13} aria-hidden />
      {t("generatePdf")}
    </Button>
  );
}
