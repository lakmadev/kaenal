import { describe, expect, it } from "vitest";
import { edgeGeometry, layoutNodes, type LayoutEdge, type LayoutNode } from "../src/graph-layout.js";

const nodes: LayoutNode[] = [
  { id: "center", kind: "ncr" },
  { id: "s1", kind: "supplier" },
  { id: "d1", kind: "document" },
  { id: "d2", kind: "document" },
  { id: "d3", kind: "document" },
];

const edges: LayoutEdge[] = [
  { from: "center", to: "s1" },
  { from: "center", to: "d1" },
  { from: "center", to: "d2" },
  { from: "d3", to: "center" },
];

describe("layoutNodes", () => {
  it("places the center at the origin", () => {
    const positions = layoutNodes("center", nodes, edges);
    expect(positions.find((p) => p.id === "center")).toEqual({ id: "center", x: 0, y: 0 });
  });

  it("groups neighbours into one column per kind, alphabetically ordered", () => {
    const positions = layoutNodes("center", nodes, edges);
    const byId = new Map(positions.map((p) => [p.id, p]));
    // 'document' < 'supplier' alphabetically, so documents get the nearer column.
    expect(byId.get("d1")!.x).toBeLessThan(byId.get("s1")!.x);
    expect(byId.get("d2")!.x).toBe(byId.get("d1")!.x);
    expect(byId.get("d3")!.x).toBe(byId.get("d1")!.x);
  });

  it("spaces nodes within a column vertically, centered on y=0", () => {
    const positions = layoutNodes("center", nodes, edges);
    const docYs = positions.filter((p) => ["d1", "d2", "d3"].includes(p.id)).map((p) => p.y);
    expect(new Set(docYs).size).toBe(3); // no overlap
    expect(docYs.reduce((a, b) => a + b, 0)).toBeCloseTo(0); // centered
  });

  it("omits the center from the output when it isn't in the node set", () => {
    const positions = layoutNodes("missing", nodes, edges);
    expect(positions.find((p) => p.id === "missing")).toBeUndefined();
    expect(positions.length).toBe(nodes.length);
  });

  it("is deterministic — same input, same output", () => {
    expect(layoutNodes("center", nodes, edges)).toEqual(layoutNodes("center", nodes, edges));
  });
});

describe("edgeGeometry", () => {
  it("resolves every edge to real coordinates from layoutNodes' output", () => {
    const positions = layoutNodes("center", nodes, edges);
    const geometry = edgeGeometry(positions, edges);
    expect(geometry).toHaveLength(edges.length);
    for (const g of geometry) {
      expect(Number.isFinite(g.x1)).toBe(true);
      expect(Number.isFinite(g.y1)).toBe(true);
      expect(Number.isFinite(g.x2)).toBe(true);
      expect(Number.isFinite(g.y2)).toBe(true);
    }
  });

  it("drops edges referencing a node outside the bounded result set", () => {
    const positions = layoutNodes("center", nodes, edges);
    const geometry = edgeGeometry(positions, [...edges, { from: "center", to: "not-in-set" }]);
    expect(geometry).toHaveLength(edges.length);
  });

  it("gives parallel edges between the same two columns a growing curve offset", () => {
    // Two documents in the same column both connect to center — both edges
    // share the same (x=0, x=220) column pair, so the second must curve.
    const positions = layoutNodes("center", nodes, edges);
    const geometry = edgeGeometry(positions, [
      { from: "center", to: "d1" },
      { from: "center", to: "d2" },
    ]);
    expect(geometry[0]!.curve).toBe(0);
    expect(geometry[1]!.curve).not.toBe(0);
  });
});
