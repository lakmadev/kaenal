"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys, unwrap } from "@kaenal/api-client";
import type { DocumentDto, EightDDto, InspectionDto, NcrDto, PlantDto, RiskDto, TemplateDto, Page } from "@kaenal/types";
import type { WizardBody } from "@kaenal/core";
import { getApiClient } from "@/lib/api";

/** The record a wizard create returns, whichever type it was. */
export type WizardCreated =
  | { type: "inspection"; record: InspectionDto }
  | { type: "ncr"; record: NcrDto }
  | { type: "8d"; record: EightDDto }
  | { type: "document"; record: DocumentDto }
  | { type: "risk"; record: RiskDto };

function detailPath(created: WizardCreated): string {
  switch (created.type) {
    case "inspection":
      return `/inspections/${created.record.id}`;
    case "ncr":
      return `/ncrs/${created.record.id}`;
    case "8d":
      return `/8d/${created.record.id}`;
    case "document":
      return `/documents/${created.record.id}`;
    case "risk":
      // R4 AC (`?id=` deep-link, uuid not code) — the /risk list page may not
      // exist yet (risk-UI is a separate slice); this is only the nav target.
      return `/risk?id=${created.record.id}`;
  }
}

function code(created: WizardCreated): string {
  return created.record.code;
}

function title(created: WizardCreated): string {
  return created.record.title;
}

export { detailPath as wizardDetailPath, code as wizardCode, title as wizardTitle };

/** Sites the caller may raise records in — the wizard's "Site" select (S1-1). */
export function usePlants() {
  return useQuery({
    queryKey: ["plants", "list"],
    queryFn: () => getApiClient().listPlants({}).then((r) => unwrap<{ items: PlantDto[] }>(r)),
  });
}

/** Published inspection templates — the wizard's inspection template pool. */
export function useWizardPublishedTemplates() {
  const client = getApiClient();
  return useQuery({
    queryKey: ["templates", "list", "published"],
    queryFn: () =>
      client.listTemplates({ query: { status: "published" } }).then((r) => unwrap<Page<TemplateDto>>(r)),
  });
}

/**
 * Posts a completed wizard draft to the right create route with the given
 * idempotency key (one per wizard session — a retry with the same key never
 * double-creates, W7-E/H). Never `fetch` in a component (rule: all data via a
 * hook); this is the single mutation every wizard step 4 calls.
 */
export function useWizardCreate() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ wb, idempotencyKey }: { wb: WizardBody; idempotencyKey: string }): Promise<WizardCreated> => {
      const extraHeaders = { "idempotency-key": idempotencyKey };
      switch (wb.type) {
        case "inspection":
          return { type: "inspection", record: await client.createInspection({ body: wb.body, extraHeaders }).then((r) => unwrap<InspectionDto>(r)) };
        case "ncr":
          return { type: "ncr", record: await client.createNcr({ body: wb.body, extraHeaders }).then((r) => unwrap<NcrDto>(r)) };
        case "8d":
          return { type: "8d", record: await client.createEightD({ body: wb.body, extraHeaders }).then((r) => unwrap<EightDDto>(r)) };
        case "document":
          return { type: "document", record: await client.createDocument({ body: wb.body, extraHeaders }).then((r) => unwrap<DocumentDto>(r)) };
        case "risk":
          return { type: "risk", record: await client.createRisk({ body: wb.body, extraHeaders }).then((r) => unwrap<RiskDto>(r)) };
      }
    },
    onSuccess: (created) => {
      const key =
        created.type === "inspection"
          ? queryKeys.inspections.list()
          : created.type === "ncr"
            ? queryKeys.ncrs.list()
            : created.type === "8d"
              ? queryKeys.eightDs.all
              : created.type === "document"
                ? queryKeys.documents.list()
                : queryKeys.risks.list();
      void qc.invalidateQueries({ queryKey: key });
    },
  });
}
