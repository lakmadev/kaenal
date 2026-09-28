"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, GitBranch, Minus, Plus } from "lucide-react";
import { edgeGeometry, layoutNodes, type LayoutEdge, type LayoutNode, type NodePosition } from "@kaenal/core";
import type { EntityKind } from "@kaenal/types";
import { statusDotColor } from "@/components/ui";
import { GRAPH_KINDS, NODE_H, NODE_W, fmt } from "./graph-kinds";
import type { ClusterState, NodeMap, VisEdge } from "./graph-types";

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

interface View {
  x: number;
  y: number;
  k: number;
}

/**
 * Pan/zoom SVG canvas (jsx 410-502): background dot-grid, edges with
 * arrowheads + relation-label pills, node cards, cluster "+N more" nodes,
 * zoom controls. Positions come from `@kaenal/core`'s `layoutNodes`/
 * `edgeGeometry` (P20 — layout is a client concern, but the ALGORITHM is the
 * new pure core one, not the jsx's old per-kind-layer math — see the task's
 * explicit instruction). `children` renders the legend/why-panel/detail-drawer
 * overlays the parent composes, absolutely positioned within this same
 * wrapper (matches the jsx's actual DOM: all siblings inside one canvas div).
 */
export function GraphCanvas({
  nodes,
  clusters,
  edges,
  hidden,
  selectedKey,
  originKey,
  matchedKeys,
  matchedEdgeKeys,
  dimming,
  onSelect,
  onExpandCluster,
  emptyState,
  children,
}: {
  nodes: NodeMap;
  clusters: readonly ClusterState[];
  edges: ReadonlyMap<string, VisEdge>;
  hidden: Partial<Record<EntityKind, boolean>>;
  selectedKey: string | null;
  originKey: string | null;
  matchedKeys: ReadonlySet<string> | null;
  matchedEdgeKeys: ReadonlySet<string> | null;
  dimming: boolean;
  onSelect: (key: string) => void;
  onExpandCluster: (cluster: ClusterState) => void;
  emptyState: React.ReactNode;
  children?: React.ReactNode;
}): React.ReactElement {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 0.8 });
  const [panning, setPanning] = useState(false);
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);

  const shownCount = nodes.size;

  const laid = useMemo(() => {
    const layoutN: LayoutNode[] = [...nodes.entries()].map(([key, n]) => ({ id: key, kind: n.kind }));
    const layoutE: LayoutEdge[] = [...edges.values()].map((e) => ({ from: e.fromKey, to: e.toKey }));
    for (const c of clusters) {
      layoutN.push({ id: c.key, kind: c.type });
      layoutE.push({ from: c.srcKey, to: c.key });
    }
    const center = originKey !== null && (nodes.has(originKey) || clusters.some((c) => c.key === originKey)) ? originKey : (layoutN[0]?.id ?? "");
    const positions = layoutNodes(center, layoutN, layoutE);
    const geo = edgeGeometry(positions, layoutE);
    const byId = new Map(positions.map((p) => [p.id, p] as const));
    let w = 0;
    let h = 0;
    for (const p of positions) {
      w = Math.max(w, p.x + NODE_W);
      h = Math.max(h, p.y + NODE_H);
    }
    return { positions: byId, geo, worldW: w + 60, worldH: h + 60 };
  }, [nodes, edges, clusters, originKey]);

  // Fit the view to the laid-out nodes whenever the visible set changes size (new expand/query/cluster reveal).
  const nodeCountKey = `${nodes.size}|${clusters.length}`;
  const [lastFitKey, setLastFitKey] = useState("");
  if (nodeCountKey !== lastFitKey && shownCount > 0) {
    setLastFitKey(nodeCountKey);
    const el = canvasRef.current;
    if (el !== null) {
      const cw = el.clientWidth || 800;
      const ch = el.clientHeight || 500;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of laid.positions.values()) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x + NODE_W);
        maxY = Math.max(maxY, p.y + NODE_H);
      }
      if (minX !== Infinity) {
        const pad = 90;
        const k = clamp(Math.min(cw / (maxX - minX + pad * 2), ch / (maxY - minY + pad * 2)), 0.3, 1.25);
        setView({ k, x: (cw - (minX + maxX) * k) / 2, y: (ch - (minY + maxY) * k) / 2 });
      }
    }
  }

  function fitToView(): void {
    const el = canvasRef.current;
    if (el === null) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of laid.positions.values()) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + NODE_W);
      maxY = Math.max(maxY, p.y + NODE_H);
    }
    if (minX === Infinity) return;
    const pad = 90;
    const k = clamp(Math.min(cw / (maxX - minX + pad * 2), ch / (maxY - minY + pad * 2)), 0.3, 1.25);
    setView({ k, x: (cw - (minX + maxX) * k) / 2, y: (ch - (minY + maxY) * k) / 2 });
  }

  // Browser-API case: pan-drag needs a WINDOW-level mousemove/mouseup listener
  // (the pointer can leave the canvas div mid-drag) — no render-time or event-
  // handler equivalent, so this is a legitimate useEffect (best-practices.md #4).
  useEffect(() => {
    const mv = (e: MouseEvent): void => {
      const d = dragRef.current;
      if (d === null) return;
      setView((v) => ({ ...v, x: d.ox + (e.clientX - d.sx), y: d.oy + (e.clientY - d.sy) }));
    };
    const up = (): void => {
      dragRef.current = null;
      setPanning(false);
    };
    window.addEventListener("mousemove", mv);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", mv);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  function onBgDown(e: React.MouseEvent): void {
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y };
    setPanning(true);
  }
  function zoom(f: number): void {
    const el = canvasRef.current;
    if (el === null) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    setView((v) => {
      const k = clamp(v.k * f, 0.25, 1.9);
      const cx = (cw / 2 - v.x) / v.k;
      const cy = (ch / 2 - v.y) / v.k;
      return { k, x: cw / 2 - cx * k, y: ch / 2 - cy * k };
    });
  }
  function onWheel(e: React.WheelEvent): void {
    const el = canvasRef.current;
    if (el === null) return;
    const r = el.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    setView((v) => {
      const k = clamp(v.k * (e.deltaY < 0 ? 1.08 : 0.925), 0.25, 1.9);
      const wx = (px - v.x) / v.k;
      const wy = (py - v.y) / v.k;
      return { k, x: px - wx * k, y: py - wy * k };
    });
  }

  return (
    <div
      ref={canvasRef}
      onMouseDown={onBgDown}
      onWheel={onWheel}
      style={{
        flex: 1,
        position: "relative",
        minHeight: 0,
        overflow: "hidden",
        cursor: panning ? "grabbing" : "grab",
        background: "var(--bg)",
        backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
        backgroundSize: "26px 26px",
      }}
    >
      {shownCount === 0 ? (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-sm)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent)",
              marginBottom: 16,
            }}
          >
            <GitBranch size={26} strokeWidth={1.7} aria-hidden />
          </div>
          {emptyState}
        </div>
      ) : (
        <div style={{ position: "absolute", top: 0, left: 0, transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: "0 0" }}>
          <svg width={laid.worldW} height={laid.worldH} style={{ position: "absolute", top: 0, left: 0, overflow: "visible", pointerEvents: "none" }}>
            <defs>
              <marker id="g-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
                <path d="M0 0 L8 4.5 L0 9 z" fill="var(--border-strong)" />
              </marker>
              <marker id="g-arrow-a" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
                <path d="M0 0 L8 4.5 L0 9 z" fill="var(--accent)" />
              </marker>
            </defs>
            {laid.geo.map((g) => {
              const a = laid.positions.get(g.from);
              const b = laid.positions.get(g.to);
              if (a === undefined || b === undefined) return null;
              const aNode = nodes.get(g.from);
              const bNode = nodes.get(g.to);
              const aKind = aNode?.kind ?? clusters.find((c) => c.key === g.from)?.type;
              const bKind = bNode?.kind ?? clusters.find((c) => c.key === g.to)?.type;
              if ((aKind !== undefined && hidden[aKind] === true) || (bKind !== undefined && hidden[bKind] === true)) return null;
              const edgeId = `${g.from}>${g.to}`;
              const rel = edges.get(edgeId)?.relation ?? "";
              const isCluster = clusters.some((c) => c.key === g.to || c.key === g.from);
              const isMatch = matchedEdgeKeys?.has(edgeId) ?? false;
              const conn = selectedKey !== null && (g.from === selectedKey || g.to === selectedKey);
              const isDim = dimming && !isMatch && !isCluster;
              const active = (dimming && isMatch) || conn;
              const path = buildEdgePath(a, b, g.curve);
              return (
                <g key={edgeId} style={{ opacity: isDim ? 0.12 : 1, transition: "opacity 200ms" }}>
                  <path
                    d={path.d}
                    fill="none"
                    stroke={active ? "var(--accent)" : "var(--border-strong)"}
                    strokeWidth={active ? 2.4 : 1.5}
                    strokeDasharray={isCluster ? "2 4" : dimming && isMatch ? "7 6" : "none"}
                    markerEnd={`url(#${active ? "g-arrow-a" : "g-arrow"})`}
                  />
                  {(conn || (dimming && isMatch) || hoverEdge === edgeId || isCluster) && rel.length > 0 && (
                    <g transform={`translate(${path.mx}, ${path.my})`}>
                      <rect x={-(rel.length * 3.1 + 8)} y={-9} width={rel.length * 6.2 + 16} height={18} rx={9} fill="var(--surface)" stroke={active ? "var(--accent)" : "var(--border)"} strokeWidth="1" />
                      <text x="0" y="3.5" textAnchor="middle" fontSize="10.5" fontWeight="600" fill={active ? "var(--accent)" : "var(--text-muted)"}>
                        {rel}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
            {laid.geo.map((g) => {
              const a = laid.positions.get(g.from);
              const b = laid.positions.get(g.to);
              if (a === undefined || b === undefined) return null;
              const edgeId = `${g.from}>${g.to}`;
              const path = buildEdgePath(a, b, g.curve);
              return (
                <path
                  key={`h${edgeId}`}
                  d={path.d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="14"
                  style={{ pointerEvents: "stroke", cursor: "pointer" }}
                  onMouseEnter={() => setHoverEdge(edgeId)}
                  onMouseLeave={() => setHoverEdge((h) => (h === edgeId ? null : h))}
                />
              );
            })}
          </svg>

          {[...laid.positions.entries()].map(([key, pos]) => {
            const cluster = clusters.find((c) => c.key === key);
            if (cluster !== undefined) {
              if (hidden[cluster.type] === true) return null;
              const tp = GRAPH_KINDS[cluster.type];
              return (
                <button
                  key={key}
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onExpandCluster(cluster);
                  }}
                  style={{
                    position: "absolute",
                    left: pos.x,
                    top: pos.y,
                    width: NODE_W,
                    height: NODE_H,
                    background: tp.soft,
                    borderRadius: "var(--r-lg)",
                    border: `1.5px dashed ${tp.color}`,
                    padding: "8px 11px",
                    cursor: "pointer",
                    display: "flex",
                    gap: 9,
                    alignItems: "center",
                    textAlign: "left",
                  }}
                  title="Click to reveal more"
                >
                  <div style={{ width: 28, height: 28, borderRadius: "var(--r-md)", background: "var(--surface)", color: tp.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: `1px solid ${tp.color}` }}>
                    <Plus size={15} strokeWidth={2.4} aria-hidden />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: tp.color, lineHeight: 1 }}>+{fmt(cluster.remaining)}</div>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-muted)", marginTop: 2 }}>more {tp.label.toLowerCase()}s · reveal</div>
                  </div>
                </button>
              );
            }
            const node = nodes.get(key);
            if (node === undefined) return null;
            if (hidden[node.kind] === true) return null;
            const tp = GRAPH_KINDS[node.kind];
            const NodeIcon = tp.icon;
            const isSel = selectedKey === key;
            const isMatch = matchedKeys?.has(key) ?? false;
            const isDim = dimming && !isMatch;
            return (
              <div
                key={key}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(key);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onSelect(key);
                }}
                style={{
                  position: "absolute",
                  left: pos.x,
                  top: pos.y,
                  width: NODE_W,
                  minHeight: NODE_H,
                  background: "var(--surface)",
                  borderRadius: "var(--r-lg)",
                  borderTop: `1px solid ${isSel ? tp.color : "var(--border)"}`,
                  borderRight: `1px solid ${isSel ? tp.color : "var(--border)"}`,
                  borderBottom: `1px solid ${isSel ? tp.color : "var(--border)"}`,
                  borderLeft: `4px solid ${tp.color}`,
                  boxShadow: isSel ? `0 0 0 3px ${tp.soft}, var(--shadow-lg)` : dimming && isMatch ? "0 0 0 3px var(--ring), var(--shadow-md)" : "var(--shadow-sm)",
                  padding: "8px 11px",
                  cursor: "pointer",
                  opacity: isDim ? 0.28 : 1,
                  transition: "opacity 200ms, box-shadow 150ms",
                  display: "flex",
                  gap: 9,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ width: 28, height: 28, borderRadius: "var(--r-md)", background: tp.soft, color: tp.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  <NodeIcon size={15} strokeWidth={2} aria-hidden />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                    <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: tp.color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tp.card}</span>
                    {node.status !== null && <span style={{ width: 7, height: 7, borderRadius: "50%", background: statusDotColor(node.status), flexShrink: 0 }} title={node.status} />}
                  </div>
                  <div className="mono" style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", marginTop: 1 }}>
                    {node.fields.find((f) => f.label === "Code")?.value ?? ""}
                  </div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text)", lineHeight: 1.22, marginTop: 1, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{node.title}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {shownCount > 0 && (
        <div style={{ position: "absolute", left: 16, bottom: 16, display: "flex", flexDirection: "column", gap: 6 }}>
          <button type="button" onClick={() => zoom(1.2)} className="k-btn-ghost" style={{ width: 34, height: 34, padding: 0, justifyContent: "center", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-sm)" }} aria-label="Zoom in">
            <Plus size={16} strokeWidth={2} aria-hidden />
          </button>
          <button type="button" onClick={() => zoom(0.83)} className="k-btn-ghost" style={{ width: 34, height: 34, padding: 0, justifyContent: "center", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-sm)" }} aria-label="Zoom out">
            <Minus size={16} strokeWidth={2} aria-hidden />
          </button>
          <button type="button" onClick={fitToView} className="k-btn-ghost" style={{ width: 34, height: 34, padding: 0, justifyContent: "center", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-sm)" }} title="Fit to view" aria-label="Fit to view">
            <Crosshair size={16} strokeWidth={2} aria-hidden />
          </button>
        </div>
      )}

      {shownCount > 0 && children}
    </div>
  );
}

/** Card-border-to-card-border bezier path (jsx `edgeGeometry` 123-131), fed by `@kaenal/core`'s positions + parallel-edge `curve` offset. */
function buildEdgePath(a: NodePosition, b: NodePosition, curve: number): { d: string; mx: number; my: number } {
  const vertical = Math.abs(a.x - b.x) < 60;
  let sx: number;
  let sy: number;
  let ex: number;
  let ey: number;
  if (vertical) {
    sx = a.x + NODE_W / 2;
    ex = b.x + NODE_W / 2;
    if (b.y > a.y) {
      sy = a.y + NODE_H;
      ey = b.y;
    } else {
      sy = a.y;
      ey = b.y + NODE_H;
    }
  } else if (b.x > a.x) {
    sx = a.x + NODE_W;
    sy = a.y + NODE_H / 2;
    ex = b.x;
    ey = b.y + NODE_H / 2;
  } else {
    sx = a.x;
    sy = a.y + NODE_H / 2;
    ex = b.x + NODE_W;
    ey = b.y + NODE_H / 2;
  }
  const cdx = vertical ? curve : (ex - sx) * 0.5;
  const cdy = vertical ? (ey - sy) * 0.5 : curve;
  return {
    d: `M ${sx} ${sy} C ${sx + cdx} ${sy + cdy}, ${ex - cdx} ${ey - cdy}, ${ex} ${ey}`,
    mx: (sx + ex) / 2 + (vertical ? curve : 0),
    my: (sy + ey) / 2 + (vertical ? 0 : curve),
  };
}
