"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, Plus } from "lucide-react";
import type { ComplaintDto } from "@kaenal/types";
import { useCan, useMe } from "@/hooks/use-me";
import { useComplaints, useComplaintsSummary } from "@/hooks/use-complaints";
import { PageHeader } from "@/components/page-header";
import { Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/components/ui";
import { OfflineBanner } from "@/components/shell/offline-banner";
import { apiErrorInfo } from "@/lib/api-error";
import { relativeTime } from "@/lib/format";
import { ConvertTargetPicker, LinkedRecordLink } from "./convert-target-picker";
import { IntakeFormDialog } from "./intake-form-dialog";
import { ComplaintDetailPanel } from "./complaint-detail-panel";

type Tab = "all" | "critical" | "no-link" | "mine";

const SEVERITY_COLOR: Record<string, { bg: string; fg: string }> = {
  critical: { bg: "rgba(220,38,38,0.10)", fg: "#b91c1c" },
  high: { bg: "rgba(234,88,12,0.10)", fg: "#9a3412" },
  medium: { bg: "rgba(245,158,11,0.12)", fg: "#92400e" },
  low: { bg: "rgba(100,116,139,0.12)", fg: "var(--text-muted)" },
};

const STATUS_LABEL: Record<string, string> = { triage: "triage", investigation: "investigation", "8d": "8d", capa: "capa", closed: "closed" };
const CHANNEL_LABEL: Record<string, string> = {
  portal: "Customer portal",
  email_parsed: "Email parsed",
  web_form: "Web form",
  edi: "EDI",
  phone: "Phone (logged)",
};

/**
 * `/complaints` — `CustomerComplaints` (SPRINT-06 C1-C4; `qms-modules.jsx:
 * 332-475`, read in full). KPI strip + 4-tab register + the "Intake channels"/
 * "SLA matrix" reference cards come from `GET /v1/complaints/summary` (real,
 * tenant-wide numbers, never the jsx's static 84/4/92%/18d/$4,280 mock). Tab
 * filtering is client-side over the currently-loaded page (mirrors R1's own
 * heat-map-cell filter precedent) — `summary`'s own tab counts are the
 * authoritative, tenant-wide numbers shown in each tab's label regardless of
 * how many rows are actually loaded.
 */
export function ComplaintsRegisterPage(): React.ReactElement {
  const { data: me, isLoading: meLoading } = useMe();
  const canView = useCan("complaint:view");
  const canManage = useCan("complaint:manage");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<Tab>("all");
  const [intakeOpen, setIntakeOpen] = useState(false);

  const all = useComplaints({ limit: 100 });
  const summary = useComplaintsSummary();
  const urlId = searchParams.get("id");

  const items = useMemo(() => all.data?.items ?? [], [all.data]);
  const rows = useMemo(() => {
    switch (tab) {
      case "all":
        return items.filter((c) => c.status !== "closed");
      case "critical":
        return items.filter((c) => c.status !== "closed" && c.severity === "critical");
      case "no-link":
        return items.filter((c) => c.status !== "closed" && c.ncrId === null);
      case "mine":
        return items.filter((c) => c.status !== "closed" && c.owner === me?.userId);
      default:
        return items;
    }
  }, [items, tab, me?.userId]);

  if (meLoading || all.isPending || summary.isPending) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-5 gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!canView && me !== undefined) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <Card>
          <EmptyState title="No access" body="You don't have permission to view customer complaints." />
        </Card>
      </div>
    );
  }

  if (all.isError || summary.isError) {
    const info = apiErrorInfo(all.error ?? summary.error);
    if (info?.status === 403) {
      return (
        <div className="mx-auto max-w-7xl p-6">
          <Card>
            <EmptyState title="No access" body="You don't have permission to view customer complaints." />
          </Card>
        </div>
      );
    }
    const message = info?.message ?? "Something went wrong.";
    return (
      <div className="mx-auto max-w-7xl p-6">
        <Card>
          <EmptyState
            title="Couldn't load the complaint register"
            body={info?.requestId !== undefined ? `${message} (request ${info.requestId})` : message}
            action={
              <Button
                variant="ghost"
                onClick={() => {
                  void all.refetch();
                  void summary.refetch();
                }}
              >
                Retry
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const s = summary.data;
  const isEmpty = items.length === 0;

  const tabs: { id: Tab; label: string }[] = [
    { id: "all", label: `All (${s?.tabCounts.all ?? 0} open)` },
    { id: "critical", label: `Critical (${s?.tabCounts.critical ?? 0})` },
    { id: "no-link", label: `Not linked to NCR (${s?.tabCounts.noLink ?? 0})` },
    { id: "mine", label: `Mine (${s?.tabCounts.mine ?? 0})` },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
      <OfflineBanner />
      <PageHeader
        title="Customer complaints"
        description="External-facing intake form + email + EDI. Triage, auto-link to NCR / 8D / CAPA, full traceability."
        actions={
          <>
            <Button variant="ghost" disabled disabledReason="Manual intake only this release — no live public form yet">
              <ExternalLink size={13} aria-hidden /> Public intake form
            </Button>
            {canManage && (
              <Button variant="primary" onClick={() => setIntakeOpen(true)}>
                <Plus size={13} aria-hidden /> Log complaint
              </Button>
            )}
          </>
        }
      />

      {s !== undefined && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          <KpiTile label="Open" value={String(s.open)} color="#2563eb" />
          <KpiTile label="Critical" value={String(s.critical)} color="#dc2626" />
          <KpiTile label="< 24h response" value={s.responseWithin24hPct !== null ? `${Math.round(s.responseWithin24hPct)}%` : "—"} color="#16a34a" />
          <KpiTile label="Avg time to close" value={s.avgTimeToCloseDays !== null ? `${Math.round(s.avgTimeToCloseDays)}d` : "—"} color="var(--slate-600)" />
          <KpiTile label="Avg cost / complaint" value={s.avgCostPerComplaint !== null ? `$${Math.round(s.avgCostPerComplaint).toLocaleString()}` : "—"} color="#f59e0b" />
        </div>
      )}

      {isEmpty ? (
        <Card>
          <EmptyState
            title="No complaints logged yet"
            body={canManage ? "Log a complaint to start the register." : "No complaints have been logged yet."}
            {...(canManage
              ? {
                  action: (
                    <Button variant="primary" onClick={() => setIntakeOpen(true)}>
                      <Plus size={14} aria-hidden /> Log complaint
                    </Button>
                  ),
                }
              : {})}
          />
        </Card>
      ) : (
        <>
          <div className="k-tabs">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`k-tab ${tab === t.id ? "active" : ""}`}>
                {t.label}
              </button>
            ))}
          </div>

          <Card className="overflow-hidden p-0">
            {rows.length === 0 ? (
              <p className="py-8 text-center text-[12px] text-muted">No complaints in this tab.</p>
            ) : (
              <table className="k-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Customer</th>
                    <th>Subject</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Linked</th>
                    <th>Received</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <ComplaintRow key={c.id} complaint={c} active={c.id === urlId} onOpen={() => router.push(`/complaints?id=${c.id}`, { scroll: false })} />
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          {all.data?.nextCursor != null && (
            <p className="text-center text-[12px] text-subtle">Showing the first {items.length}. Pagination lands with the shared table.</p>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Intake channels</CardTitle>
                  <p className="mt-0.5 text-[11px] text-muted">Reference only — no channel is connected in this release; every complaint above was logged manually.</p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {[
                    { c: "Public web form", url: "kaenal.app/complaints/precision-auto" },
                    { c: "Customer portal (Volvo, Bosch, BMW)", url: "Authenticated EDI" },
                    { c: "Email parser", url: "complaints@precision-auto.com" },
                    { c: "Phone (logged manually)", url: "+91 20 4567 8900" },
                    { c: "Customer extranet API", url: "oauth-connected" },
                  ].map((r) => (
                    <div key={r.c} className="flex items-center gap-2.5 rounded-md border border-border p-2.5">
                      <div className="flex-1">
                        <div className="text-[12.5px] font-semibold">{r.c}</div>
                        <div className="mono text-[10.5px] text-muted">{r.url}</div>
                      </div>
                      <span className="k-chip" style={{ background: "var(--bg-subtle)" }}>
                        Reference
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>SLA matrix</CardTitle>
              </CardHeader>
              <CardContent>
                <table style={{ width: "100%", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th className="k-overline" style={{ textAlign: "left", padding: "6px 0" }}>
                        Severity
                      </th>
                      <th className="k-overline" style={{ textAlign: "left", padding: "6px 0" }}>
                        Acknowledge
                      </th>
                      <th className="k-overline" style={{ textAlign: "left", padding: "6px 0" }}>
                        8D required
                      </th>
                      <th className="k-overline" style={{ textAlign: "left", padding: "6px 0" }}>
                        Close target
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { s: "Critical (safety, field failure)", a: "< 1 hr", d: "Auto-create within 4 hr", c: "14 days" },
                      { s: "High (line stop at customer)", a: "< 4 hr", d: "Within 24 hr", c: "21 days" },
                      { s: "Medium", a: "< 24 hr", d: "Optional", c: "45 days" },
                      { s: "Low", a: "< 48 hr", d: "Not required", c: "90 days" },
                    ].map((r) => (
                      <tr key={r.s} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "8px 0", fontWeight: 600 }}>{r.s}</td>
                        <td className="mono" style={{ padding: "8px 0" }}>
                          {r.a}
                        </td>
                        <td style={{ padding: "8px 0" }}>{r.d}</td>
                        <td className="mono" style={{ padding: "8px 0" }}>
                          {r.c}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {intakeOpen && <IntakeFormDialog onClose={() => setIntakeOpen(false)} onSaved={(c) => router.push(`/complaints?id=${c.id}`, { scroll: false })} />}
      {urlId !== null && <ComplaintDetailPanel id={urlId} onClose={() => router.push("/complaints", { scroll: false })} />}
    </div>
  );
}

function KpiTile({ label, value, color }: { label: string; value: string; color: string }): React.ReactElement {
  return (
    <Card className="p-3">
      <div className="text-[10.5px] font-semibold uppercase text-muted">{label}</div>
      <div className="text-[20px] font-bold" style={{ color }}>
        {value}
      </div>
    </Card>
  );
}

function ComplaintRow({ complaint: c, active, onOpen }: { complaint: ComplaintDto; active: boolean; onOpen: () => void }): React.ReactElement {
  const initials = c.customer.split(" ")[0]?.slice(0, 3).toUpperCase() ?? "?";
  const sev = SEVERITY_COLOR[c.severity] ?? SEVERITY_COLOR.low!;
  return (
    <tr style={{ cursor: "pointer", background: active ? "var(--accent-soft)" : undefined }} onClick={onOpen}>
      <td className="mono" style={{ fontSize: 11.5 }}>
        {c.code}
      </td>
      <td>
        <div className="flex items-center gap-2">
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 4,
              background: c.customerColor,
              color: "white",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
            }}
          >
            {initials}
          </div>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{c.customer}</div>
            <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
              {c.contact} · via {CHANNEL_LABEL[c.channel] ?? c.channel}
            </div>
          </div>
        </div>
      </td>
      <td>
        <div style={{ fontSize: 12.5 }}>{c.subject}</div>
        {c.batchRef !== null && (
          <div className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
            Batch: {c.batchRef}
          </div>
        )}
      </td>
      <td>
        <span className="k-chip" style={{ background: sev.bg, color: sev.fg }}>
          {c.severity}
        </span>
      </td>
      <td>
        <span
          className="k-chip"
          style={{
            background: c.status === "closed" ? "var(--success-100)" : "var(--bg-subtle)",
            color: c.status === "closed" ? "var(--success-700)" : "var(--text)",
          }}
        >
          {STATUS_LABEL[c.status] ?? c.status}
        </span>
      </td>
      <td onClick={(e) => e.stopPropagation()}>
        {c.ncrId !== null || c.eightDId !== null || c.capaId !== null ? (
          <LinkedRecordLink complaint={c} />
        ) : (
          <ConvertTargetPicker complaint={c} fallback={<span className="text-[11.5px] text-muted">—</span>} />
        )}
      </td>
      <td style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{relativeTime(c.receivedAt)}</td>
    </tr>
  );
}
