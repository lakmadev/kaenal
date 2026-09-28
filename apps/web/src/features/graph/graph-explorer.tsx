"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import type { EntityKind, GraphExpandResult, GraphQueryId, GraphSeedDto, NodeDto } from "@kaenal/types";
import { EmptyState, Spinner } from "@/components/ui";
import { useOnline } from "@/hooks/use-online";
import { useExpandGraphAction, useGraphSeeds, useRunGraphQueryAction } from "@/hooks/use-graph";
import { entityHref } from "@/lib/entity-routes";
import { GraphCanvas } from "./graph-canvas";
import { GraphDetailDrawer } from "./graph-detail-drawer";
import { GraphLegend } from "./graph-legend";
import { GraphQueryBar, type QueryChip } from "./graph-query-bar";
import { GraphSeedPicker } from "./graph-seed-picker";
import { GraphWhyPanel } from "./graph-why-panel";
import { fmt, nodeKey } from "./graph-kinds";
import { parseServerEdgeKey } from "./graph-edge-key";
import { interpretedFor, matchTyped } from "./graph-query-router";
import type { ClusterState, NeighborTotals, VisEdge, WhyResult } from "./graph-types";

interface NeighborState {
  total: number;
  visible: Set<string>;
}

/**
 * Knowledge graph explorer (`graph-explorer.jsx` `GraphExplorer`, design rule
 * #9) wired to the real API. The jsx's local `buildStore`/`useState`/`useMemo`
 * traversal is replaced with server round-trips to `/v1/graph/*`
 * (`graph:view`): `seed()`/click-to-expand/cluster-reveal all call
 * `expandGraph`, the 4 canned queries call `runGraphQuery`. Layout/geometry
 * comes from `@kaenal/core`'s pure `layoutNodes`/`edgeGeometry` (P20), not the
 * jsx's own old layout math (task instruction). No business logic here beyond
 * merging already-computed server responses into local canvas state.
 */
export function GraphExplorer(): React.ReactElement {
  const router = useRouter();
  const online = useOnline();
  const seedsQuery = useGraphSeeds();
  const expandAction = useExpandGraphAction();
  const queryAction = useRunGraphQueryAction();

  const [nodes, setNodes] = useState<Map<string, NodeDto>>(new Map());
  const [edges, setEdges] = useState<Map<string, VisEdge>>(new Map());
  const [clusters, setClusters] = useState<ClusterState[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [neighborState, setNeighborState] = useState<Map<string, Partial<Record<EntityKind, NeighborState>>>>(new Map());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [originKey, setOriginKey] = useState<string | null>(null);
  const [queryText, setQueryText] = useState("");
  const [result, setResult] = useState<WhyResult | null>(null);
  const [resultNodeKeys, setResultNodeKeys] = useState<Set<string> | null>(null);
  const [resultEdgeKeys, setResultEdgeKeys] = useState<Set<string> | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [hidden, setHidden] = useState<Partial<Record<EntityKind, boolean>>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const seeds = useMemo(() => seedsQuery.data?.items ?? [], [seedsQuery.data]);

  // --- merge helpers ------------------------------------------------------

  function mergeExpand(srcKey: string, response: GraphExpandResult, full: boolean): void {
    setNodes((prev) => {
      const next = new Map(prev);
      if (response.center !== null) next.set(srcKey, response.center);
      for (const group of Object.values(response.neighbors)) {
        for (const item of group.items) next.set(nodeKey(item.node.kind, item.node.id), item.node);
      }
      return next;
    });
    setEdges((prev) => {
      const next = new Map(prev);
      for (const group of Object.values(response.neighbors)) {
        for (const item of group.items) {
          const toKey = nodeKey(item.node.kind, item.node.id);
          next.set(`${srcKey}>${toKey}`, { fromKey: srcKey, toKey, relation: item.relation });
        }
      }
      return next;
    });
    setNeighborState((prev) => {
      const next = new Map(prev);
      const entry = { ...(next.get(srcKey) ?? {}) };
      for (const [kindStr, group] of Object.entries(response.neighbors)) {
        const kind = kindStr as EntityKind;
        const priorVisible = entry[kind]?.visible ?? new Set<string>();
        const visible = new Set(priorVisible);
        for (const item of group.items) visible.add(nodeKey(item.node.kind, item.node.id));
        entry[kind] = { total: group.total, visible };
      }
      next.set(srcKey, entry);
      return next;
    });
    setClusters((prev) => {
      const kept = prev.filter((c) => !(c.srcKey === srcKey && response.neighbors[c.type] !== undefined));
      const added: ClusterState[] = [];
      for (const [kindStr, group] of Object.entries(response.neighbors)) {
        const kind = kindStr as EntityKind;
        if (group.remaining > 0) {
          added.push({ key: `${srcKey}|${kind}`, srcKey, type: kind, total: group.total, remaining: group.remaining, nextCursor: group.nextCursor });
        }
      }
      return [...kept, ...added];
    });
    if (full) setExpandedKeys((prev) => new Set(prev).add(srcKey));
  }

  async function revealAll(key: string): Promise<void> {
    setActionError(null);
    try {
      const res = await expandAction.mutateAsync({ seed: key });
      mergeExpand(key, res, true);
    } catch {
      setActionError("Couldn't load that record's connections.");
    }
  }

  async function revealType(srcKey: string, type: EntityKind, after?: string): Promise<void> {
    setActionError(null);
    try {
      const res = await expandAction.mutateAsync({ seed: srcKey, type, ...(after !== undefined ? { after } : {}) });
      mergeExpand(srcKey, res, false);
    } catch {
      setActionError("Couldn't reveal more records.");
    }
  }

  function resetCanvas(): void {
    setNodes(new Map());
    setEdges(new Map());
    setClusters([]);
    setExpandedKeys(new Set());
    setNeighborState(new Map());
    setSelectedKey(null);
    setOriginKey(null);
  }

  // --- seed / select / expand actions --------------------------------------

  function onPickSeed(s: GraphSeedDto): void {
    resetCanvas();
    setResult(null);
    setResultNodeKeys(null);
    setResultEdgeKeys(null);
    setShowWhy(false);
    setQueryText("");
    const key = nodeKey(s.kind, s.id);
    setOriginKey(key);
    setSelectedKey(key);
    void revealAll(key);
  }

  function onSelect(key: string): void {
    setSelectedKey(key);
    if (!expandedKeys.has(key)) void revealAll(key);
  }

  function onExpandCluster(cluster: ClusterState): void {
    void revealType(cluster.srcKey, cluster.type, cluster.nextCursor ?? undefined);
  }

  function onExpandType(kind: EntityKind): void {
    if (selectedKey === null) return;
    void revealType(selectedKey, kind);
  }

  // --- named queries --------------------------------------------------------

  const queries: QueryChip[] = useMemo(() => {
    const eightD = seeds.find((s) => s.kind === "eight_d");
    const ncr = seeds.find((s) => s.kind === "ncr");
    return [
      { id: "supplier-nc-8d", chip: "NCs from a supplier that triggered a D8" },
      { id: "blocking", chip: eightD !== undefined ? `What's blocking ${eightD.label}?` : "What's blocking a case from closing?" },
      { id: "docs-impacted", chip: ncr !== undefined ? `Documents impacted by ${ncr.label}` : "Documents impacted by a non-conformity" },
      { id: "open-capas", chip: "Open CAPAs and what triggered them" },
    ];
  }, [seeds]);

  function focusFor(queryId: string): string | undefined {
    if (queryId === "blocking") {
      const s = seeds.find((x) => x.kind === "eight_d");
      return s !== undefined ? nodeKey(s.kind, s.id) : undefined;
    }
    if (queryId === "docs-impacted") {
      const s = seeds.find((x) => x.kind === "ncr");
      return s !== undefined ? nodeKey(s.kind, s.id) : undefined;
    }
    return undefined;
  }

  async function runQuery(queryId: GraphQueryId): Promise<void> {
    setActionError(null);
    resetCanvas();
    try {
      const focus = focusFor(queryId);
      const res = await queryAction.mutateAsync({ queryId, ...(focus !== undefined ? { focus } : {}) });
      const nodeMap = new Map(res.nodes.map((n) => [nodeKey(n.kind, n.id), n] as const));
      setNodes(nodeMap);
      const validKeys = new Set(nodeMap.keys());
      const edgeMap = new Map<string, VisEdge>();
      for (const ek of res.edgeKeys) {
        const parsed = parseServerEdgeKey(ek, validKeys);
        if (parsed !== null) edgeMap.set(`${parsed[0]}>${parsed[1]}`, { fromKey: parsed[0], toKey: parsed[1], relation: "" });
      }
      setEdges(edgeMap);
      setResult({ summary: res.summary, truncated: res.truncated, steps: res.steps, interpreted: interpretedFor(queryId) });
      setResultNodeKeys(validKeys);
      setResultEdgeKeys(new Set(res.edgeKeys.map((ek) => {
        const parsed = parseServerEdgeKey(ek, validKeys);
        return parsed !== null ? `${parsed[0]}>${parsed[1]}` : ek;
      })));
      setShowWhy(true);
      setQueryText("");
      setOriginKey(res.nodes[0] !== undefined ? nodeKey(res.nodes[0].kind, res.nodes[0].id) : null);
    } catch {
      setActionError("That query couldn't be run.");
    }
  }

  function onRunChip(id: string): void {
    void runQuery(id as GraphQueryId);
  }

  function onAsk(): void {
    if (queryText.trim().length === 0) return;
    void runQuery(matchTyped(queryText));
  }

  function onClear(): void {
    resetCanvas();
    setResult(null);
    setResultNodeKeys(null);
    setResultEdgeKeys(null);
    setShowWhy(false);
    setQueryText("");
  }

  // --- detail drawer --------------------------------------------------------

  const selectedNode = selectedKey !== null ? (nodes.get(selectedKey) ?? null) : null;
  const neighborTotals: NeighborTotals = useMemo(() => {
    if (selectedKey === null) return {};
    const raw = neighborState.get(selectedKey) ?? {};
    const out: NeighborTotals = {};
    for (const [kind, v] of Object.entries(raw) as [EntityKind, NeighborState][]) {
      out[kind] = { total: v.total, onCanvas: v.visible.size };
    }
    return out;
  }, [neighborState, selectedKey]);

  function onOpenFullRecord(): void {
    if (selectedNode === null) return;
    if (selectedNode.kind === "finding") {
      if (selectedNode.parentId === null) return;
      router.push(`/inspections/${selectedNode.parentId}?finding=${selectedNode.id}`);
      return;
    }
    const href = entityHref(selectedNode.kind, selectedNode.id);
    if (href !== null) router.push(href);
  }

  const shownCount = nodes.size;
  const totalIndexed = `${fmt(nodes.size)} shown · ${fmt(edges.size)} links`;

  if (seedsQuery.isPending) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-[var(--text-muted)]">
        <Spinner /> <span className="ml-2">Loading knowledge graph…</span>
      </div>
    );
  }

  if (seedsQuery.isError) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState
          icon={TriangleAlert}
          title="Couldn't load the knowledge graph"
          {...(seedsQuery.error instanceof Error ? { body: `Request ID: ${seedsQuery.error.message}` } : {})}
          action={
            <button type="button" className="k-btn k-btn-primary" onClick={() => void seedsQuery.refetch()}>
              Retry
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* The global OfflineBanner (app-shell.tsx) already announces offline/restored state; this screen only needs to disable its own controls (`useOnline` below). */}
      <GraphQueryBar
        totalIndexed={totalIndexed}
        shownCount={shownCount}
        query={queryText}
        onQueryChange={setQueryText}
        onAsk={onAsk}
        queries={queries}
        onRunChip={onRunChip}
        result={result}
        showWhy={showWhy}
        onToggleWhy={() => setShowWhy((v) => !v)}
        onClear={onClear}
        disabled={!online || expandAction.isPending || queryAction.isPending}
      />

      {actionError !== null && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2 text-[12.5px]" style={{ background: "var(--danger-50)", color: "var(--danger-700)" }} role="alert">
          <TriangleAlert size={14} aria-hidden /> {actionError}
          <button type="button" className="k-btn-plain" style={{ marginLeft: "auto" }} onClick={() => setActionError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <GraphCanvas
        nodes={nodes}
        clusters={clusters}
        edges={edges}
        hidden={hidden}
        selectedKey={selectedKey}
        originKey={originKey}
        matchedKeys={resultNodeKeys}
        matchedEdgeKeys={resultEdgeKeys}
        dimming={result !== null && showWhy}
        onSelect={onSelect}
        onExpandCluster={onExpandCluster}
        emptyState={
          <>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Explore your quality records as a graph</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 460, marginBottom: 18 }}>
              The canvas stays empty until you ask. Run a natural-language query above, or drop in a starting record and expand outward — only the subgraph you touch is drawn.
            </div>
            <GraphSeedPicker seeds={seeds} onPick={onPickSeed} />
          </>
        }
      >
        <GraphLegend open={legendOpen} onToggle={() => setLegendOpen((v) => !v)} hidden={hidden} onToggleHidden={(k) => setHidden((h) => ({ ...h, [k]: h[k] !== true }))} />
        {result !== null && showWhy && <GraphWhyPanel steps={result.steps} drawerOpen={selectedNode !== null} />}
        {selectedNode !== null && <GraphDetailDrawer node={selectedNode} neighborTotals={neighborTotals} onClose={() => setSelectedKey(null)} onExpandType={onExpandType} onOpenFullRecord={onOpenFullRecord} />}
      </GraphCanvas>
    </div>
  );
}
