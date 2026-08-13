# P20 — Knowledge Graph Explorer (end-to-end)

**Status:** Backend 🟡 (edges via shipped `entity_links`; needs a bounded graph-query endpoint) · FE 🔴
**Design jsx:** `graph-explorer.jsx`
**Spec:** FEATURES §10.1
**Value:** turns the linkage graph (Inspections↔Findings↔NCR↔8D↔CAPA↔Audit↔Document↔Supplier) into a navigable map — the "show me everything connected to this escape" view.

## 1. Feature scope (from jsx)
- Layered graph: **7 node types** (inspection, finding, nc, eightd, capa, audit, document, supplier) color-coded w/ icons; real seed core + synthetic mass for scale; **clustering** ("+N more").
- **Bounded query engine** (e.g. open-doc / open-CAPA filters, seeds like a specific NC/8D/supplier/audit); pan/zoom, edge routing; click node → jump to its entity detail.
- Node card = title, status, summary, key fields (already shaped in the jsx `ens*` builders).

## 2. Backend
- ✅ **Edges already exist:** the shipped `entity_links` table + `EntityKind` cover every node type except `finding` (add `finding` to `EntityKind` if findings become first-class graph nodes).
- 🟡 **New: bounded neighborhood query** — `GET /v1/graph?seed=<kind>:<id>&depth=1..2&types=&status=` returning `{nodes, edges}` within a **hard cap** (mirror the `LINK_CAP=200` guard in entity-links; the jsx itself bounds + clusters). Assembles from `entity_links` + a thin projection of each entity (title/status/summary/fields) — **read-only, tenant-scoped, no new tables**. Foreign-tenant seed → 404.
- Clustering/layout is a **client** concern (geometry lives in the jsx); the API returns graph data only.

## 3. Frontend (maps to jsx)
- **Route:** `/knowledge-graph`.
- **Components:** GraphCanvas (SVG pan/zoom, `NODE_W/H`, edge routing per jsx), NodeCard, type legend, **query/seed selector**, cluster nodes ("+N more" expand), click-through to entity routes (reuse the `ENTITY_ROUTE` map from documents detail).
- **States:** loading (skeleton graph), empty (no links), error; performance guard on node count.

## 4. Definition of Done
- [ ] `GET /v1/graph` returns bounded {nodes,edges} from entity-links, tenant-scoped, capped; cross-tenant seed → 404.
- [ ] Canvas renders all node types w/ icons/colors, edges, clustering, pan/zoom per `graph-explorer.jsx`.
- [ ] Click node → correct entity detail; query/seed filters work.

## 5. Dependencies & open questions
- Depends on: `entity_links` (✅) across [P01–P10]; the more links those phases write, the richer the graph.
- **Open (sign-off):** are findings first-class nodes (needs `finding` EntityKind + link writes)? depth cap + node cap values; synthetic scale is prototype-only (real graph = real links).
