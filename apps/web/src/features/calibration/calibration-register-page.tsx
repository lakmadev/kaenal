"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Plus } from "lucide-react";
import { Wrench } from "lucide-react";
import { useCan, useMe } from "@/hooks/use-me";
import { usePlants, useAreas } from "@/hooks/use-create-wizard";
import {
  useCalibrationAuditPackExport,
  useInstrument,
  useInstruments,
  useInstrumentsSummary,
  type InstrumentListQuery,
} from "@/hooks/use-instruments";
import { PageHeader } from "@/components/page-header";
import { Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Segmented, Skeleton } from "@/components/ui";
import { OfflineBanner } from "@/components/shell/offline-banner";
import { apiErrorInfo } from "@/lib/api-error";
import { longDate } from "@/lib/format";
import { INSTRUMENT_TYPE_LABEL } from "./instrument-type";
import { DueStatusChip } from "./due-status-chip";
import { InstrumentDetailCard } from "./instrument-detail-card";
import { InstrumentAddForm } from "./instrument-add-form";

type FilterTab = "all" | "due_soon" | "overdue";

/**
 * `/calibration` — the instrument register (Sprint 05 C1-C6; binding jsx:
 * `qms-modules.jsx:190-310`, `CalibrationManagement`). The KPI strip and
 * register both come from real routes (`GET /v1/instruments/summary`,
 * `GET /v1/instruments`) — never the jsx's static mock. Structurally mirrors
 * `risk-register-page.tsx` (Sprint 04's freshest precedent): KPI strip ->
 * register + detail card, `?id=` deep-link selects a row, real empty/error/
 * offline states.
 */
export function CalibrationRegisterPage(): React.ReactElement {
  const { data: me, isLoading: meLoading } = useMe();
  const canView = useCan("calibration:view");
  const canManage = useCan("calibration:manage");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [adding, setAdding] = useState(false);

  const listQuery: InstrumentListQuery = {
    limit: 100,
    ...(q.trim() !== "" ? { q: q.trim() } : {}),
    ...(tab !== "all" ? { dueStatus: tab } : {}),
  };
  const list = useInstruments(listQuery);
  const summary = useInstrumentsSummary();
  const plants = usePlants();
  const areas = useAreas();
  const auditPack = useCalibrationAuditPackExport();

  const urlId = searchParams.get("id");
  // The owner-sees-own-instrument exception (§3.1 item 3) means a
  // notification deep-link can name an instrument that never appears in the
  // loaded list page — fetch it directly by id, never assume it's in `list`.
  const selected = useInstrument(urlId);

  const plantById = useMemo(() => new Map((plants.data?.items ?? []).map((p) => [p.id, p])), [plants.data]);
  const areaById = useMemo(() => new Map((areas.data?.items ?? []).map((a) => [a.id, a])), [areas.data]);

  function areaLabel(instrument: { plantId: string; areaId: string | null } | null | undefined): string {
    if (instrument === null || instrument === undefined) return "";
    const plant = plantById.get(instrument.plantId);
    const area = instrument.areaId !== null ? areaById.get(instrument.areaId) : undefined;
    if (plant === undefined) return area?.name ?? "";
    return area !== undefined ? `${plant.name} / ${area.name}` : plant.name;
  }

  function selectInstrument(id: string): void {
    router.push(`/calibration?id=${id}`, { scroll: false });
  }

  if (meLoading || list.isPending || summary.isPending) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
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
          <EmptyState title="No access" body="You don't have permission to view calibration management." />
        </Card>
      </div>
    );
  }

  if (list.isError || summary.isError) {
    const info = apiErrorInfo(list.error ?? summary.error);
    if (info?.status === 403) {
      return (
        <div className="mx-auto max-w-7xl p-6">
          <Card>
            <EmptyState title="No access" body="You don't have permission to view calibration management." />
          </Card>
        </div>
      );
    }
    const message = info?.message ?? "Something went wrong.";
    return (
      <div className="mx-auto max-w-7xl p-6">
        <Card>
          <EmptyState
            icon={Wrench}
            title="Couldn't load instruments"
            body={info?.requestId !== undefined ? `${message} (request ${info.requestId})` : message}
            action={
              <Button
                variant="ghost"
                onClick={() => {
                  void list.refetch();
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

  const instruments = list.data?.items ?? [];
  const s = summary.data;
  const selectedInstrument = selected.data ?? null;
  const empty = s !== undefined && s.instrumentsTracked === 0 && instruments.length === 0 && q === "" && tab === "all";

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
      <OfflineBanner />
      <PageHeader
        title="Calibration management"
        description="Instruments, due dates, calibration history."
        actions={
          <>
            {s !== undefined && s.instrumentsTracked > 0 && <ExportButton report={auditPack} />}
            {canManage && (
              <Button variant="primary" onClick={() => setAdding(true)}>
                <Plus size={14} aria-hidden /> Add instrument
              </Button>
            )}
          </>
        }
      />

      {s !== undefined && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiTile label="Instruments tracked" value={String(s.instrumentsTracked)} sub={`${plantById.size} plant${plantById.size === 1 ? "" : "s"}`} color="#2563eb" />
          <KpiTile label="Due < 30 days" value={String(s.dueSoon)} sub="schedule now" color="var(--warning-500)" />
          <KpiTile label="Overdue" value={String(s.overdue)} sub="review promptly" color="var(--danger-600)" />
          <KpiTile
            label="Out-of-tol findings (YTD)"
            value={String(s.outOfToleranceFindingsYtd)}
            sub={`${s.outOfToleranceLedToNcrYtd} led to NCR`}
            color="#475569"
          />
        </div>
      )}

      {empty ? (
        <Card>
          <EmptyState
            icon={Wrench}
            title="No instruments yet"
            body={canManage ? "Add your first measurement instrument to start tracking calibration due dates." : "No instruments have been added yet."}
            {...(canManage
              ? {
                  action: (
                    <Button variant="primary" onClick={() => setAdding(true)}>
                      <Plus size={14} aria-hidden /> Add instrument
                    </Button>
                  ),
                }
              : {})}
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Instrument register</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-2.5 flex items-center gap-2">
                <input
                  className="k-input h-[30px] flex-1 text-[12.5px]"
                  placeholder="Search by ID, name, area…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <Segmented
                  size="sm"
                  value={tab}
                  onChange={setTab}
                  options={[
                    { value: "all", label: "All" },
                    { value: "due_soon", label: "Due soon" },
                    { value: "overdue", label: "Overdue" },
                  ]}
                />
              </div>

              {instruments.length === 0 ? (
                <p className="py-6 text-center text-[12px] text-muted">No instruments match this search/filter.</p>
              ) : (
                <table className="k-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Instrument</th>
                      <th>Area</th>
                      <th>Next due</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {instruments.map((i) => (
                      <tr
                        key={i.id}
                        className="cursor-pointer"
                        style={i.id === urlId ? { background: "var(--accent-soft)" } : undefined}
                        onClick={() => selectInstrument(i.id)}
                      >
                        <td className="mono" style={{ fontSize: 11 }}>
                          {i.code}
                        </td>
                        <td>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{i.name}</div>
                          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                            {INSTRUMENT_TYPE_LABEL[i.type]} · tolerance {i.tolerance}
                          </div>
                        </td>
                        <td style={{ fontSize: 11, color: "var(--text-muted)" }}>{areaLabel(i)}</td>
                        <td className="mono" style={{ fontSize: 11 }}>
                          {i.nextDue !== null ? longDate(i.nextDue) : "—"}
                        </td>
                        <td>
                          <DueStatusChip instrument={i} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {list.data?.nextCursor != null && (
                <p className="mt-2 text-center text-[12px] text-subtle">Showing the first {instruments.length}. Refine your search to narrow further.</p>
              )}
            </CardContent>
          </Card>

          <InstrumentDetailCard
            instrument={selectedInstrument}
            loading={selected.isLoading && urlId !== null}
            canManage={canManage}
            areaLabel={areaLabel(selectedInstrument)}
          />
        </div>
      )}

      {adding && (
        <InstrumentAddForm
          onClose={() => setAdding(false)}
          onCreated={(id) => {
            setAdding(false);
            selectInstrument(id);
          }}
        />
      )}
    </div>
  );
}

function KpiTile({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }): React.ReactElement {
  return (
    <Card className="p-3">
      <div className="text-[10.5px] font-semibold uppercase text-muted">{label}</div>
      <div className="text-[20px] font-bold" style={{ color }}>
        {value}
      </div>
      <div className="text-[10.5px] text-muted">{sub}</div>
    </Card>
  );
}

function ExportButton({ report }: { report: ReturnType<typeof useCalibrationAuditPackExport> }): React.ReactElement {
  if (report.status === "completed" && report.downloadUrl !== null) {
    return (
      <a href={report.downloadUrl} download className="k-btn k-btn-ghost">
        <Download size={13} aria-hidden /> Download
      </a>
    );
  }
  if (report.isPreparing) {
    return (
      <Button variant="ghost" loading disabled>
        Preparing…
      </Button>
    );
  }
  return (
    <Button variant="ghost" onClick={report.trigger}>
      <Download size={13} aria-hidden /> {report.isFailed ? "Retry audit pack" : "Audit pack"}
    </Button>
  );
}
