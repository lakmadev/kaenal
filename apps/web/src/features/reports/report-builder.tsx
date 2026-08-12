"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Hash, LayoutGrid, LineChart, PieChart, Repeat, Table2, Trash2 } from "lucide-react";
import type { Query, ReportDefinitionDto, ReportTile, ReportWidgetKind, QuerySourceDto } from "@kaenal/types";
import { PageHeader } from "@/components/page-header";
import { Button, Card, CardContent, EmptyState, Input, Spinner, useToast } from "@/components/ui";
import { useDeleteReport, useUpdateReport } from "@/hooks/use-reports";
import { useQuerySources } from "@/hooks/use-query";
import { TileWidget } from "./bound-widgets";
import { QueryBuilder } from "./query-builder";

const VIZ: { kind: ReportWidgetKind; label: string; icon: typeof Hash }[] = [
  { kind: "kpi", label: "KPI", icon: Hash },
  { kind: "bar", label: "Bar", icon: BarChart3 },
  { kind: "pie", label: "Pie", icon: PieChart },
  { kind: "line", label: "Line", icon: LineChart },
  { kind: "datatable", label: "Table", icon: Table2 },
  { kind: "repeater", label: "Repeater", icon: Repeat },
];

function shortId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** A sensible starter query for a new tile of the given viz on a given source. */
function defaultQuery(kind: ReportWidgetKind, source: QuerySourceDto): Query {
  if (kind === "datatable" || kind === "repeater") {
    return { sourceId: source.id, columns: [...source.defaultColumns], limit: 10 };
  }
  if (kind === "kpi") return { sourceId: source.id, agg: "count" };
  const dim = source.fields.find((fld) => fld.type === "text");
  return { sourceId: source.id, agg: "count", dimension: dim?.key ?? source.fields[0]?.key ?? "" };
}

export function ReportBuilder({ report }: { report: ReportDefinitionDto }): React.ReactElement {
  const router = useRouter();
  const toast = useToast();
  const sourcesQ = useQuerySources();
  const update = useUpdateReport();
  const del = useDeleteReport();

  const [name, setName] = useState(report.name);
  const [tiles, setTiles] = useState<ReportTile[]>([...report.tiles]);
  const [version, setVersion] = useState(report.lockVersion);
  const [selected, setSelected] = useState<string | null>(report.tiles[0]?.id ?? null);

  const sources: QuerySourceDto[] = sourcesQ.data?.items ? [...sourcesQ.data.items] : [];

  const patchTile = (id: string, patch: Partial<ReportTile>): void =>
    setTiles((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const addTile = (kind: ReportWidgetKind): void => {
    const source = sources[0];
    if (source === undefined) {
      toast.error("No data sources available for your role.");
      return;
    }
    const id = shortId();
    const label = VIZ.find((v) => v.kind === kind)?.label ?? "Tile";
    const tile: ReportTile = {
      id,
      title: `${label} · ${source.label}`,
      viz: kind,
      query: defaultQuery(kind, source),
      layout: { x: 0, y: 0, w: kind === "kpi" ? 6 : 12, h: kind === "kpi" ? 4 : 8 },
    };
    setTiles((ts) => [...ts, tile]);
    setSelected(id);
  };

  const removeTile = (id: string): void => {
    setTiles((ts) => ts.filter((t) => t.id !== id));
    if (selected === id) setSelected(null);
  };

  const save = (): void => {
    update.mutate(
      { id: report.id, body: { name, description: report.description, filters: [...report.filters], tiles, version } },
      {
        onSuccess: (dto) => {
          setVersion(dto.lockVersion);
          toast.success("Report saved");
        },
        onError: () => toast.error("Couldn't save — reload and try again."),
      },
    );
  };

  const remove = (): void => {
    if (!confirm("Delete this report?")) return;
    del.mutate(report.id, {
      onSuccess: () => {
        toast.success("Report deleted");
        router.push("/reports");
      },
    });
  };

  const selectedTile = tiles.find((t) => t.id === selected) ?? null;

  return (
    <div>
      <PageHeader
        title="Report builder"
        description="Every tile binds a live query — the render is the engine."
        actions={
          <>
            <Button variant="ghost" onClick={remove} loading={del.isPending}>
              <Trash2 size={14} /> Delete
            </Button>
            <Button variant="primary" onClick={save} loading={update.isPending}>
              Save report
            </Button>
          </>
        }
      />

      <div className="px-7 pb-8">
        <div className="mb-4 max-w-md">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Report name" aria-label="Report name" />
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-[var(--text-muted)]">Add tile:</span>
          {VIZ.map((v) => (
            <Button key={v.kind} variant="ghost" size="sm" onClick={() => addTile(v.kind)}>
              <v.icon size={13} /> {v.label}
            </Button>
          ))}
        </div>

        {sourcesQ.isLoading ? (
          <Spinner />
        ) : tiles.length === 0 ? (
          <EmptyState icon={LayoutGrid} title="No tiles yet" body="Add a KPI, chart, or table above to start building." />
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            {/* Tiles + previews */}
            <div className="flex flex-col gap-4">
              {tiles.map((t) => (
                <Card
                  key={t.id}
                  className={t.id === selected ? "ring-2 ring-[var(--accent)]" : ""}
                  onClick={() => setSelected(t.id)}
                >
                  <CardContent className="flex flex-col gap-2 pt-5">
                    <div className="flex items-center gap-2">
                      <input
                        className="flex-1 border-b border-transparent bg-transparent text-sm font-semibold outline-none focus:border-[var(--border)]"
                        value={t.title}
                        onChange={(e) => patchTile(t.id, { title: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="rounded bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10px] uppercase text-[var(--text-muted)]">{t.viz}</span>
                      <button
                        type="button"
                        className="text-[var(--text-muted)] hover:text-[var(--danger,#dc2626)]"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTile(t.id);
                        }}
                        aria-label="Remove tile"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="flex min-h-[120px] flex-col">
                      <TileWidget viz={t.viz} query={t.query} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Inspector */}
            <div className="lg:sticky lg:top-4 lg:self-start">
              <Card>
                <CardContent className="pt-5">
                  {selectedTile === null ? (
                    <div className="py-8 text-center text-xs text-[var(--text-muted)]">Select a tile to edit its query.</div>
                  ) : (
                    <QueryBuilder
                      query={selectedTile.query}
                      viz={selectedTile.viz}
                      sources={sources}
                      onChange={(q) => patchTile(selectedTile.id, { query: q })}
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
