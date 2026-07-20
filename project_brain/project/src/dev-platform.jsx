// Kaenal — Developer Platform
// Public API docs (OpenAPI), Webhook event explorer + replay,
// OAuth app registration, Rate limit visibility, CLI/SDK landing, Sandbox tenant

function DevPlatformHub() {
  const [tab, setTab] = React.useState('overview');
  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'docs', label: 'API reference', icon: 'fileText' },
    { id: 'webhooks', label: 'Webhooks', icon: 'zap' },
    { id: 'oauth', label: 'OAuth apps', icon: 'key' },
    { id: 'limits', label: 'Rate limits & logs', icon: 'gauge' },
    { id: 'sandbox', label: 'Sandbox', icon: 'beaker' },
    { id: 'sdks', label: 'SDKs & CLI', icon: 'code' },
  ];
  return (
    <div>
      <PageHeader
        title="Developer Platform"
        description="Public REST + GraphQL API, real-time webhooks, OAuth, SDKs, and a sandboxed tenant — everything partners need to build on Kaenal."
        actions={
          <>
            <button className="k-btn k-btn-ghost" onClick={() => kToast('Opening developers.kaenal.app in a new tab')}><Icon name="external" size={13}/> developers.kaenal.app</button>
            <button className="k-btn k-btn-primary" onClick={() => kToast('API key created — kn_live_…4f2a copied to clipboard')}><Icon name="plus" size={13}/> New API key</button>
          </>
        }
      />
      <div style={{ padding: '20px 28px 0' }}>
        <div className="k-tabs">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`k-tab ${tab === t.id ? 'active' : ''}`}>
              <Icon name={t.icon} size={13}/> {t.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: '20px 28px 32px' }}>
        {tab === 'overview' && <DevOverview/>}
        {tab === 'docs' && <ApiReference/>}
        {tab === 'webhooks' && <WebhooksExplorer/>}
        {tab === 'oauth' && <OAuthApps/>}
        {tab === 'limits' && <RateLimits/>}
        {tab === 'sandbox' && <SandboxTenant/>}
        {tab === 'sdks' && <SDKsLanding/>}
      </div>
    </div>
  );
}

function DevOverview() {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
        {[
          { l: 'API calls (24h)', v: '184,247', s: '99.97% success', c: '#2563eb', i: 'zap' },
          { l: 'Active apps', v: '12', s: '8 internal · 4 partner', c: '#16a34a', i: 'package' },
          { l: 'Webhooks delivered (24h)', v: '8,412', s: '4 failing', c: '#7c3aed', i: 'send' },
          { l: 'P95 latency', v: '142ms', s: 'Target ≤ 200ms', c: '#0d9488', i: 'gauge' },
        ].map(k => (
          <div key={k.l} className="k-surface" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: k.c + '18', color: k.c, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={k.i} size={16}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{k.l}</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{k.v}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{k.s}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <Card title="Quickstart">
          <div style={{ padding: 14, background: 'var(--slate-900)', color: '#cbd5e1', borderRadius: 'var(--r-md)', fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: 1.7, overflow: 'auto' }}>
            <div style={{ color: '#94a3b8' }}># 1. Install</div>
            <div>$ pip install kaenal</div>
            <div style={{ marginTop: 10, color: '#94a3b8' }}># 2. Auth</div>
            <div>$ export KAENAL_API_KEY=<span style={{ color: '#fbbf24' }}>kn_sk_••••••</span></div>
            <div style={{ marginTop: 10, color: '#94a3b8' }}># 3. Create your first NCR</div>
            <div><span style={{ color: '#a78bfa' }}>from</span> kaenal <span style={{ color: '#a78bfa' }}>import</span> Kaenal</div>
            <div>client = Kaenal()</div>
            <div></div>
            <div>ncr = client.ncr.create(</div>
            <div>{'  '}title=<span style={{ color: '#bef264' }}>"Weld porosity on Line 4"</span>,</div>
            <div>{'  '}severity=<span style={{ color: '#bef264' }}>"high"</span>,</div>
            <div>{'  '}area=<span style={{ color: '#bef264' }}>"pune-1/weld-4"</span>,</div>
            <div>)</div>
            <div></div>
            <div><span style={{ color: '#a78bfa' }}>print</span>(ncr.id)  <span style={{ color: '#94a3b8' }}># → NCR-2026-0143</span></div>
          </div>
        </Card>

        <Card title="Resources">
          {[
            { l: 'API Reference', s: '184 endpoints · OpenAPI 3.1', i: 'fileText' },
            { l: 'Webhook events catalog', s: '46 event types', i: 'zap' },
            { l: 'Python SDK', s: 'v2.4.0 · 12 days ago', i: 'package' },
            { l: 'TypeScript SDK', s: 'v1.8.2 · 4 days ago', i: 'package' },
            { l: 'CLI', s: 'kaenal v3.1.0', i: 'terminal' },
            { l: 'Postman collection', s: '1.4M downloads', i: 'send' },
            { l: 'Status page', s: 'All systems normal', i: 'gauge' },
          ].map(r => (
            <a key={r.l} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 4px', borderBottom: '1px solid var(--border)', fontSize: 13, cursor: 'pointer' }}>
              <Icon name={r.i} size={14} style={{ color: 'var(--text-muted)' }}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{r.l}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.s}</div>
              </div>
              <Icon name="arrowRight" size={12} style={{ color: 'var(--text-subtle)' }}/>
            </a>
          ))}
        </Card>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// API Reference (OpenAPI explorer)
// ─────────────────────────────────────────────────────────────
const API_GROUPS = [
  { tag: 'Inspections', count: 18, endpoints: [
    { m: 'GET', p: '/v1/inspections', d: 'List inspections', sel: false },
    { m: 'POST', p: '/v1/inspections', d: 'Create an inspection', sel: false },
    { m: 'GET', p: '/v1/inspections/{id}', d: 'Retrieve an inspection', sel: true },
    { m: 'PATCH', p: '/v1/inspections/{id}', d: 'Update an inspection', sel: false },
    { m: 'DELETE', p: '/v1/inspections/{id}', d: 'Delete an inspection', sel: false },
    { m: 'POST', p: '/v1/inspections/{id}/responses', d: 'Submit responses', sel: false },
    { m: 'POST', p: '/v1/inspections/{id}/photos', d: 'Attach a photo', sel: false },
  ]},
  { tag: 'Non-Conformities (NCR)', count: 12, endpoints: [
    { m: 'GET', p: '/v1/ncrs', d: 'List NCRs' },
    { m: 'POST', p: '/v1/ncrs', d: 'Create an NCR' },
    { m: 'GET', p: '/v1/ncrs/{id}', d: 'Retrieve an NCR' },
    { m: 'POST', p: '/v1/ncrs/{id}/disposition', d: 'Set disposition' },
    { m: 'POST', p: '/v1/ncrs/{id}/close', d: 'Close an NCR' },
  ]},
  { tag: '8D Reports', count: 14, endpoints: [] },
  { tag: 'Audits', count: 8, endpoints: [] },
  { tag: 'CAPA', count: 9, endpoints: [] },
  { tag: 'Documents', count: 15, endpoints: [] },
  { tag: 'Suppliers', count: 11, endpoints: [] },
  { tag: 'Reports', count: 7, endpoints: [] },
  { tag: 'Webhooks', count: 5, endpoints: [] },
  { tag: 'Users & roles', count: 18, endpoints: [] },
];

function ApiReference() {
  const [openGroup, setOpenGroup] = React.useState('Inspections');
  const selected = API_GROUPS.find(g => g.tag === openGroup)?.endpoints.find(e => e.sel) || API_GROUPS[0].endpoints[2];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 1fr', gap: 16, height: 720 }}>
      {/* Left: endpoint tree */}
      <div className="k-surface" style={{ overflowY: 'auto' }}>
        <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
          <input className="k-input" placeholder="Search endpoints…" style={{ height: 32, fontSize: 12 }}/>
        </div>
        <div style={{ padding: 4 }}>
          {API_GROUPS.map(g => (
            <div key={g.tag}>
              <button onClick={() => setOpenGroup(openGroup === g.tag ? null : g.tag)} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '8px 10px', borderRadius: 4, fontSize: 12.5, fontWeight: 600,
                background: openGroup === g.tag ? 'var(--accent-soft)' : 'transparent',
                color: openGroup === g.tag ? 'var(--accent)' : 'var(--text)',
              }}>
                <Icon name={openGroup === g.tag ? 'arrowDown' : 'arrowRight'} size={11}/>
                <span style={{ flex: 1, textAlign: 'left' }}>{g.tag}</span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{g.count}</span>
              </button>
              {openGroup === g.tag && g.endpoints.map(e => (
                <button key={e.p + e.m} style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                  padding: '5px 10px 5px 26px', borderRadius: 4,
                  background: e.sel ? 'var(--bg-subtle)' : 'transparent',
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                }}>
                  <MethodBadge m={e.m}/>
                  <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{e.p}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Middle: endpoint detail */}
      <div className="k-surface" style={{ overflowY: 'auto', padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <MethodBadge m="GET" size="lg"/>
          <span className="mono" style={{ fontSize: 14, fontWeight: 600 }}>/v1/inspections/{'{id}'}</span>
        </div>
        <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 4 }}>Retrieve an inspection</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>
          Returns a single inspection record by ID, including responses, photos, signatures, and any linked NCRs.
        </div>

        <div className="k-overline" style={{ marginBottom: 8 }}>Path parameters</div>
        <ParamTable params={[
          { n: 'id', t: 'string', r: true, d: 'The inspection ID. Format: INS-YYYY-NNNN' },
        ]}/>

        <div className="k-overline" style={{ marginBottom: 8, marginTop: 18 }}>Query parameters</div>
        <ParamTable params={[
          { n: 'expand[]', t: 'string', r: false, d: 'Expand related: responses, photos, signatures, linked_ncr, area, template' },
          { n: 'include_archived', t: 'boolean', r: false, d: 'Include archived records. Default: false' },
        ]}/>

        <div className="k-overline" style={{ marginBottom: 8, marginTop: 18 }}>Response — 200</div>
        <div style={{ padding: 12, background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)', fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.6, whiteSpace: 'pre' }}>
{`{
  "id": "INS-2026-0342",
  "object": "inspection",
  "created": 1747641600,
  "title": "First-article Volvo bracket VBR-3041",
  "status": "completed",
  "area": { "id": "pune-1/weld-4", "object": "area" },
  "template": "iatf-first-article-v2",
  "result": "pass",
  "operator": { "id": "u-sarah", "object": "user" },
  "responses_count": 47,
  "linked_ncr": null
}`}
        </div>

        <div className="k-overline" style={{ marginBottom: 8, marginTop: 18 }}>Errors</div>
        <ParamTable params={[
          { n: '404 not_found', t: 'error', r: false, d: 'Inspection with given ID does not exist or is not visible to your token' },
          { n: '403 forbidden', t: 'error', r: false, d: 'Token scope insufficient — needs inspections:read' },
        ]}/>
      </div>

      {/* Right: request/response */}
      <div className="k-surface" style={{ overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <Segmented size="sm" value="curl" onChange={() => {}} options={[
            { value: 'curl', label: 'cURL' },
            { value: 'py', label: 'Python' },
            { value: 'ts', label: 'TypeScript' },
            { value: 'go', label: 'Go' },
          ]}/>
        </div>

        <div style={{ padding: 12, background: 'var(--slate-900)', color: '#cbd5e1', borderRadius: 'var(--r-md)', fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.6, position: 'relative' }}>
          <button style={{ position: 'absolute', top: 8, right: 8, padding: '4px 10px', background: 'rgba(255,255,255,0.08)', color: '#cbd5e1', borderRadius: 4, fontSize: 11 }}>
            <Icon name="copy" size={11}/> Copy
          </button>
          <div><span style={{ color: '#fbbf24' }}>curl</span> https://api.kaenal.app/v1/inspections/INS-2026-0342 \</div>
          <div>{'  '}-H <span style={{ color: '#bef264' }}>"Authorization: Bearer $KAENAL_API_KEY"</span></div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="k-btn k-btn-primary" style={{ flex: 1 }}><Icon name="play" size={12}/> Try it (sandbox)</button>
          <button className="k-btn k-btn-ghost"><Icon name="external" size={12}/></button>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span className="k-chip" style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}>200 OK</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· 142ms · 1.2 KB</span>
          </div>
          <div style={{ padding: 12, background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)', fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.55, whiteSpace: 'pre', maxHeight: 240, overflow: 'auto' }}>
{`{
  "id": "INS-2026-0342",
  "object": "inspection",
  "title": "First-article Volvo bracket VBR-3041",
  "status": "completed",
  "result": "pass",
  "operator": "u-sarah",
  ...
}`}
          </div>
        </div>

        <div className="k-overline">Rate limits</div>
        <div style={{ padding: 10, background: 'var(--bg-subtle)', borderRadius: 6, fontSize: 11.5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Burst:</span>
            <span className="mono">200 / 10s</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Sustained:</span>
            <span className="mono">5,000 / min</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MethodBadge({ m, size = 'md' }) {
  const map = { GET: '#16a34a', POST: '#2563eb', PATCH: '#f59e0b', PUT: '#f59e0b', DELETE: '#dc2626' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: size === 'lg' ? '4px 10px' : '2px 6px',
      borderRadius: 4, background: map[m] + '18', color: map[m],
      fontFamily: 'var(--font-mono)', fontSize: size === 'lg' ? 11 : 9, fontWeight: 800, letterSpacing: '0.04em',
      minWidth: size === 'lg' ? 56 : 38, textAlign: 'center',
    }}>{m}</span>
  );
}

function ParamTable({ params }) {
  return (
    <table style={{ width: '100%', fontSize: 12 }}>
      <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
        <th style={{ textAlign: 'left', padding: '6px 0', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Name</th>
        <th style={{ textAlign: 'left', padding: '6px 0', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Type</th>
        <th style={{ textAlign: 'left', padding: '6px 0', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Description</th>
      </tr></thead>
      <tbody>
        {params.map(p => (
          <tr key={p.n} style={{ borderBottom: '1px solid var(--border)' }}>
            <td style={{ padding: '8px 8px 8px 0', verticalAlign: 'top' }}>
              <span className="mono" style={{ fontWeight: 600, fontSize: 12 }}>{p.n}</span>
              {p.r && <div style={{ fontSize: 9.5, color: '#b91c1c', fontWeight: 700, marginTop: 2 }}>REQUIRED</div>}
            </td>
            <td style={{ padding: '8px 8px 8px 0', verticalAlign: 'top' }} className="mono"><span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{p.t}</span></td>
            <td style={{ padding: '8px 0', verticalAlign: 'top', color: 'var(--text)' }}>{p.d}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─────────────────────────────────────────────────────────────
// Webhooks explorer + replay
// ─────────────────────────────────────────────────────────────
const WEBHOOK_EVENTS = [
  { t: '14:22:08', ev: 'ncr.created', url: 'https://hooks.precision-auto.com/kaenal/ncr', status: 200, attempts: 1, latency: 84, payload: { id: 'NCR-2026-0142', severity: 'high', area: 'pune-1/weld-4' } },
  { t: '14:21:54', ev: 'inspection.completed', url: 'https://hooks.precision-auto.com/kaenal/insp', status: 200, attempts: 1, latency: 124, payload: { id: 'INS-2026-0342', result: 'pass' } },
  { t: '14:18:42', ev: 'spc.out_of_control', url: 'https://internal.precision-auto.com/api/spc', status: 200, attempts: 1, latency: 184, payload: { line: 'weld-4', characteristic: 'penetration_mm', signal: 'WE-1' } },
  { t: '14:14:18', ev: 'audit.evidence_uploaded', url: 'https://siem.precision-auto.com/kaenal-audit', status: 503, attempts: 6, latency: 30000, payload: { audit: 'AUD-2026-0021' }, failing: true },
  { t: '14:08:42', ev: 'ncr.disposition_changed', url: 'https://hooks.precision-auto.com/kaenal/ncr', status: 200, attempts: 1, latency: 92, payload: {} },
  { t: '14:04:18', ev: 'document.approved', url: 'https://sharepoint.precision-auto.com/api/kaenal', status: 200, attempts: 1, latency: 248, payload: {} },
  { t: '13:58:02', ev: 'capa.completed', url: 'https://hooks.precision-auto.com/kaenal/capa', status: 200, attempts: 1, latency: 104, payload: {} },
  { t: '13:42:14', ev: 'audit.finding_created', url: 'https://siem.precision-auto.com/kaenal-audit', status: 503, attempts: 6, latency: 30000, payload: {}, failing: true },
  { t: '13:28:08', ev: '8d.phase_advanced', url: 'https://hooks.precision-auto.com/kaenal/8d', status: 200, attempts: 1, latency: 112, payload: {} },
  { t: '13:12:42', ev: 'inspection.failed', url: 'https://hooks.precision-auto.com/kaenal/insp', status: 200, attempts: 2, latency: 1840, payload: {} },
];

const WEBHOOK_ENDPOINTS = [
  { url: 'https://hooks.precision-auto.com/kaenal/ncr', events: ['ncr.*'], health: 'healthy', delivered24h: 412, fail24h: 0, p95: 124 },
  { url: 'https://hooks.precision-auto.com/kaenal/insp', events: ['inspection.*'], health: 'healthy', delivered24h: 1840, fail24h: 2, p95: 184 },
  { url: 'https://internal.precision-auto.com/api/spc', events: ['spc.*', 'inspection.failed'], health: 'healthy', delivered24h: 84, fail24h: 0, p95: 192 },
  { url: 'https://siem.precision-auto.com/kaenal-audit', events: ['audit.*'], health: 'failing', delivered24h: 0, fail24h: 47, p95: 30000 },
  { url: 'https://hooks.precision-auto.com/kaenal/capa', events: ['capa.*'], health: 'healthy', delivered24h: 84, fail24h: 0, p95: 108 },
  { url: 'https://sharepoint.precision-auto.com/api/kaenal', events: ['document.*'], health: 'healthy', delivered24h: 312, fail24h: 4, p95: 247 },
];

function WebhooksExplorer() {
  const [sel, setSel] = React.useState(3); // selected event
  const [endpointTab, setEndpointTab] = React.useState('feed');
  const ev = WEBHOOK_EVENTS[sel];

  return (
    <>
      <Card title="Endpoints" desc={`${WEBHOOK_ENDPOINTS.length} configured · 1 failing`}
        footer={<button className="k-btn k-btn-primary"><Icon name="plus" size={13}/> Add endpoint</button>}>
        <table className="k-table" style={{ width: '100%' }}>
          <thead><tr><th>URL</th><th>Events</th><th>Health</th><th>Delivered 24h</th><th>Failed</th><th>P95</th><th></th></tr></thead>
          <tbody>
            {WEBHOOK_ENDPOINTS.map(e => (
              <tr key={e.url}>
                <td className="mono" style={{ fontSize: 11.5 }}>{e.url}</td>
                <td>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {e.events.map(x => <span key={x} className="k-chip mono" style={{ background: 'var(--bg-subtle)', fontSize: 10 }}>{x}</span>)}
                  </div>
                </td>
                <td>
                  {e.health === 'healthy'
                    ? <span className="k-chip" style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}><span className="pulse-dot"/> Healthy</span>
                    : <span className="k-chip" style={{ background: 'rgba(220,38,38,0.10)', color: '#b91c1c' }}><Icon name="alert" size={10}/> Failing</span>
                  }
                </td>
                <td className="mono">{e.delivered24h}</td>
                <td className="mono" style={{ color: e.fail24h > 0 ? '#dc2626' : 'var(--text)' }}>{e.fail24h}</td>
                <td className="mono">{e.p95 >= 1000 ? `${(e.p95/1000).toFixed(1)}s` : `${e.p95}ms`}</td>
                <td>
                  <button className="k-btn-plain" style={{ padding: 6 }}><Icon name="more" size={13}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Event explorer" desc="Click any event to inspect payload, headers, and replay">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 12, height: 540 }}>
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflowY: 'auto' }}>
            <div style={{ padding: 8, borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)', display: 'flex', gap: 6 }}>
              <input className="k-input" placeholder="Filter events…" style={{ height: 28, fontSize: 11 }}/>
              <select className="k-input" defaultValue="all" style={{ height: 28, fontSize: 11, width: 110 }}><option>All status</option></select>
            </div>
            {WEBHOOK_EVENTS.map((e, i) => (
              <button key={i} onClick={() => setSel(i)} style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 12px',
                borderBottom: '1px solid var(--border)',
                background: sel === i ? 'var(--accent-soft)' : 'transparent',
                borderLeft: sel === i ? '3px solid var(--accent)' : '3px solid transparent',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{e.t}</span>
                  <span className="k-chip mono" style={{
                    background: e.status === 200 ? 'var(--success-100)' : 'rgba(220,38,38,0.10)',
                    color: e.status === 200 ? 'var(--success-700)' : '#b91c1c',
                    fontSize: 10,
                  }}>{e.status}</span>
                  {e.attempts > 1 && <span style={{ fontSize: 10, color: e.failing ? '#dc2626' : '#f59e0b' }}>⟳ {e.attempts}</span>}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600 }} className="mono">{e.ev}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.url}</div>
              </button>
            ))}
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflowY: 'auto', padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{ev.ev}</span>
              <span className="k-chip mono" style={{ background: ev.status === 200 ? 'var(--success-100)' : 'rgba(220,38,38,0.10)', color: ev.status === 200 ? 'var(--success-700)' : '#b91c1c' }}>{ev.status}</span>
              {ev.failing && <span className="k-chip" style={{ background: 'rgba(220,38,38,0.10)', color: '#b91c1c' }}>{ev.attempts} attempts</span>}
              <button className="k-btn k-btn-primary k-btn-sm" style={{ marginLeft: 'auto' }}><Icon name="refresh" size={11}/> Replay</button>
              <button className="k-btn k-btn-secondary k-btn-sm"><Icon name="external" size={11}/> Send to test</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 14 }}>
              <Detail2 k="Event ID" v="evt_8a7b2c93d4e5f6a7"/>
              <Detail2 k="Delivered" v={ev.t}/>
              <Detail2 k="Latency" v={ev.latency >= 1000 ? `${(ev.latency/1000).toFixed(1)}s` : `${ev.latency}ms`}/>
              <Detail2 k="Attempts" v={ev.attempts}/>
            </div>

            <div className="k-overline" style={{ marginBottom: 6 }}>Request headers</div>
            <div style={{ padding: 10, background: 'var(--bg-subtle)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.6, marginBottom: 12 }}>
              <div>POST {ev.url}</div>
              <div>Content-Type: application/json</div>
              <div>X-Kaenal-Signature: t=1747641600,v1=8a7b2c93...</div>
              <div>X-Kaenal-Event-Id: evt_8a7b2c93</div>
              <div>X-Kaenal-Attempt: {ev.attempts}</div>
              <div>User-Agent: Kaenal-Webhooks/2.0</div>
            </div>

            <div className="k-overline" style={{ marginBottom: 6 }}>Payload</div>
            <div style={{ padding: 10, background: 'var(--bg-subtle)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.6, marginBottom: 12, whiteSpace: 'pre', overflow: 'auto' }}>
{`{
  "id": "evt_8a7b2c93",
  "object": "event",
  "type": "${ev.ev}",
  "created": 1747641600,
  "data": ${JSON.stringify(ev.payload, null, 2).replace(/\n/g, '\n  ')}
}`}
            </div>

            <div className="k-overline" style={{ marginBottom: 6 }}>Response</div>
            <div style={{ padding: 10, background: 'var(--bg-subtle)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.6 }}>
              {ev.status === 200
                ? <><div>HTTP/1.1 200 OK</div><div>Content-Type: application/json</div><div></div><div>{'{"ok": true}'}</div></>
                : <><div>HTTP/1.1 503 Service Unavailable</div><div>X-Backoff: 60</div><div></div><div style={{ color: '#dc2626' }}>{'{"error": "upstream timeout"}'}</div></>}
            </div>

            {ev.failing && (
              <div style={{ marginTop: 14, padding: 10, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, fontSize: 11.5 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Delivery failed after 6 attempts</div>
                <div style={{ color: 'var(--text-muted)' }}>Backoff schedule: 30s, 1m, 5m, 30m, 2h, 12h. Will retry up to 14 attempts over 7 days. Configure dead-letter destination in endpoint settings.</div>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card title="Event catalog" desc="46 event types organized by domain. Subscribe with glob patterns like ncr.*">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {[
            { domain: 'ncr.*', events: ['created', 'updated', 'closed', 'reopened', 'disposition_changed', 'overdue', 'critical_opened'], color: '#dc2626' },
            { domain: '8d.*', events: ['created', 'phase_advanced', 'completed', 'rejected'], color: '#7c3aed' },
            { domain: 'inspection.*', events: ['created', 'completed', 'failed', 'response_submitted'], color: '#2563eb' },
            { domain: 'audit.*', events: ['scheduled', 'started', 'finding_created', 'evidence_uploaded', 'closed', 'report_published'], color: '#0d9488' },
            { domain: 'capa.*', events: ['created', 'completed', 'overdue', 'effectiveness_verified'], color: '#f59e0b' },
            { domain: 'document.*', events: ['uploaded', 'approved', 'rejected', 'expiring', 'archived'], color: '#16a34a' },
            { domain: 'spc.*', events: ['out_of_control', 'rule_violation', 'limit_changed'], color: '#ea580c' },
            { domain: 'supplier.*', events: ['scorecard_updated', 'risk_changed', 'ppap_submitted'], color: '#475569' },
          ].map(d => (
            <div key={d.domain} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
              <div className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: d.color, marginBottom: 8 }}>{d.domain}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {d.events.map(e => <span key={e} className="k-chip mono" style={{ background: 'var(--bg-subtle)', fontSize: 10 }}>{e}</span>)}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function Detail2({ k, v }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{k}</div>
      <div className="mono" style={{ fontSize: 12, fontWeight: 500 }}>{v}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// OAuth apps
// ─────────────────────────────────────────────────────────────
const OAUTH_APPS = [
  { id: 'app_1', name: 'Volvo Quality Portal', org: 'AB Volvo · Customer', users: 12, installs: 1, status: 'active', scopes: ['ncr:read', '8d:read'], lastUsed: 'Now', logo: 'V', color: '#003c64' },
  { id: 'app_2', name: 'Bosch APQP Bridge', org: 'Robert Bosch · Customer', users: 24, installs: 2, status: 'active', scopes: ['inspections:read', 'documents:read'], lastUsed: '6h ago', logo: 'B', color: '#cc0000' },
  { id: 'app_3', name: 'Acme MES Connector', org: 'Acme Industries · Partner', users: 142, installs: 47, status: 'published', scopes: ['inspections:write', 'ncr:write'], lastUsed: '12 min ago', logo: 'A', color: '#0d9488' },
  { id: 'app_4', name: 'Calibration Cloud', org: 'CalLabs · Partner', users: 8, installs: 4, status: 'active', scopes: ['documents:write'], lastUsed: 'Yesterday', logo: 'C', color: '#f59e0b' },
  { id: 'app_5', name: 'PaperLess Audit', org: 'Internal — AppSec dev', users: 2, installs: 1, status: 'sandbox', scopes: ['audit:read', 'audit:write'], lastUsed: '3 days ago', logo: 'P', color: '#7c3aed' },
];

function OAuthApps() {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
        {[
          { l: 'OAuth apps', v: '12', s: 'across 4 categories' },
          { l: 'Active installs', v: '184', s: 'across all tenants' },
          { l: 'API calls (24h)', v: '47.2K', s: 'OAuth-backed' },
          { l: 'In sandbox', v: '6', s: 'awaiting review' },
        ].map(k => (
          <div key={k.l} className="k-surface" style={{ padding: 14 }}>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{k.l}</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{k.v}</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{k.s}</div>
          </div>
        ))}
      </div>

      <Card title="Registered OAuth applications" desc="Apps that authenticate via OAuth 2.0 + PKCE on behalf of users"
        footer={<button className="k-btn k-btn-primary"><Icon name="plus" size={13}/> Register new app</button>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {OAUTH_APPS.map(a => (
            <div key={a.id} style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 8, background: a.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18 }}>
                {a.logo}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{a.name}</span>
                  {a.status === 'sandbox' && <span className="k-chip" style={{ background: 'rgba(245,158,11,0.12)', color: '#92400e' }}>Sandbox</span>}
                  {a.status === 'published' && <span className="k-chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>Marketplace</span>}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{a.org}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  {a.scopes.map(s => <span key={s} className="k-chip mono" style={{ background: 'var(--bg-subtle)', fontSize: 10 }}>{s}</span>)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 24, fontSize: 12 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>USERS</div>
                  <div style={{ fontWeight: 700 }}>{a.users}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>INSTALLS</div>
                  <div style={{ fontWeight: 700 }}>{a.installs}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>LAST USED</div>
                  <div style={{ fontWeight: 500 }}>{a.lastUsed}</div>
                </div>
              </div>
              <button className="k-btn k-btn-secondary k-btn-sm">Manage</button>
            </div>
          ))}
        </div>
      </Card>

      <Card title="OAuth configuration" desc="Settings for the platform-level OAuth server">
        <Row label="Authorization URL"><div className="mono" style={{ padding: '8px 10px', background: 'var(--bg-subtle)', borderRadius: 4, fontSize: 12 }}>https://auth.kaenal.app/oauth/authorize</div></Row>
        <Row label="Token URL"><div className="mono" style={{ padding: '8px 10px', background: 'var(--bg-subtle)', borderRadius: 4, fontSize: 12 }}>https://auth.kaenal.app/oauth/token</div></Row>
        <Row label="PKCE required"><Toggle on={true}/></Row>
        <Row label="Refresh tokens enabled" hint="Issue rotating refresh tokens. 90-day inactivity expiry."><Toggle on={true}/></Row>
        <Row label="Max access token lifetime"><Segmented value="1h" onChange={() => {}} options={[
          { value: '15m', label: '15 min' }, { value: '1h', label: '1 hour' }, { value: '8h', label: '8 hours' }, { value: '24h', label: '24 hours' },
        ]}/></Row>
      </Card>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Rate limits + logs/debug console
// ─────────────────────────────────────────────────────────────
function RateLimits() {
  return (
    <>
      <Card title="Your rate limits (Enterprise plan)" desc="Soft limits = warning at 80%. Hard limits = 429 Too Many Requests.">
        <table className="k-table" style={{ width: '100%' }}>
          <thead><tr><th>Resource</th><th>Burst</th><th>Sustained</th><th>Current</th><th>Window</th></tr></thead>
          <tbody>
            {[
              { r: 'All endpoints (default)', b: '200/10s', s: '5,000/min', cur: 42, max: 5000 },
              { r: 'GET /v1/inspections', b: '400/10s', s: '10,000/min', cur: 1840, max: 10000 },
              { r: 'POST writes', b: '40/10s', s: '1,000/min', cur: 84, max: 1000 },
              { r: 'AI endpoints', b: '20/min', s: '300/min', cur: 14, max: 300 },
              { r: 'Bulk export', b: '4/hour', s: '12/day', cur: 2, max: 12 },
            ].map(r => (
              <tr key={r.r}>
                <td style={{ fontSize: 13, fontWeight: 500 }}>{r.r}</td>
                <td className="mono">{r.b}</td>
                <td className="mono">{r.s}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 100, height: 5, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min((r.cur / r.max) * 100, 100)}%`, height: '100%', background: (r.cur / r.max) > 0.8 ? '#f59e0b' : '#22c55e' }}/>
                    </div>
                    <span className="mono" style={{ fontSize: 11 }}>{r.cur.toLocaleString()}</span>
                  </div>
                </td>
                <td className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>last min</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Debug console" desc="Live API call log for keys you control. Includes request, response, and timing.">
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input className="k-input" placeholder="Filter by path, status, key…" style={{ flex: 1 }}/>
          <Segmented size="sm" value="all" onChange={() => {}} options={[
            { value: 'all', label: 'All' }, { value: '4xx', label: '4xx' }, { value: '5xx', label: '5xx' }, { value: 'slow', label: 'Slow (>1s)' },
          ]}/>
          <button className="k-btn k-btn-ghost"><Icon name="download" size={12}/> Export</button>
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden', background: 'var(--slate-900)' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--slate-700)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--slate-800)' }}>
            <span className="pulse-dot"/>
            <span style={{ fontSize: 11.5, color: '#cbd5e1', fontWeight: 600 }}>Live · 184 req/sec</span>
            <span style={{ marginLeft: 'auto', fontSize: 10.5, color: '#64748b' }} className="mono">tailing prod</span>
          </div>
          <div style={{ padding: '4px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#cbd5e1', maxHeight: 360, overflow: 'auto' }}>
            {[
              { t: '14:22:08.422', m: 'GET', p: '/v1/inspections/INS-2026-0342', s: 200, ms: 84, k: 'kn_sk…a3f9' },
              { t: '14:22:08.118', m: 'POST', p: '/v1/ncrs', s: 201, ms: 142, k: 'kn_sk…a3f9' },
              { t: '14:22:07.984', m: 'GET', p: '/v1/audits/AUD-2026-0021/evidence', s: 200, ms: 247, k: 'kn_sk…72c1' },
              { t: '14:22:07.642', m: 'PATCH', p: '/v1/ncrs/NCR-2026-0142', s: 200, ms: 92, k: 'kn_sk…a3f9' },
              { t: '14:22:07.418', m: 'GET', p: '/v1/inspections', s: 200, ms: 184, k: 'kn_sk…0e88' },
              { t: '14:22:07.284', m: 'POST', p: '/v1/ai/root-cause', s: 200, ms: 1842, k: 'kn_sk…a3f9' },
              { t: '14:22:07.012', m: 'GET', p: '/v1/inspections/INS-2026-0341', s: 200, ms: 64, k: 'kn_sk…0e88' },
              { t: '14:22:06.842', m: 'POST', p: '/v1/documents/upload', s: 413, ms: 12, k: 'kn_sk…a3f9', err: 'payload_too_large' },
              { t: '14:22:06.612', m: 'GET', p: '/v1/reports/r1', s: 200, ms: 312, k: 'kn_sk…72c1' },
              { t: '14:22:06.448', m: 'POST', p: '/v1/8d/8D-2026-0015/phases', s: 200, ms: 124, k: 'kn_sk…a3f9' },
              { t: '14:22:06.184', m: 'GET', p: '/v1/audits', s: 429, ms: 4, k: 'kn_sk…0e88', err: 'rate_limited' },
              { t: '14:22:05.948', m: 'POST', p: '/v1/ai/disposition', s: 200, ms: 2014, k: 'kn_sk…a3f9' },
              { t: '14:22:05.748', m: 'GET', p: '/v1/users/me', s: 200, ms: 18, k: 'kn_sk…72c1' },
            ].map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '3px 0', borderBottom: '1px solid #1e2a44', alignItems: 'center' }}>
                <span style={{ color: '#64748b', minWidth: 108 }}>{l.t}</span>
                <span style={{ minWidth: 56, color: l.m === 'GET' ? '#22c55e' : l.m === 'POST' ? '#3b82f6' : '#f59e0b', fontWeight: 700 }}>{l.m}</span>
                <span style={{ flex: 1, color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.p}</span>
                <span style={{ minWidth: 36, color: l.s >= 500 ? '#f87171' : l.s >= 400 ? '#fbbf24' : '#22c55e', fontWeight: 700 }}>{l.s}</span>
                <span style={{ minWidth: 60, textAlign: 'right', color: l.ms > 1000 ? '#fbbf24' : '#94a3b8' }}>{l.ms}ms</span>
                <span style={{ minWidth: 84, color: '#64748b' }}>{l.k}</span>
                {l.err && <span style={{ color: '#f87171' }}>· {l.err}</span>}
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card title="Quota & overage">
        <Row label="Plan limit" hint="Sustained calls per month"><span className="mono" style={{ fontWeight: 600 }}>2,000,000 / month</span></Row>
        <Row label="MTD usage">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="mono" style={{ fontSize: 16, fontWeight: 700 }}>847,402</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>42% — projected month-end 1.32M</span>
            <div style={{ width: 200, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: '42%', height: '100%', background: '#22c55e' }}/>
            </div>
          </div>
        </Row>
        <Row label="Overage policy"><Segmented value="bill" onChange={() => {}} options={[
          { value: 'bill', label: 'Bill overage ($0.10/1k)' },
          { value: 'block', label: 'Block at limit (429)' },
        ]}/></Row>
      </Card>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Sandbox tenant
// ─────────────────────────────────────────────────────────────
function SandboxTenant() {
  return (
    <>
      <div style={{
        padding: 20, marginBottom: 18,
        background: 'linear-gradient(135deg, #0f766e, #1e3a8a)',
        color: 'white', borderRadius: 'var(--r-lg)',
        display: 'flex', alignItems: 'center', gap: 18,
      }}>
        <div style={{ width: 56, height: 56, borderRadius: 12, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="beaker" size={26}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 19, fontWeight: 700 }}>Sandbox tenant — precision-auto-sbx</div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4, maxWidth: 540 }}>
            Isolated copy of your workspace, seeded with realistic test data. No real customers receive emails or webhooks. Refresh from prod anytime.
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <button className="k-btn" style={{ background: 'white', color: '#0f766e' }}><Icon name="external" size={13}/> Open sandbox</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
        {[
          { l: 'Test inspections', v: '1,247', i: 'clipboard' },
          { l: 'Test NCRs', v: '432', i: 'alert' },
          { l: 'Test users', v: '47', i: 'users' },
          { l: 'Test API keys', v: '8', i: 'key' },
        ].map(s => (
          <div key={s.l} className="k-surface" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--bg-subtle)' }}/>
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{s.l}</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{s.v}</div>
            </div>
          </div>
        ))}
      </div>

      <Card title="Test data" desc="Seeded synthetic data for predictable integration testing">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { d: 'Realistic NCRs across 7 standard scenarios', t: 'NCR-SBX-0001 … 0432', a: 'Auto-seeded' },
            { d: 'Predictable IDs for assertion in tests', t: 'INS-SBX-{template_id}-{n}', a: 'Stable' },
            { d: 'Failing-state samples', t: 'spc-out-of-control, overdue, escalated', a: 'On-demand' },
            { d: '4 supplier orgs with PPAP & scorecards', t: 'SUP-SBX-001 … 004', a: 'Auto-seeded' },
            { d: '12 controlled documents at various lifecycle states', t: 'D-SBX-001 … 012', a: 'Auto-seeded' },
          ].map(r => (
            <div key={r.t} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)' }}>
              <Icon name="beaker" size={14} style={{ color: 'var(--accent)' }}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>{r.d}</div>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{r.t}</div>
              </div>
              <span className="k-chip" style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}>{r.a}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Operations">
        <Row label="Refresh sandbox from production" hint="Replaces all sandbox data with a sanitized snapshot of production (PII stripped)">
          <button className="k-btn k-btn-secondary"><Icon name="refresh" size={13}/> Refresh now (last refreshed 6 days ago)</button>
        </Row>
        <Row label="Reset to baseline" hint="Wipe everything and re-seed with synthetic fixtures">
          <button className="k-btn k-btn-secondary" style={{ color: '#dc2626' }}><Icon name="refresh" size={13}/> Reset</button>
        </Row>
        <Row label="Webhook delivery"><Segmented value="capture" onChange={() => {}} options={[
          { value: 'live', label: 'Send to real URL' },
          { value: 'capture', label: 'Capture & display only' },
        ]}/></Row>
        <Row label="Email sending"><Segmented value="capture" onChange={() => {}} options={[
          { value: 'live', label: 'Send to real address' },
          { value: 'capture', label: 'Capture in inbox UI' },
        ]}/></Row>
      </Card>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// SDKs + CLI landing
// ─────────────────────────────────────────────────────────────
function SDKsLanding() {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
        {[
          { lang: 'Python', v: 'v2.4.0', release: '12 days ago', install: 'pip install kaenal', color: '#3776ab' },
          { lang: 'TypeScript / JS', v: 'v1.8.2', release: '4 days ago', install: 'npm install @kaenal/sdk', color: '#3178c6' },
          { lang: 'Go', v: 'v1.2.0', release: '1 month ago', install: 'go get github.com/kaenal/kaenal-go', color: '#00add8' },
          { lang: 'Java', v: 'v0.9.0-beta', release: '3 weeks ago', install: 'Maven Central: app.kaenal:sdk', color: '#cc6608' },
          { lang: 'Ruby', v: 'v1.0.4', release: '2 months ago', install: 'gem install kaenal', color: '#cc342d' },
          { lang: 'CLI (kaenal)', v: 'v3.1.0', release: '8 days ago', install: 'brew install kaenal', color: '#0d9488' },
        ].map(s => (
          <div key={s.lang} className="k-surface" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: s.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11 }}>
                {s.lang.split(' ')[0].slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{s.lang}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.v} · {s.release}</div>
              </div>
            </div>
            <div className="mono" style={{ padding: '8px 10px', background: 'var(--slate-900)', color: '#cbd5e1', borderRadius: 4, fontSize: 11.5, marginBottom: 10 }}>$ {s.install}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="k-btn k-btn-secondary k-btn-sm"><Icon name="fileText" size={11}/> Docs</button>
              <button className="k-btn k-btn-secondary k-btn-sm"><Icon name="external" size={11}/> GitHub</button>
            </div>
          </div>
        ))}
      </div>

      <Card title="Sample apps" desc="Reference implementations to copy / fork">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {[
            { n: 'kaenal-sap-bridge', d: 'Sync SAP production orders into Kaenal as inspections', lang: 'Python', stars: 124 },
            { n: 'kaenal-power-bi', d: 'Connect Kaenal reports to Power BI as a custom connector', lang: 'TypeScript', stars: 87 },
            { n: 'kaenal-cmm-watcher', d: 'Tail Hexagon CMM result files and upload to inspections', lang: 'Python', stars: 64 },
            { n: 'kaenal-slack-bot', d: 'Slash commands /ncr, /inspection from Slack', lang: 'TypeScript', stars: 142 },
            { n: 'kaenal-terraform', d: 'Manage workspace config as code', lang: 'HCL', stars: 38 },
            { n: 'kaenal-snowflake-sync', d: 'Stream events to Snowflake via webhook → SQS → Snowpipe', lang: 'Python', stars: 47 },
          ].map(s => (
            <div key={s.n} style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{s.n}</span>
                <span className="k-chip" style={{ background: 'var(--bg-subtle)' }}>{s.lang}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>★ {s.stars}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{s.d}</div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

Object.assign(window, { DevPlatformHub });
