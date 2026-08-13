/**
 * Connector metadata + the adapter contract (09-INTEGRATIONS §1; report-data.jsx
 * `RB_CONNECTORS`). Every provider on the registry has a category and an
 * `external` flag; external data-source providers additionally declare a field
 * schema via {@link connectorSchema}, which the settings UI and the report
 * builder's source picker read.
 *
 * The adapter *interface* lives here (the contract three call sites share);
 * concrete adapters that actually reach SAP/Snowflake/etc. live in the API and
 * are cache/rate-limited — per 09 §6 we ship the substrate, not point
 * connectors, so external providers declare their shape but fetch is stubbed.
 */

import type { ConnectorField, IntegrationProvider } from "@kaenal/types";

export type ConnectorCategory = "messaging" | "erp" | "warehouse" | "bi" | "file" | "api" | "email";

export interface ConnectorMeta {
  readonly provider: IntegrationProvider;
  readonly label: string;
  readonly origin: string;
  readonly category: ConnectorCategory;
  /** External systems require a credential/connect flow; internal (smtp) do not. */
  readonly external: boolean;
  /** A data source the query engine / bulk import can read from (has a schema). */
  readonly dataSource: boolean;
  readonly description: string;
}

export const CONNECTOR_META: Readonly<Record<IntegrationProvider, ConnectorMeta>> = {
  slack: { provider: "slack", label: "Slack", origin: "Slack", category: "messaging", external: true, dataSource: false, description: "Notifications & alerts to channels" },
  ms_teams: { provider: "ms_teams", label: "Microsoft Teams", origin: "Teams", category: "messaging", external: true, dataSource: false, description: "Adaptive Card notifications" },
  ms365: { provider: "ms365", label: "Microsoft 365", origin: "Microsoft", category: "messaging", external: true, dataSource: false, description: "Calendar & SharePoint (Graph)" },
  google: { provider: "google", label: "Google Workspace", origin: "Google", category: "messaging", external: true, dataSource: false, description: "Calendar sync & SSO" },
  smtp: { provider: "smtp", label: "Email (SMTP)", origin: "Email", category: "email", external: false, dataSource: false, description: "Transactional email delivery" },
  sap: { provider: "sap", label: "SAP S/4HANA", origin: "SAP", category: "erp", external: true, dataSource: true, description: "Production orders · scrap · defects" },
  snowflake: { provider: "snowflake", label: "Snowflake", origin: "Snowflake", category: "warehouse", external: true, dataSource: true, description: "Quality data marts" },
  oracle: { provider: "oracle", label: "Oracle EBS", origin: "Oracle", category: "erp", external: true, dataSource: true, description: "Supplier master · purchase orders" },
  powerbi: { provider: "powerbi", label: "Power BI dataset", origin: "Power BI", category: "bi", external: true, dataSource: true, description: "Published semantic model" },
  sheets: { provider: "sheets", label: "Google Sheets", origin: "Sheets", category: "file", external: true, dataSource: true, description: "Shared range → live table" },
  rest: { provider: "rest", label: "REST / Webhook", origin: "REST", category: "api", external: true, dataSource: true, description: "Any JSON endpoint" },
  csv: { provider: "csv", label: "CSV / Excel", origin: "File", category: "file", external: true, dataSource: true, description: "Uploaded file → columns" },
  generic_webhook: { provider: "generic_webhook", label: "Generic webhook", origin: "Webhook", category: "api", external: true, dataSource: false, description: "Outbound event delivery" },
};

export function connectorMeta(provider: IntegrationProvider): ConnectorMeta {
  return CONNECTOR_META[provider];
}

const f = (key: string, label: string, type: "text" | "num"): ConnectorField => ({ key, label, type });

/**
 * The declared field schema for a data-source connector (report-data.jsx
 * `RB_CONNECTOR_DATA` shapes). Non-data-source providers return []. This is what
 * `listSchema()` returns until a live adapter is wired.
 */
export function connectorSchema(provider: IntegrationProvider): ConnectorField[] {
  switch (provider) {
    case "sap":
      return [
        f("order", "Order", "text"),
        f("material", "Material", "text"),
        f("plant", "Plant", "text"),
        f("producedQty", "Produced qty", "num"),
        f("scrapQty", "Scrap qty", "num"),
        f("defectRate", "Defect rate", "num"),
        f("costImpact", "Cost impact", "num"),
      ];
    case "snowflake":
      return [
        f("week", "Week", "text"),
        f("ppm", "PPM", "num"),
        f("fpy", "FPY", "num"),
        f("coq", "CoQ", "num"),
        f("topDefect", "Top defect", "text"),
      ];
    case "oracle":
      return [
        f("supplier", "Supplier", "text"),
        f("poCount", "PO count", "num"),
        f("onTime", "On-time %", "num"),
        f("spend", "Spend", "num"),
        f("riskTier", "Risk tier", "text"),
      ];
    case "powerbi":
    case "sheets":
    case "rest":
    case "csv":
      return [
        f("key", "Key", "text"),
        f("metric", "Metric", "text"),
        f("value", "Value", "num"),
        f("period", "Period", "text"),
      ];
    default:
      return [];
  }
}

/**
 * The adapter contract every provider implements (09 §1). `listSchema` returns
 * the field shape; `fetchRows` pulls rows for a query. Concrete adapters live in
 * the API; external `fetchRows` is stubbed until a live connector is built.
 */
export interface ConnectorAdapter {
  listSchema(): ConnectorField[];
  fetchRows(query: unknown): Promise<ReadonlyArray<Record<string, string | number | null>>>;
}
