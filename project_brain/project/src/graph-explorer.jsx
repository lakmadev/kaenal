// Kaenal — Cross-module knowledge graph explorer
// Production-shaped: a large indexed store, but the canvas only ever
// materializes the subgraph a query or expansion returns. Nothing is
// "show everything" — high-degree links collapse into +N clusters.

const QUERY_CAP = 60;     // max nodes a single query paints
const NEIGHBOR_CAP = 6;   // max neighbours of one type before clustering
const CLUSTER_REVEAL = 12; // how many a cluster reveals per click

const fmt = (n) => n.toLocaleString('en-US');

// ── Node type metadata + layout layer ──────────────────────────
const G_TYPES = {
  inspection: { label: 'Inspection',        card: 'Inspection',     color: '#0ea5e9', soft: 'rgba(14,165,233,0.12)', icon: 'clipboard',  layer: 0 },
  supplier:   { label: 'Supplier',          card: 'Supplier',       color: '#0d9488', soft: 'rgba(13,148,136,0.12)', icon: 'truck',      layer: 0 },
  finding:    { label: 'Inspection finding', card: 'Finding',       color: '#0891b2', soft: 'rgba(8,145,178,0.12)',  icon: 'search',     layer: 1 },
  audit:      { label: 'Audit',             card: 'Audit',          color: '#ea580c', soft: 'rgba(234,88,12,0.12)',  icon: 'shieldCheck', layer: 1 },
  nc:         { label: 'Non-conformity',    card: 'Non-conformity', color: '#dc2626', soft: 'rgba(220,38,38,0.12)',  icon: 'alert',      layer: 2 },
  eightd:     { label: '8D case',           card: '8D case',        color: '#6366f1', soft: 'rgba(99,102,241,0.12)', icon: 'brain',      layer: 3 },
  document:   { label: 'Document',          card: 'Document',       color: '#9333ea', soft: 'rgba(147,51,234,0.12)', icon: 'doc',        layer: 4 },
  capa:       { label: 'Corrective action', card: 'Corrective',     color: '#d97706', soft: 'rgba(217,119,6,0.14)',  icon: 'tool',       layer: 5 },
};

const NODE_W = 188;
const NODE_H = 60;

const STATUS_MAP = { approved: 'verified', review: 'in_progress', planned: 'scheduled', capa_open: 'open' };
const normStatus = (s) => STATUS_MAP[s] || s || 'open';
const uname = (id) => { try { return userById(id).name; } catch (e) { return '—'; } };

const DOC_LINKS = [
  { doc: 'D-001', from: '8D-2026-0015', rel: 'updates' },
  { doc: 'D-001', from: 'CAPA-2026-0042', rel: 'revises' },
  { doc: 'D-007', from: '8D-2026-0015', rel: 'references' },
  { doc: 'D-004', from: 'AUD-2026-0021', rel: 'reported in' },
  { doc: 'D-002', from: 'CAPA-2026-0041', rel: 'updates' },
];

// ── Real seed core ─────────────────────────────────────────────
function buildCore() {
  const nodes = {}, edges = [], seen = new Set();
  const add = (id, def) => { if (id && !nodes[id]) nodes[id] = { id, code: id, ...def }; return nodes[id]; };
  const link = (f, t, rel, opts) => { if (!nodes[f] || !nodes[t] || f === t) return; const k = f + '>' + t; if (seen.has(k)) return; seen.add(k); edges.push({ f, t, rel, ...(opts || {}) }); };

  const I = window.INSPECTIONS || [], N = window.NCRS || [], F = window.FINDINGS || [],
    D = window.EIGHT_D_LIST || [], DFULL = window.EIGHT_D, A = window.AUDITS || [],
    AF = window.AUDIT_FINDINGS || [], C = window.CAPAS || [], S = window.SUPPLIERS || [], DOCS = window.DOCS || [];
  const by = (arr, id) => arr.find(x => x.id === id);

  const ensInsp = (id) => { const x = by(I, id); if (!x) return; add(id, { type: 'inspection', title: x.title, status: normStatus(x.status), raw: x, summary: `${x.template} · ${x.area}. ${x.findings} findings, score ${x.score != null ? x.score : '—'}.`, fields: [['Template', x.template], ['Inspector', uname(x.inspectorId)], ['Score', x.score != null ? String(x.score) : '—'], ['Area', x.area]] }); };
  const ensAudit = (id) => { const x = by(A, id); if (!x) return; add(id, { type: 'audit', title: x.title, status: normStatus(x.status), raw: x, summary: `${x.standard}. ${x.description || ''}`, fields: [['Standard', x.standard], ['Lead', uname(x.leadAuditorId)], ['Findings', `${x.findings.major}M · ${x.findings.minor}m`], ['Phase', x.phase]] }); };
  const ensSup = (id) => { const x = by(S, id); if (!x) return; add(id, { type: 'supplier', title: x.name, status: x.riskTier === 'A' ? 'verified' : (x.riskTier === 'D' ? 'overdue' : 'active'), raw: x, summary: `${x.tier} · ${x.category}. Risk tier ${x.riskTier}.`, fields: [['Tier', x.tier], ['Commodity', x.category], ['Risk tier', x.riskTier], ['PPM (YTD)', x.ppmYtd != null ? String(x.ppmYtd) : '—']] }); };
  const ensDoc = (id) => { const x = by(DOCS, id); if (!x) return; add(id, { type: 'document', title: x.name, status: normStatus(x.status), raw: x, summary: `${x.type.toUpperCase()} · ${x.folder} folder · v${x.version}.`, fields: [['Type', x.type.toUpperCase()], ['Version', `v${x.version}`], ['Status', x.status], ['Updated', x.updated]] }); };

  N.forEach(n => add(n.id, { type: 'nc', title: n.title, status: normStatus(n.status), raw: n, summary: n.description || n.title, fields: [['Priority', n.priority || '—'], ['Area', n.area || '—'], ['Owner', uname(n.ownerId)], ['Due', n.due || '—']] }));
  D.forEach(d => add(d.id, { type: 'eightd', title: d.title, status: normStatus(d.status), raw: d, summary: (DFULL && DFULL.id === d.id && DFULL.steps && DFULL.steps.D2 && DFULL.steps.D2.problemStatement) || d.title, fields: [['Step', 'D' + d.currentStep], ['Team lead', uname(d.teamLeadId)], ['Target', d.target], ['Status', d.status]] }));
  C.forEach(c => add(c.id, { type: 'capa', title: c.title, status: normStatus(c.status), raw: c, summary: c.description || c.title, fields: [['Type', c.type], ['Priority', c.priority || '—'], ['Owner', uname(c.ownerId)], ['Due', c.dueDate || '—']] }));

  F.forEach(f => { const ins = 'INS-2026-0042'; ensInsp(ins); const fid = 'FND:' + f.id; add(fid, { type: 'finding', code: 'FND-' + String(f.itemId).toUpperCase(), title: f.observation, status: 'open', raw: f, insId: ins, summary: f.observation, fields: [['Severity', f.severity], ['Photos', String(f.photos || 0)], ['Source', ins], ['NCR', f.ncrId || '—']] }); link(ins, fid, 'finding'); if (f.ncrId) link(fid, f.ncrId, 'triggered'); });
  N.forEach(n => { if (n.eightDId) link(n.id, n.eightDId, 'escalated to'); });
  D.forEach(d => { if (d.ncrId) link(d.ncrId, d.id, 'escalated to'); });
  AF.forEach(af => { ensAudit(af.auditId); if (af.linkedNcr) link(af.auditId, af.linkedNcr, 'raised'); if (af.capaId && nodes[af.capaId]) link(af.auditId, af.capaId, 'requires'); });
  C.forEach(c => { if (c.linkedNcr) link(c.linkedNcr, c.id, 'corrected by'); if (c.linked8d) link(c.linked8d, c.id, 'action plan'); const r = c.sourceRef || ''; if (/^AUD-/.test(r)) { ensAudit(r); link(r, c.id, 'requires'); } else if (/^NCR-/.test(r) && !c.linkedNcr) link(r, c.id, 'corrected by'); else if (/^INS-/.test(r)) { ensInsp(r); link(r, c.id, 'raised'); } else if (/^8D-/.test(r) && !c.linked8d) link(r, c.id, 'action plan'); });
  S.forEach(s => { const touches = [...(s.linkedNcrs || []), ...(s.linked8ds || [])].some(id => nodes[id]); const ar = s.linkedAudits || []; if (!touches && !ar.length) return; ensSup(s.id); (s.linkedNcrs || []).forEach(id => { if (nodes[id]) link(s.id, id, 'source of'); }); (s.linked8ds || []).forEach(id => { if (nodes[id]) link(s.id, id, 'source of'); }); ar.forEach(id => { if (/^AUD-/.test(id)) { ensAudit(id); link(s.id, id, 'audited in'); } else if (/^INS-/.test(id)) { ensInsp(id); link(s.id, id, 'audited in'); } }); });
  DOC_LINKS.forEach(dl => { if (!nodes[dl.from]) return; ensDoc(dl.doc); link(dl.from, dl.doc, dl.rel); });

  return { nodes, edges };
}

// ── Synthetic mass (so scale behaviour is real) ────────────────
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function buildStore() {
  const core = buildCore();
  const nodes = { ...core.nodes };
  const edges = [...core.edges];
  const rnd = mulberry32(20260530);
  const ri = (n) => Math.floor(rnd() * n);
  const pick = (a) => a[ri(a.length)];

  const stems = ['Apex', 'Meridian', 'Crown', 'Vertex', 'Summit', 'Delta', 'Pioneer', 'Atlas', 'Nexus', 'Quantum', 'Forge', 'Titan', 'Cardinal', 'Keystone', 'Vanguard', 'Helix', 'Orbit', 'Granite', 'Sterling', 'Pinnacle', 'Cobalt', 'Beacon', 'Monarch', 'Zenith', 'Lumen', 'Borealis', 'Echelon', 'Sentinel', 'Halcyon', 'Ironclad'];
  const sfx = ['Stamping', 'Castings', 'Forgings', 'Components', 'Industries', 'Manufacturing', 'Precision', 'Engineering', 'Metalworks', 'Polymers'];
  const regions = ['Germany', 'China', 'India', 'Japan', 'Mexico', 'USA', 'Czechia', 'Brazil'];
  const parts = ['A-7742', 'B-0421', 'BHS-12', 'T-9384', 'F-204', 'IM-220', 'P-110', 'BR-100', 'PCB-S204', 'R-44', 'S-44', 'HR-380'];
  const ncTpl = ['Dimensional deviation — {p}', 'Surface finish below spec — {p}', 'Porosity detected — {p}', 'Torque out of spec — {p}', 'Plating thickness low — {p}', 'Weld undercut — {p}', 'Contamination found — {p}', 'Missing traceability — {p}', 'Hardness out of range — {p}', 'Burr at edge — {p}'];
  const ncStatus = ['open', 'in_progress', 'in_progress', 'assigned', 'resolved', 'closed', 'verified'];
  const capaStatus = ['open', 'in_progress', 'in_progress', 'verification', 'completed', 'closed'];
  const pad = (i) => String(1000 + (i % 8999));

  const supIds = [], auditIds = [], docIds = [], dIds = [], capaIds = [];

  for (let i = 0; i < 30; i++) { const id = 'syn:sup:' + i; const name = pick(stems) + ' ' + pick(sfx); const rt = pick(['A', 'B', 'B', 'C', 'C', 'D']); nodes[id] = { id, code: 'SUP-' + (4000 + i), type: 'supplier', synthetic: true, title: name, status: rt === 'A' ? 'verified' : (rt === 'D' ? 'overdue' : 'active'), summary: `${name} — Tier ${pick(['1', '2'])} supplier. Risk tier ${rt}.`, fields: [['Tier', 'Tier ' + pick(['1', '2'])], ['Risk tier', rt], ['PPM (YTD)', String(20 + ri(420))], ['Region', pick(regions)]] }; supIds.push(id); }
  for (let i = 0; i < 60; i++) { const id = 'syn:aud:' + i; nodes[id] = { id, code: 'AUD-2025-' + pad(i), type: 'audit', synthetic: true, title: pick(['Process audit', 'Supplier audit', 'Layered process audit', 'System audit']) + ' — ' + pick(['Plant A', 'Plant B', 'Stamping', 'Welding', 'Paint', 'Assembly']), status: pick(['in_progress', 'completed', 'completed', 'scheduled']), summary: 'Periodic audit record (indexed).', fields: [['Standard', 'IATF 16949'], ['Lead', uname('u4')], ['Phase', pick(['fieldwork', 'reporting', 'closed'])], ['Findings', ri(8) + 'M · ' + ri(12) + 'm']] }; auditIds.push(id); }
  for (let i = 0; i < 300; i++) { const id = 'syn:doc:' + i; nodes[id] = { id, code: 'DOC-' + (2000 + i), type: 'document', synthetic: true, title: pick(['Control Plan', 'PFMEA', 'Work Instruction', 'Inspection SOP', 'Process Spec']) + ' — ' + pick(parts), status: pick(['verified', 'verified', 'in_progress', 'draft']), summary: 'Controlled document (indexed).', fields: [['Type', pick(['PDF', 'DOCX', 'XLSX'])], ['Version', 'v' + (1 + ri(9)) + '.' + ri(9)], ['Status', 'controlled'], ['Owner', 'QA']] }; docIds.push(id); }
  for (let i = 0; i < 1500; i++) { const id = 'syn:8d:' + i; const p = pick(parts); nodes[id] = { id, code: '8D-2025-' + pad(i), type: 'eightd', synthetic: true, title: 'Root-cause investigation — ' + p, status: pick(['active', 'active', 'completed']), summary: '8D investigation for ' + p + ' (indexed).', fields: [['Step', 'D' + (1 + ri(8))], ['Team lead', uname('u2')], ['Target', '2026'], ['Status', 'active']] }; dIds.push(id); }
  for (let i = 0; i < 2500; i++) { const id = 'syn:capa:' + i; nodes[id] = { id, code: 'CAPA-2025-' + pad(i), type: 'capa', synthetic: true, title: pick(['Closed-loop control', 'Tooling refresh', 'SPC monitoring', 'Operator training', 'Supplier spec update', 'Fixture redesign']) + ' — ' + pick(parts), status: pick(capaStatus), summary: 'Corrective action (indexed).', fields: [['Type', pick(['corrective', 'preventive'])], ['Priority', pick(['critical', 'high', 'medium', 'low'])], ['Owner', uname('u3')], ['Due', '2026']] }; capaIds.push(id); }
  // 8D → its CAPA (1:1 for the first 1500 capas)
  for (let i = 0; i < dIds.length; i++) edges.push({ f: dIds[i], t: capaIds[i], rel: 'action plan' });

  for (let i = 0; i < 8000; i++) {
    const id = 'syn:nc:' + i; const p = pick(parts);
    nodes[id] = { id, code: 'NCR-2025-' + pad(i), type: 'nc', synthetic: true, title: ncTpl[ri(ncTpl.length)].replace('{p}', p), status: pick(ncStatus), summary: 'Non-conformity on ' + p + ' (indexed scale record).', fields: [['Priority', pick(['critical', 'major', 'minor'])], ['Area', pick(['Plant A', 'Plant B', 'Incoming'])], ['Owner', uname(pick(['u2', 'u3', 'u6', 'u7']))], ['Part', p]] };
    edges.push({ f: pick(supIds), t: id, rel: 'source of' });
    if (rnd() < 0.28) edges.push({ f: pick(auditIds), t: id, rel: 'raised' });
    const e = rnd();
    if (e < 0.6) edges.push({ f: id, t: pick(dIds), rel: 'escalated to' });
    else if (e < 0.78) edges.push({ f: id, t: pick(capaIds), rel: 'corrected by' });
  }
  // some 8Ds/CAPAs reference documents
  for (let i = 0; i < dIds.length; i++) if (rnd() < 0.12) edges.push({ f: dIds[i], t: pick(docIds), rel: 'references' });
  for (let i = 0; i < capaIds.length; i++) if (rnd() < 0.1) edges.push({ f: capaIds[i], t: pick(docIds), rel: 'revises' });

  // adjacency
  const out = {}, inc = {};
  Object.keys(nodes).forEach(id => { out[id] = []; inc[id] = []; });
  edges.forEach(e => { (out[e.f] || (out[e.f] = [])).push({ t: e.t, rel: e.rel }); (inc[e.t] || (inc[e.t] = [])).push({ f: e.f, rel: e.rel }); });

  return { nodes, edges, out, inc, totalNodes: Object.keys(nodes).length, totalEdges: edges.length };
}

// ── Geometry + layered layout ──────────────────────────────────
const edgeKey = (e) => `${e.f}>${e.t}`;
function edgeGeometry(a, b) {
  const vertical = Math.abs(a.x - b.x) < 60;
  let sx, sy, ex, ey;
  if (vertical) { sx = a.x + NODE_W / 2; ex = b.x + NODE_W / 2; if (b.y > a.y) { sy = a.y + NODE_H; ey = b.y; } else { sy = a.y; ey = b.y + NODE_H; } }
  else if (b.x > a.x) { sx = a.x + NODE_W; sy = a.y + NODE_H / 2; ex = b.x; ey = b.y + NODE_H / 2; }
  else { sx = a.x; sy = a.y + NODE_H / 2; ex = b.x + NODE_W; ey = b.y + NODE_H / 2; }
  const cdx = vertical ? 0 : (ex - sx) * 0.5, cdy = vertical ? (ey - sy) * 0.5 : 0;
  return { sx, sy, ex, ey, path: `M ${sx} ${sy} C ${sx + cdx} ${sy + cdy}, ${ex - cdx} ${ey - cdy}, ${ex} ${ey}`, mx: (sx + ex) / 2, my: (sy + ey) / 2 };
}
function layoutNodes(nodes, edges) {
  const COL_W = 300, ROW_H = 86, X0 = 40, Y0 = 40;
  Object.values(nodes).forEach(n => { n.layer = G_TYPES[n.type].layer; });
  const layers = {};
  Object.values(nodes).forEach(n => (layers[n.layer] = layers[n.layer] || []).push(n));
  const keys = Object.keys(layers).map(Number).sort((a, b) => a - b);
  const adj = {}; Object.keys(nodes).forEach(id => adj[id] = { in: [], out: [] });
  edges.forEach(e => { if (adj[e.f] && adj[e.t]) { adj[e.f].out.push(e.t); adj[e.t].in.push(e.f); } });
  keys.forEach(L => layers[L].forEach((n, i) => n._i = i));
  const bary = (n, d) => { const ns = d === 'in' ? adj[n.id].in : adj[n.id].out; if (!ns.length) return n._i; return ns.reduce((s, m) => s + (nodes[m] ? nodes[m]._i : 0), 0) / ns.length; };
  for (let it = 0; it < 8; it++) { const fwd = it % 2 === 0; (fwd ? keys : [...keys].reverse()).forEach(L => { layers[L].sort((a, b) => bary(a, fwd ? 'in' : 'out') - bary(b, fwd ? 'in' : 'out')); layers[L].forEach((n, i) => n._i = i); }); }
  const maxRows = Math.max(1, ...keys.map(L => layers[L].length));
  keys.forEach((L, li) => { const arr = layers[L]; const off = (maxRows * ROW_H - arr.length * ROW_H) / 2; arr.forEach((n, i) => { n.x = X0 + li * COL_W; n.y = Y0 + off + i * ROW_H; }); });
}

// neighbours grouped by type, core-first
function neighborsGrouped(store, id) {
  const map = {};
  const push = (other, rel, dir) => { const t = store.nodes[other].type; const g = map[t] || (map[t] = { entries: [], seen: new Set() }); if (g.seen.has(other)) return; g.seen.add(other); g.entries.push({ other, rel, dir }); };
  (store.out[id] || []).forEach(o => push(o.t, o.rel, 'out'));
  (store.inc[id] || []).forEach(o => push(o.f, o.rel, 'in'));
  Object.values(map).forEach(g => g.entries.sort((a, b) => (store.nodes[a.other].synthetic ? 1 : 0) - (store.nodes[b.other].synthetic ? 1 : 0)));
  return map;
}

// build render layout for current visible set + clusters
function layoutVisible(store, ids, clusters) {
  const rnodes = {};
  ids.forEach(id => { if (store.nodes[id]) rnodes[id] = { ...store.nodes[id] }; });
  clusters.forEach(c => { const cid = 'cl:' + c.key; rnodes[cid] = { id: cid, type: c.type, cluster: true, count: c.remaining.length, src: c.src, code: G_TYPES[c.type].card, title: `+${fmt(c.remaining.length)} more` }; });
  const vis = new Set(Object.keys(rnodes));
  const redges = [];
  store.edges.forEach(e => { if (vis.has(e.f) && vis.has(e.t)) redges.push(e); });
  clusters.forEach(c => { const cid = 'cl:' + c.key; if (vis.has(c.src) && vis.has(cid)) redges.push({ f: c.src, t: cid, rel: `+${fmt(c.remaining.length)}`, cluster: true }); });
  layoutNodes(rnodes, redges);
  let w = 0, h = 0; Object.values(rnodes).forEach(n => { w = Math.max(w, n.x + NODE_W); h = Math.max(h, n.y + NODE_H); });
  return { nodes: rnodes, edges: redges, worldW: w + 60, worldH: h + 60 };
}

// ── Query engine (bounded) ─────────────────────────────────────
const OPEN_DOC = (s) => !['verified', 'approved', 'closed'].includes(s);
const OPEN_CAPA = (s) => !['verified', 'closed', 'completed', 'resolved'].includes(s);

function qSupplierD8(store) {
  const sup = new Set(), nc = new Set(), d = new Set(), triples = [];
  for (const e of store.edges) {
    if (store.nodes[e.f].type === 'supplier' && store.nodes[e.t].type === 'nc') {
      const esc = (store.out[e.t] || []).find(o => store.nodes[o.t].type === 'eightd');
      if (esc) { triples.push([e.f, e.t, esc.t]); sup.add(e.f); nc.add(e.t); d.add(esc.t); }
    }
  }
  triples.sort((a, b) => (store.nodes[a[0]].synthetic ? 1 : 0) - (store.nodes[b[0]].synthetic ? 1 : 0));
  const ids = [], edgeKeys = new Set(), seen = new Set();
  for (const [s, n, dd] of triples) { [s, n, dd].forEach(x => { if (!seen.has(x)) { seen.add(x); ids.push(x); } }); edgeKeys.add(s + '>' + n); edgeKeys.add(n + '>' + dd); if (ids.length >= QUERY_CAP) break; }
  const ex = triples.slice(0, 3).map(t => `${store.nodes[t[0]].code} → ${store.nodes[t[1]].code} → ${store.nodes[t[2]].code}`);
  return { ids: ids.slice(0, QUERY_CAP), edgeKeys, total: triples.length, truncated: triples.length * 3 > QUERY_CAP,
    interpreted: ['entity = supplier', 'relation = NC → triggered → 8D', 'window = last 12 months'],
    summary: `${fmt(sup.size)} suppliers · ${fmt(nc.size)} NCs · ${fmt(d.size)} 8D cases`,
    steps: ['Scanned every supplier → non-conformity link in the index.', 'Kept only NCs that escalated to an 8D within the last 12 months.', `Matched ${fmt(triples.length)} paths, e.g. ${ex.join('  ·  ')}. ✓`] };
}
function qBlocking(store, id) {
  const focus = store.nodes[id] ? id : '8D-2026-0015';
  const ids = [focus], edgeKeys = new Set(), blockers = [];
  (store.out[focus] || []).forEach(o => {
    const tn = store.nodes[o.t];
    if ((tn.type === 'capa' && OPEN_CAPA(tn.status)) || (tn.type === 'document' && OPEN_DOC(tn.status))) {
      ids.push(o.t); edgeKeys.add(focus + '>' + o.t); blockers.push(tn);
      (store.out[o.t] || []).forEach(o2 => { const t2 = store.nodes[o2.t]; if (t2.type === 'document' && OPEN_DOC(t2.status)) { ids.push(o2.t); edgeKeys.add(o.t + '>' + o2.t); blockers.push(t2); } });
    }
  });
  const f = store.nodes[focus];
  return { ids: [...new Set(ids)].slice(0, QUERY_CAP), edgeKeys, total: blockers.length, truncated: false,
    interpreted: [`focus = ${focus}`, 'relation = open dependencies', 'state = not closed'],
    summary: `${f.code} · ${blockers.filter(b => b.type === 'capa').length} open CAPA · ${blockers.filter(b => b.type === 'document').length} document(s) in review`,
    steps: [`${f.code} can only close once its corrective actions verify and linked documents are released.`, ...blockers.slice(0, 3).map(b => `${b.code} (${b.title.slice(0, 44)}${b.title.length > 44 ? '…' : ''}) — still ${b.status.replace('_', ' ')}.`)] };
}
function qDocsImpacted(store, anchor) {
  const a = store.nodes[anchor] ? anchor : 'NCR-2026-0089';
  const ids = [a], edgeKeys = new Set(), vis = new Set([a]), q = [a];
  while (q.length && ids.length < QUERY_CAP) { const cur = q.shift(); (store.out[cur] || []).forEach(o => { edgeKeys.add(cur + '>' + o.t); if (!vis.has(o.t)) { vis.add(o.t); ids.push(o.t); q.push(o.t); } }); }
  const docs = ids.map(i => store.nodes[i]).filter(n => n.type === 'document');
  return { ids: ids.slice(0, QUERY_CAP), edgeKeys, total: docs.length, truncated: ids.length >= QUERY_CAP,
    interpreted: [`anchor = ${store.nodes[a].code}`, 'relation = impacts → document', 'type = document'],
    summary: `${fmt(docs.length)} document${docs.length !== 1 ? 's' : ''} · downstream of ${store.nodes[a].code}`,
    steps: [`Anchored on ${store.nodes[a].code}.`, 'Traversed every downstream link through 8Ds and corrective actions.', docs.length ? `Documents requiring revision: ${docs.map(d => d.code).join(', ')}. ✓` : 'No documents downstream.'] };
}
function qOpenCapas(store) {
  let total = 0; const ids = [], edgeKeys = new Set();
  for (const n of Object.values(store.nodes)) {
    if (n.type === 'capa' && OPEN_CAPA(n.status)) {
      total++;
      if (ids.length < QUERY_CAP) {
        if (!ids.includes(n.id)) ids.push(n.id);
        (store.inc[n.id] || []).slice(0, 2).forEach(o => { if (ids.length < QUERY_CAP && !ids.includes(o.f)) { ids.push(o.f); edgeKeys.add(o.f + '>' + n.id); } });
      }
    }
  }
  return { ids: ids.slice(0, QUERY_CAP), edgeKeys, total, truncated: total > ids.filter(i => store.nodes[i].type === 'capa').length,
    interpreted: ['type = corrective action', 'state = open', 'relation = ← what triggered it'],
    summary: `${fmt(total)} open CAPAs and their triggers`,
    steps: ['Selected all corrective actions not yet verified or closed.', 'Traced each back to the audit, NC or 8D that triggered it.', `${fmt(total)} open CAPAs in the index. ✓`] };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ── Component ──────────────────────────────────────────────────
function GraphExplorer({ setRoute, setNcr, set8d, setCapa, setInspection, setSupplier, setAudit, setDoc }) {
  const { useState, useEffect, useRef, useMemo } = React;
  const store = useMemo(() => buildStore(), []);

  const SEEDS = useMemo(() => [
    { id: 'NCR-2026-0089', label: 'Weld porosity NC' },
    { id: '8D-2026-0015', label: '8D-2026-0015' },
    { id: 'SUP-0142', label: 'Precision Stamping GmbH' },
    { id: 'AUD-2026-0021', label: 'IATF re-cert audit' },
  ].filter(s => store.nodes[s.id]), [store]);

  const QUERIES = useMemo(() => [
    { id: 'q1', chip: 'NCs from a supplier that triggered a D8', text: 'show all NCs from supplier X that triggered a D8 in the last year', run: () => qSupplierD8(store) },
    { id: 'q2', chip: "What's blocking 8D-2026-0015?", text: 'what is blocking 8D-2026-0015 from closing', run: () => qBlocking(store, '8D-2026-0015') },
    { id: 'q3', chip: 'Documents impacted by the weld porosity NC', text: 'which documents are impacted by NCR-2026-0089', run: () => qDocsImpacted(store, 'NCR-2026-0089') },
    { id: 'q4', chip: 'Open CAPAs and what triggered them', text: 'show open CAPAs and what triggered them', run: () => qOpenCapas(store) },
  ], [store]);
  const matchTyped = (t) => { const s = t.toLowerCase(); if (s.includes('block') || s.includes('clos')) return QUERIES[1]; if (s.includes('document') || s.includes('impact') || s.includes('porosity')) return QUERIES[2]; if (s.includes('capa') || s.includes('corrective')) return QUERIES[3]; return QUERIES[0]; };

  const canvasRef = useRef(null), dragRef = useRef(null), laidRef = useRef(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 0.8 });
  const [panning, setPanning] = useState(false);
  const [visible, setVisible] = useState(() => new Set());
  const [clusters, setClusters] = useState([]); // {key, src, type, remaining:[ids], total}
  const [expanded, setExpanded] = useState(() => new Set());
  const [selected, setSelected] = useState(null);
  const [hoverEdge, setHoverEdge] = useState(null);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [showWhy, setShowWhy] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [hidden, setHidden] = useState({});

  const visKey = useMemo(() => [...visible].sort().join('|'), [visible]);
  const clusKey = useMemo(() => clusters.map(c => c.key + ':' + c.remaining.length).join('|'), [clusters]);
  const laid = useMemo(() => layoutVisible(store, [...visible], clusters), [store, visKey, clusKey]);
  laidRef.current = laid;

  const matchedNodes = result ? new Set(result.ids) : null;
  const matchedEdges = result ? result.edgeKeys : null;

  const fitTo = (ids) => {
    const el = canvasRef.current, L = laidRef.current; if (!el || !L) return;
    const cw = el.clientWidth, ch = el.clientHeight;
    const list = (ids && ids.length ? ids : Object.keys(L.nodes)).map(id => L.nodes[id]).filter(Boolean);
    if (!list.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    list.forEach(n => { minX = Math.min(minX, n.x); minY = Math.min(minY, n.y); maxX = Math.max(maxX, n.x + NODE_W); maxY = Math.max(maxY, n.y + NODE_H); });
    const pad = 90;
    const k = clamp(Math.min(cw / (maxX - minX + pad * 2), ch / (maxY - minY + pad * 2)), 0.3, 1.25);
    setView({ k, x: (cw - (minX + maxX) * k) / 2, y: (ch - (minY + maxY) * k) / 2 });
  };
  const fitSoon = (ids) => setTimeout(() => fitTo(ids), 50);

  useEffect(() => {
    const mv = (e) => { if (!dragRef.current) return; const d = dragRef.current; setView(v => ({ ...v, x: d.ox + (e.clientX - d.sx), y: d.oy + (e.clientY - d.sy) })); };
    const up = () => { dragRef.current = null; setPanning(false); };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
  }, []);
  const onBgDown = (e) => { dragRef.current = { sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y }; setPanning(true); };
  const zoom = (f) => { const el = canvasRef.current; if (!el) return; const cw = el.clientWidth, ch = el.clientHeight; setView(v => { const k = clamp(v.k * f, 0.25, 1.9); const cx = (cw / 2 - v.x) / v.k, cy = (ch / 2 - v.y) / v.k; return { k, x: cw / 2 - cx * k, y: ch / 2 - cy * k }; }); };
  const onWheel = (e) => { const el = canvasRef.current; if (!el) return; const r = el.getBoundingClientRect(); const px = e.clientX - r.left, py = e.clientY - r.top; setView(v => { const k = clamp(v.k * (e.deltaY < 0 ? 1.08 : 0.925), 0.25, 1.9); const wx = (px - v.x) / v.k, wy = (py - v.y) / v.k; return { k, x: px - wx * k, y: py - wy * k }; }); };

  const mergeClusters = (cs, incoming) => { const byKey = {}; cs.forEach(c => byKey[c.key] = c); incoming.forEach(c => { if (!byKey[c.key]) byKey[c.key] = c; }); return Object.values(byKey); };

  const expandGroups = (id, onlyType) => {
    const grouped = neighborsGrouped(store, id);
    const add = [id]; const newClusters = [];
    Object.entries(grouped).forEach(([type, g]) => {
      if (onlyType && type !== onlyType) return;
      const already = new Set([...visible].filter(v => store.nodes[v] && store.nodes[v].type === type));
      const fresh = g.entries.filter(e => !already.has(e.other));
      const take = fresh.slice(0, NEIGHBOR_CAP).map(e => e.other);
      take.forEach(x => add.push(x));
      const rest = fresh.slice(NEIGHBOR_CAP).map(e => e.other);
      if (rest.length) newClusters.push({ key: id + '|' + type, src: id, type, remaining: rest, total: g.entries.length });
    });
    setVisible(v => new Set([...v, ...add]));
    if (newClusters.length) setClusters(cs => mergeClusters(cs.filter(c => !newClusters.some(n => n.key === c.key)), newClusters));
    setExpanded(e => new Set([...e, id]));
    fitSoon(null);
  };

  const expandCluster = (c) => {
    const reveal = c.remaining.slice(0, CLUSTER_REVEAL), rest = c.remaining.slice(CLUSTER_REVEAL);
    setVisible(v => new Set([...v, ...reveal]));
    setClusters(cs => cs.map(x => x.key === c.key ? { ...x, remaining: rest } : x).filter(x => x.remaining.length > 0));
    fitSoon(null);
  };

  const onNodeClick = (id) => { setSelected(id); if (!expanded.has(id)) expandGroups(id); };

  const seed = (id) => { setResult(null); setShowWhy(false); setQuery(''); setClusters([]); setExpanded(new Set()); setVisible(new Set([id])); setSelected(id); setTimeout(() => { expandGroups(id); }, 0); };

  const runQuery = (q) => {
    const res = q.run();
    setResult(res); setShowWhy(true); setSelected(null); setQuery(q.text);
    setClusters([]); setExpanded(new Set()); setVisible(new Set(res.ids));
    fitSoon(res.ids);
  };
  const runTyped = () => { if (query.trim()) runQuery(matchTyped(query)); };
  const clearAll = () => { setResult(null); setShowWhy(false); setQuery(''); setVisible(new Set()); setClusters([]); setExpanded(new Set()); setSelected(null); };

  const openRecord = (id) => {
    const n = store.nodes[id]; if (!n || n.synthetic) return;
    switch (n.type) {
      case 'finding': setInspection && setInspection(n.insId); setRoute('inspection-detail'); break;
      case 'inspection': setInspection && setInspection(n.id); setRoute('inspection-detail'); break;
      case 'nc': setNcr && setNcr(n.id); setRoute('ncr-detail'); break;
      case 'eightd': set8d && set8d(n.id); setRoute('8d-detail'); break;
      case 'capa': setCapa && setCapa(n.id); setRoute('capa-detail'); break;
      case 'supplier': setSupplier && setSupplier(n.id); setRoute('supplier-detail'); break;
      case 'audit': setAudit && setAudit(n.id); setRoute('audit-detail'); break;
      case 'document': setDoc && setDoc(n.id); setRoute('document-detail'); break;
      default: break;
    }
  };

  const sel = selected ? store.nodes[selected] : null;
  const selGroups = sel ? neighborsGrouped(store, selected) : null;
  const dimmed = (id) => result && showWhy && !matchedNodes.has(id);
  const shownCount = [...visible].filter(id => store.nodes[id]).length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Query bar */}
      <div style={{ padding: '18px 28px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Icon name="gitBranch" size={18} stroke={1.9} style={{ color: 'var(--accent)' }} />
          <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', margin: 0 }}>Knowledge graph</h1>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Query-first explorer across every quality module.</span>
          <span className="k-chip mono" style={{ marginLeft: 'auto', background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{fmt(store.totalNodes)} records · {fmt(store.totalEdges)} links indexed</span>
          {shownCount > 0 && <span className="k-chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>Showing {shownCount}</span>}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', maxWidth: 920 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--accent)', display: 'flex' }}><Icon name="sparkles" size={16} stroke={1.9} /></span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') runTyped(); }}
              placeholder="show all NCs from supplier X that triggered a D8 in the last year"
              style={{ width: '100%', height: 44, padding: '0 14px 0 40px', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: 14, outline: 'none' }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--ring)'; e.target.style.background = 'var(--surface)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; e.target.style.background = 'var(--bg-subtle)'; }} />
          </div>
          <button className="k-btn k-btn-primary" style={{ height: 44, padding: '0 18px', borderRadius: 'var(--r-lg)' }} onClick={runTyped}><Icon name="sparkles" size={15} stroke={2} /> Ask</button>
        </div>

        {!result ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11.5, color: 'var(--text-subtle)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Try</span>
            {QUERIES.map(q => (
              <button key={q.id} onClick={() => runQuery(q)} style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)', background: 'var(--bg-subtle)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: 'var(--r-full)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text)'; }}>
                <Icon name="search" size={12} stroke={2} /> {q.chip}
              </button>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Interpreted as</span>
            {result.interpreted.map((t, i) => <span key={i} className="mono" style={{ fontSize: 11.5, color: 'var(--text)', background: 'var(--bg-subtle)', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: 'var(--r-sm)' }}>{t}</span>)}
            <span style={{ width: 1, height: 18, background: 'var(--border)' }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}><Icon name="check" size={13} stroke={2.5} style={{ color: 'var(--success-600)', verticalAlign: '-2px', marginRight: 4 }} />{result.summary}</span>
            {result.truncated && <span className="k-chip" style={{ background: 'var(--warning-50)', color: 'var(--warning-700)', border: '1px solid var(--warning-100)' }}>showing first {shownCount} — refine to narrow</span>}
            <button onClick={() => setShowWhy(v => !v)} style={{ fontSize: 12, fontWeight: 600, padding: '5px 11px', borderRadius: 'var(--r-full)', display: 'inline-flex', alignItems: 'center', gap: 6, background: showWhy ? 'var(--accent)' : 'var(--accent-soft)', color: showWhy ? 'white' : 'var(--accent)', border: `1px solid ${showWhy ? 'var(--accent)' : 'transparent'}` }}><Icon name="zap" size={12} stroke={2} /> Why these results</button>
            <button onClick={clearAll} className="k-btn-plain" style={{ fontSize: 12, fontWeight: 500, padding: '5px 10px', borderRadius: 'var(--r-md)', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="x" size={13} stroke={2} /> Clear</button>
          </div>
        )}
      </div>

      {/* Canvas */}
      <div ref={canvasRef} onMouseDown={onBgDown} onWheel={onWheel}
        style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden', cursor: panning ? 'grabbing' : 'grab', background: 'var(--bg)', backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)', backgroundSize: '26px 26px' }}>

        {shownCount === 0 ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', marginBottom: 16 }}><Icon name="gitBranch" size={26} stroke={1.7} /></div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Explore {fmt(store.totalNodes)} connected records</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 460, marginBottom: 18 }}>The canvas stays empty until you ask. Run a natural-language query above, or drop in a starting record and expand outward — only the subgraph you touch is drawn.</div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: 8 }}>Start from a record</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 560 }}>
              {SEEDS.map(s => { const tp = G_TYPES[store.nodes[s.id].type]; return (
                <button key={s.id} onClick={() => seed(s.id)} className="k-btn-ghost" style={{ height: 34, padding: '0 12px', borderRadius: 'var(--r-md)', display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 500 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: tp.color }} />{s.label}
                </button>
              ); })}
            </div>
          </div>
        ) : (
          <div style={{ position: 'absolute', top: 0, left: 0, transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: '0 0' }}>
            <svg width={laid.worldW} height={laid.worldH} style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', pointerEvents: 'none' }}>
              <defs>
                <marker id="g-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0 0 L8 4.5 L0 9 z" fill="var(--border-strong)" /></marker>
                <marker id="g-arrow-a" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0 0 L8 4.5 L0 9 z" fill="var(--accent)" /></marker>
              </defs>
              {laid.edges.map(e => {
                const a = laid.nodes[e.f], b = laid.nodes[e.t]; if (!a || !b) return null;
                if (hidden[a.type] || hidden[b.type]) return null;
                const g = edgeGeometry(a, b); const k = edgeKey(e);
                const isMatch = matchedEdges && matchedEdges.has(k);
                const conn = selected && (e.f === selected || e.t === selected);
                const isDim = result && showWhy && !isMatch && !e.cluster;
                const active = (showWhy && isMatch) || conn;
                return (
                  <g key={k} style={{ opacity: isDim ? 0.12 : 1, transition: 'opacity 200ms' }}>
                    <path d={g.path} fill="none" stroke={active ? 'var(--accent)' : 'var(--border-strong)'} strokeWidth={active ? 2.4 : 1.5}
                      strokeDasharray={e.cluster ? '2 4' : (showWhy && isMatch ? '7 6' : 'none')}
                      markerEnd={`url(#${active ? 'g-arrow-a' : 'g-arrow'})`} style={showWhy && isMatch ? { animation: 'g-flow 0.7s linear infinite' } : null} />
                    {(conn || (showWhy && isMatch) || hoverEdge === k || e.cluster) && (
                      <g transform={`translate(${g.mx}, ${g.my})`}>
                        <rect x={-(e.rel.length * 3.1 + 8)} y={-9} width={e.rel.length * 6.2 + 16} height={18} rx={9} fill="var(--surface)" stroke={active ? 'var(--accent)' : 'var(--border)'} strokeWidth="1" />
                        <text x="0" y="3.5" textAnchor="middle" fontSize="10.5" fontWeight="600" fill={active ? 'var(--accent)' : 'var(--text-muted)'} fontFamily="var(--font-sans)">{e.rel}</text>
                      </g>
                    )}
                  </g>
                );
              })}
              {laid.edges.map(e => { const a = laid.nodes[e.f], b = laid.nodes[e.t]; if (!a || !b || hidden[a.type] || hidden[b.type]) return null; const g = edgeGeometry(a, b); return <path key={'h' + edgeKey(e)} d={g.path} fill="none" stroke="transparent" strokeWidth="14" style={{ pointerEvents: 'stroke', cursor: 'pointer' }} onMouseEnter={() => setHoverEdge(edgeKey(e))} onMouseLeave={() => setHoverEdge(h => h === edgeKey(e) ? null : h)} />; })}
            </svg>

            {Object.entries(laid.nodes).map(([id, n]) => {
              if (hidden[n.type]) return null;
              const tp = G_TYPES[n.type];
              if (n.cluster) {
                return (
                  <button key={id} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); const c = clusters.find(c => 'cl:' + c.key === id); if (c) expandCluster(c); }}
                    style={{ position: 'absolute', left: n.x, top: n.y, width: NODE_W, height: NODE_H, background: tp.soft, borderRadius: 'var(--r-lg)', border: `1.5px dashed ${tp.color}`, padding: '8px 11px', cursor: 'pointer', display: 'flex', gap: 9, alignItems: 'center', textAlign: 'left' }}
                    title="Click to reveal more">
                    <div style={{ width: 28, height: 28, borderRadius: 'var(--r-md)', background: 'var(--surface)', color: tp.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${tp.color}` }}><Icon name="plus" size={15} stroke={2.4} /></div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: tp.color, lineHeight: 1 }}>+{fmt(n.count)}</div>
                      <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', marginTop: 2 }}>more {tp.label.toLowerCase()}s · reveal</div>
                    </div>
                  </button>
                );
              }
              const isSel = selected === id, isMatch = matchedNodes && matchedNodes.has(id), isDim = dimmed(id);
              return (
                <div key={id} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onNodeClick(id); }}
                  style={{ position: 'absolute', left: n.x, top: n.y, width: NODE_W, minHeight: NODE_H, background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: `1px solid ${isSel ? tp.color : 'var(--border)'}`, borderLeft: `4px solid ${tp.color}`, boxShadow: isSel ? `0 0 0 3px ${tp.soft}, var(--shadow-lg)` : (showWhy && isMatch ? `0 0 0 3px var(--ring), var(--shadow-md)` : 'var(--shadow-sm)'), padding: '8px 11px', cursor: 'pointer', opacity: isDim ? 0.28 : 1, transition: 'opacity 200ms, box-shadow 150ms, transform 120ms', display: 'flex', gap: 9, alignItems: 'flex-start' }}
                  onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.transform = 'translateY(-1px)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}>
                  <div style={{ width: 28, height: 28, borderRadius: 'var(--r-md)', background: tp.soft, color: tp.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}><Icon name={tp.icon} size={15} stroke={2} /></div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: tp.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tp.card}</span>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: (STATUS_STYLES[n.status] || {}).dot || 'var(--text-subtle)', flexShrink: 0 }} title={n.status} />
                    </div>
                    <div className="mono" style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginTop: 1 }}>{n.code}</div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.22, marginTop: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.title}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* zoom controls */}
        {shownCount > 0 && (
          <div style={{ position: 'absolute', left: 16, bottom: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={() => zoom(1.2)} className="k-btn-ghost" style={{ width: 34, height: 34, padding: 0, justifyContent: 'center', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-sm)' }}><Icon name="plus" size={16} stroke={2} /></button>
            <button onClick={() => zoom(0.83)} className="k-btn-ghost" style={{ width: 34, height: 34, padding: 0, justifyContent: 'center', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-sm)' }}><Icon name="menu" size={16} stroke={2} style={{ transform: 'scaleY(0.34)' }} /></button>
            <button onClick={() => fitTo(null)} className="k-btn-ghost" style={{ width: 34, height: 34, padding: 0, justifyContent: 'center', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-sm)' }} title="Fit to view"><Icon name="target" size={16} stroke={2} /></button>
          </div>
        )}

        {/* legend / filters */}
        {shownCount > 0 && (
          <div style={{ position: 'absolute', left: 16, top: 16, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
            <button onClick={() => setLegendOpen(o => !o)} className="k-btn-ghost" style={{ height: 34, padding: '0 12px', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-sm)', display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: legendOpen ? 'var(--accent)' : 'var(--text)', borderColor: legendOpen ? 'var(--accent)' : 'var(--border)' }}>
              <Icon name="filter" size={14} stroke={2} /> Legend &amp; filters
              {Object.values(hidden).some(Boolean) && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />}
              <Icon name={legendOpen ? 'chevronDown' : 'chevronRight'} size={13} stroke={2} style={{ color: 'var(--text-muted)' }} />
            </button>
            {legendOpen && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lg)', padding: '10px 12px', maxWidth: 210 }}>
                <div className="k-overline" style={{ marginBottom: 8, fontSize: 10 }}>Node types · click to filter</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {Object.keys(G_TYPES).map(k => { const t = G_TYPES[k]; return (
                    <button key={k} onClick={() => setHidden(h => ({ ...h, [k]: !h[k] }))} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 4px', borderRadius: 'var(--r-sm)', opacity: hidden[k] ? 0.4 : 1, textAlign: 'left' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: t.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: 'var(--text)', textDecoration: hidden[k] ? 'line-through' : 'none' }}>{t.label}</span>
                    </button>
                  ); })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* why card */}
        {result && showWhy && shownCount > 0 && (
          <div style={{ position: 'absolute', right: sel ? 388 : 16, bottom: 16, width: 336, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lg)', padding: '14px 16px', transition: 'right 200ms' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 26, height: 26, borderRadius: 'var(--r-md)', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="zap" size={14} stroke={2} /></div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Why these results</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {result.steps.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 9 }}>
                  <span className="mono" style={{ width: 18, height: 18, flexShrink: 0, borderRadius: '50%', background: 'var(--accent)', color: 'white', fontSize: 10.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>{i + 1}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* detail panel */}
        {sel && (() => {
          const tp = G_TYPES[sel.type];
          const groups = Object.entries(selGroups).sort((a, b) => G_TYPES[a[0]].layer - G_TYPES[b[0]].layer);
          const totalConns = groups.reduce((s, [, g]) => s + g.entries.length, 0);
          return (
            <div className="drawer-in" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 372, background: 'var(--surface)', borderLeft: '1px solid var(--border)', boxShadow: 'var(--shadow-xl)', display: 'flex', flexDirection: 'column', zIndex: 30 }}>
              <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 'var(--r-md)', background: tp.soft, color: tp.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name={tp.icon} size={19} stroke={2} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: tp.color }}>{tp.label}{sel.synthetic && ' · demo-scale'}</div>
                    <div className="mono" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', marginTop: 1 }}>{sel.code}</div>
                  </div>
                  <button onClick={() => setSelected(null)} className="k-btn-plain" style={{ padding: 6, borderRadius: 'var(--r-md)', display: 'flex' }}><Icon name="x" size={16} stroke={2} /></button>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, marginTop: 10 }}>{sel.title}</div>
                <div style={{ marginTop: 8 }}><StatusBadge status={sel.status} /></div>
              </div>

              <div className="k-scroll" style={{ flex: 1, padding: '16px 18px', minHeight: 0 }}>
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 16px' }}>{sel.summary}</p>
                <div className="k-overline" style={{ marginBottom: 8 }}>Details</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px', marginBottom: 20 }}>
                  {(sel.fields || []).map(([l, v], i) => (
                    <div key={i}><div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, color: 'var(--text-subtle)' }}>{l}</div><div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)', marginTop: 1 }}>{v}</div></div>
                  ))}
                </div>

                <div className="k-overline" style={{ marginBottom: 8 }}>Connections · {fmt(totalConns)}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {groups.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-subtle)' }}>No linked records.</div>}
                  {groups.map(([type, g]) => {
                    const ot = G_TYPES[type];
                    const onCanvas = g.entries.filter(e => visible.has(e.other)).length;
                    return (
                      <button key={type} onClick={() => { expandGroups(selected, type); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--surface)', textAlign: 'left', width: '100%' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-subtle)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = 'var(--border)'; }}>
                        <div style={{ width: 26, height: 26, borderRadius: 'var(--r-sm)', background: ot.soft, color: ot.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name={ot.icon} size={14} stroke={2} /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{ot.label}{g.entries.length !== 1 ? 's' : ''}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{onCanvas > 0 ? `${onCanvas} on graph · ` : ''}reveal on graph</div>
                        </div>
                        <span className="k-chip mono" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>{fmt(g.entries.length)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)' }}>
                {sel.synthetic ? (
                  <div style={{ fontSize: 11.5, color: 'var(--text-subtle)', textAlign: 'center', padding: '6px 0' }}>Demo-scale record — no detail page in this prototype.</div>
                ) : (
                  <button className="k-btn k-btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => openRecord(selected)}>Open full record <Icon name="arrowRight" size={15} stroke={2} /></button>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

if (typeof document !== 'undefined' && !document.getElementById('g-flow-style')) {
  const s = document.createElement('style'); s.id = 'g-flow-style'; s.textContent = '@keyframes g-flow { to { stroke-dashoffset: -13; } }'; document.head.appendChild(s);
}

Object.assign(window, { GraphExplorer });
