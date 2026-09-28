import { describe, expect, it } from "vitest";
import {
  nodeKey,
  QUERY_CAP,
  queryBlocking,
  queryDocsImpacted,
  queryOpenCapas,
  querySupplierNc8d,
  type QueryEdge,
  type QueryNode,
} from "../src/graph-queries.js";

/**
 * A small fixture graph: one supplier -> two NCs, one of which escalated to
 * an 8D; one open CAPA triggered by an NCR and one closed CAPA; a document
 * linked two hops downstream of an NCR (via its CAPA).
 */
const supplier: QueryNode = { kind: "supplier", id: "sup-1", title: "Acme Weld Supply", status: "active" };
const ncrOpen: QueryNode = { kind: "ncr", id: "ncr-1", title: "Weld porosity", status: "open" };
const ncrClosed: QueryNode = { kind: "ncr", id: "ncr-2", title: "Late shipment", status: "closed" };
const eightD: QueryNode = { kind: "eight_d", id: "8d-1", title: "Porosity 8D", status: "open" };
const capaOpen: QueryNode = { kind: "capa", id: "capa-1", title: "Requalify weld process", status: "initiation" };
const capaClosed: QueryNode = { kind: "capa", id: "capa-2", title: "Update WI-204", status: "closed" };
const doc: QueryNode = { kind: "document", id: "doc-1", title: "WI-204", status: "published" };
const audit: QueryNode = { kind: "audit", id: "aud-1", title: "IATF re-cert", status: "planned" };

const nodes: QueryNode[] = [supplier, ncrOpen, ncrClosed, eightD, capaOpen, capaClosed, doc, audit];

const edges: QueryEdge[] = [
  { fromKind: "supplier", fromId: "sup-1", toKind: "ncr", toId: "ncr-1" },
  { fromKind: "supplier", fromId: "sup-1", toKind: "ncr", toId: "ncr-2" },
  { fromKind: "ncr", fromId: "ncr-1", toKind: "eight_d", toId: "8d-1" },
  { fromKind: "ncr", fromId: "ncr-1", toKind: "capa", toId: "capa-1" },
  { fromKind: "capa", fromId: "capa-1", toKind: "document", toId: "doc-1" },
  { fromKind: "audit", fromId: "aud-1", toKind: "capa", toId: "capa-2" },
];

describe("querySupplierNc8d", () => {
  it("follows supplier -> NC -> 8D and reports counts in steps", () => {
    const result = querySupplierNc8d(nodes, edges, nodeKey("supplier", "sup-1"));
    expect(result.nodeKeys).toEqual(
      expect.arrayContaining([nodeKey("supplier", "sup-1"), nodeKey("ncr", "ncr-1"), nodeKey("eight_d", "8d-1")]),
    );
    expect(result.nodeKeys).toEqual(expect.arrayContaining([nodeKey("ncr", "ncr-2")]));
    expect(result.steps[1]).toContain("2 linked NC");
    expect(result.steps[2]).toContain("1 of those escalated");
    expect(result.truncated).toBe(false);
  });

  it("defaults to every supplier in scope when no focus is given", () => {
    const result = querySupplierNc8d(nodes, edges, undefined);
    expect(result.nodeKeys).toContain(nodeKey("supplier", "sup-1"));
  });
});

describe("queryBlocking", () => {
  it("returns only the OPEN items linked to the focus record", () => {
    const result = queryBlocking(nodes, edges, nodeKey("ncr", "ncr-1"));
    expect(result.nodeKeys).toEqual(expect.arrayContaining([nodeKey("eight_d", "8d-1"), nodeKey("capa", "capa-1")]));
  });

  it("empty when the focus record has no open blockers", () => {
    const result = queryBlocking(nodes, edges, nodeKey("audit", "aud-1"));
    // aud-1's only link is to capa-2, which is closed — not a blocker.
    expect(result.nodeKeys).toEqual([nodeKey("audit", "aud-1")]);
    expect(result.summary).toContain("0 open item");
  });

  it("no focus given — empty result, not an error", () => {
    const result = queryBlocking(nodes, edges, undefined);
    expect(result.nodeKeys).toEqual([]);
    expect(result.truncated).toBe(false);
  });
});

describe("queryDocsImpacted", () => {
  it("finds a document two hops downstream (ncr -> capa -> document)", () => {
    const result = queryDocsImpacted(nodes, edges, nodeKey("ncr", "ncr-1"));
    expect(result.nodeKeys).toContain(nodeKey("document", "doc-1"));
    expect(result.summary).toContain("1 document");
  });

  it("no documents downstream of an isolated focus", () => {
    const result = queryDocsImpacted(nodes, edges, nodeKey("ncr", "ncr-2"));
    expect(result.nodeKeys.filter((k) => k.startsWith("document:"))).toEqual([]);
  });
});

describe("queryOpenCapas", () => {
  it("returns only open CAPAs and their triggers, never closed ones", () => {
    const result = queryOpenCapas(nodes, edges);
    expect(result.nodeKeys).toContain(nodeKey("capa", "capa-1"));
    expect(result.nodeKeys).not.toContain(nodeKey("capa", "capa-2"));
    expect(result.nodeKeys).toContain(nodeKey("ncr", "ncr-1"));
    expect(result.summary).toContain("1 open CAPA");
  });
});

describe("cap/truncation behaviour", () => {
  it("stops at QUERY_CAP and reports truncated: true", () => {
    // A hub node with far more neighbours than QUERY_CAP.
    const hub: QueryNode = { kind: "supplier", id: "hub", title: "Hub", status: "active" };
    const manyNcrs: QueryNode[] = Array.from({ length: QUERY_CAP + 20 }, (_, i) => ({
      kind: "ncr",
      id: `ncr-${i}`,
      title: `NC ${i}`,
      status: "open",
    }));
    const manyEdges: QueryEdge[] = manyNcrs.map((n) => ({
      fromKind: "supplier",
      fromId: "hub",
      toKind: "ncr",
      toId: n.id,
    }));

    const result = querySupplierNc8d([hub, ...manyNcrs], manyEdges, nodeKey("supplier", "hub"));
    expect(result.nodeKeys.length).toBeLessThanOrEqual(QUERY_CAP);
    expect(result.truncated).toBe(true);
  });

  it("does not truncate a small graph", () => {
    const result = queryOpenCapas(nodes, edges);
    expect(result.truncated).toBe(false);
  });
});
