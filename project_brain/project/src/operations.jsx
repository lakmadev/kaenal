// Kaenal — Operations & Lifecycle
// Status page, Backup & restore, Data warehouse sync,
// Bulk import wizards, Data validation rules

// ─────────────────────────────────────────────────────────────
// STATUS PAGE
// ─────────────────────────────────────────────────────────────
function StatusPage({ setRoute }) {
  return (
    <div>
      <PageHeader
        title="System status"
        description="Public status page · widget for in-app + status.kaenal.app · scheduled maintenance + incident postmortems."
        actions={
          <>
            <button className="k-btn k-btn-ghost"><Icon name="external" size={13}/> status.kaenal.app</button>
            <button className="k-btn k-btn-primary"><Icon name="plus" size={13}/> Schedule maintenance</button>
          </>
        }
      />
      <div style={{ padding: '20px 28px 32px' }}>
        <div style={{
          padding: 20, marginBottom: 18,
          background: 'linear-gradient(135deg, #052e16, #14532d)',
          color: 'white', borderRadius: 'var(--r-lg)',
          display: 'flex', alignItems: 'center', gap: 18,
        }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(34,197,94,0.25)', border: '3px solid rgba(34,197,94,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={26} stroke={3}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>All systems operational</div>
            <div style={{ fontSize: 12.5, opacity: 0.85, marginTop: 4 }}>Last checked 14 sec ago · Probe coverage from 8 regions</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, opacity: 0.7 }}>UPTIME (90 DAYS)</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>99.994%</div>
          </div>
        </div>

        <Card title="Components">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { c: 'Web app', up: 99.998, history: gen(90, 0) },
              { c: 'REST API', up: 99.997, history: gen(90, 0) },
              { c: 'GraphQL API', up: 99.994, history: gen(90, 1) },
              { c: 'Webhooks', up: 99.992, history: gen(90, 2) },
              { c: 'Mobile sync', up: 99.99, history: gen(90, 3) },
              { c: 'AI services', up: 99.96, history: gen(90, 8) },
              { c: 'PDF rendering', up: 99.99, history: gen(90, 1) },
              { c: 'Integration bus', up: 99.96, history: gen(90, 6) },
              { c: 'Backups', up: 100, history: gen(90, 0) },
              { c: 'Authentication (SSO + Kaenal)', up: 100, history: gen(90, 0) },
            ].map(c => (
              <div key={c.c} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span className="pulse-dot" style={{ background: c.up >= 99.95 ? '#22c55e' : '#f59e0b' }}/>
                  <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1 }}>{c.c}</span>
                  <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{c.up}% · 90d</span>
                  <span className="k-chip" style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}>Operational</span>
                </div>
                <div style={{ display: 'flex', gap: 1.5, height: 26 }}>
                  {c.history.map((d, i) => (
                    <div key={i} style={{
                      flex: 1, minWidth: 2,
                      background: d === 0 ? '#22c55e' : d === 1 ? '#f59e0b' : '#dc2626',
                      borderRadius: 1,
                      opacity: 0.8,
                    }} title={`Day ${i + 1}: ${d === 0 ? 'OK' : d === 1 ? 'Degraded' : 'Incident'}`}/>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
                  <span>90 days ago</span>
                  <span>Today</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card title="Scheduled maintenance">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { t: 'Database minor version upgrade', when: 'Sat May 23 · 03:00–05:00 UTC', impact: 'Brief read-only window (~ 2 min)', kind: 'info' },
                { t: 'Hexagon CMM integration upgrade', when: 'Fri May 29 · 02:00–04:00 UTC', impact: 'CMM auto-import paused — manual upload OK', kind: 'info' },
                { t: 'KMS rotation — eu-west-1', when: 'Sat Jun 07 · 04:00–04:30 UTC', impact: 'No customer impact expected', kind: 'info' },
              ].map((m, i) => (
                <div key={i} style={{ padding: 10, background: 'var(--bg-subtle)', borderRadius: 6, borderLeft: '3px solid #2563eb' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{m.t}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{m.when}</div>
                  <div style={{ fontSize: 11, marginTop: 3 }}>{m.impact}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Recent incidents (90 days)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { t: 'AI services elevated latency', when: 'Apr 28 · 14:22–14:48 IST', sev: 'minor', mitigated: '26 min', cause: 'Upstream Anthropic timeout — failover to in-house' },
                { t: 'Webhook delivery delay', when: 'Apr 04 · 09:14–10:02 IST', sev: 'minor', mitigated: '48 min', cause: 'Queue backpressure during traffic spike' },
                { t: 'CMM bridge service degraded', when: 'Mar 18 · 22:00–23:24 IST', sev: 'major', mitigated: '1h 24m', cause: 'Integration certificate expired — auto-rotation now in place' },
              ].map((m, i) => (
                <div key={i} style={{ padding: 10, background: 'var(--bg-subtle)', borderRadius: 6, borderLeft: `3px solid ${m.sev === 'major' ? '#dc2626' : '#f59e0b'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1 }}>{m.t}</span>
                    <span className="k-chip" style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}>Resolved · {m.mitigated}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{m.when} · {m.cause}</div>
                  <a style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4, display: 'inline-block' }}>Read postmortem →</a>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card title="Status widget" desc="Embed in your customer portal or intranet">
          <div style={{ padding: 14, background: 'var(--slate-900)', color: '#cbd5e1', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.6 }}>
            <span style={{ color: '#94a3b8' }}>&lt;!-- Kaenal status widget --&gt;</span><br/>
            <span style={{ color: '#fbbf24' }}>&lt;script</span> <span style={{ color: '#bef264' }}>src</span>=<span style={{ color: '#a78bfa' }}>"https://status.kaenal.app/widget.js"</span><br/>{'  '}<span style={{ color: '#bef264' }}>data-workspace</span>=<span style={{ color: '#a78bfa' }}>"precision-auto"</span><span style={{ color: '#fbbf24' }}>&gt;&lt;/script&gt;</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

function gen(n, incidents) {
  const arr = Array(n).fill(0);
  for (let i = 0; i < incidents; i++) arr[Math.floor(Math.random() * n)] = i % 3 === 0 ? 2 : 1;
  return arr;
}

// ─────────────────────────────────────────────────────────────
// BACKUP & RESTORE
// ─────────────────────────────────────────────────────────────
function BackupRestore({ setRoute }) {
  return (
    <div>
      <PageHeader
        title="Backup & restore"
        description="Encrypted incremental backups · cross-region replicas · point-in-time restore down to the second."
        actions={
          <>
            <button className="k-btn k-btn-ghost"><Icon name="download" size={13}/> Download backup</button>
            <button className="k-btn k-btn-primary"><Icon name="refresh" size={13}/> Test restore</button>
          </>
        }
      />
      <div style={{ padding: '20px 28px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
          {[
            { l: 'Last successful backup', v: '12m ago', s: 'Continuous WAL stream', c: '#16a34a' },
            { l: 'RPO actual', v: '< 1 min', s: 'Recovery point', c: '#16a34a' },
            { l: 'RTO tested', v: '14 min', s: 'Recovery time (Apr 28)', c: '#16a34a' },
            { l: 'Backup size (compressed)', v: '47.2 GB', s: 'Daily delta ~ 480 MB', c: '#2563eb' },
          ].map(k => (
            <div key={k.l} className="k-surface" style={{ padding: 14 }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{k.l}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: k.c }}>{k.v}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{k.s}</div>
            </div>
          ))}
        </div>

        <Card title="Backup schedule">
          <Row label="Continuous WAL streaming" hint="Write-ahead log shipped to replica every 15 seconds"><Toggle on={true}/></Row>
          <Row label="Daily snapshot"><Segmented value="01:00" onChange={() => {}} options={[
            { value: '00:00', label: '00:00 UTC' }, { value: '01:00', label: '01:00 UTC' }, { value: '03:00', label: '03:00 UTC' },
          ]}/></Row>
          <Row label="Retention">
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 12 }}>Keep for</span>
              <input type="number" defaultValue={35} className="k-input" style={{ width: 60 }}/>
              <span style={{ fontSize: 12 }}>days · plus monthly snapshots for</span>
              <input type="number" defaultValue={7} className="k-input" style={{ width: 60 }}/>
              <span style={{ fontSize: 12 }}>years</span>
            </div>
          </Row>
          <Row label="Cross-region replica" hint="Disaster recovery sibling">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12 }}>ap-south-1 (primary)</span><Icon name="arrowRight" size={12}/><span style={{ fontSize: 12 }}>ap-southeast-1 (replica)</span>
              <span className="k-chip" style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}>Replicating</span>
            </div>
          </Row>
          <Row label="Backup encryption" hint="Wraps daily snapshots with customer KMS key">
            <span className="k-chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><Icon name="key" size={10}/> precision-auto-prod (BYOK)</span>
          </Row>
        </Card>

        <Card title="Point-in-time restore">
          <div style={{ padding: 16, background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)' }}>
            <div className="k-overline" style={{ marginBottom: 8 }}>Restore window</div>
            <div style={{ position: 'relative', height: 50, marginBottom: 12 }}>
              <div style={{ position: 'absolute', top: 20, left: 0, right: 0, height: 4, background: 'var(--border)', borderRadius: 2 }}>
                <div style={{ position: 'absolute', top: 0, left: '5%', right: '0%', height: '100%', background: 'var(--accent)' }}/>
              </div>
              {[5, 25, 50, 75, 95].map(pct => (
                <div key={pct} style={{ position: 'absolute', top: 14, left: `${pct}%`, transform: 'translateX(-50%)' }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: pct === 95 ? 'var(--accent)' : 'var(--surface)', border: '2px solid var(--accent)', cursor: 'pointer' }}/>
                </div>
              ))}
              <div style={{ position: 'absolute', top: 32, left: 0, fontSize: 10, color: 'var(--text-muted)' }}>35 days ago</div>
              <div style={{ position: 'absolute', top: 32, right: 0, fontSize: 10, color: 'var(--text-muted)' }}>Now</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
              <Field k="Restore point" v="2026-05-19 13:47:22 IST"/>
              <Field k="Source backup" v="WAL position 18374/3a8c"/>
              <Field k="Estimated time" v="~ 14 minutes"/>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Segmented value="staging" onChange={() => {}} options={[
                { value: 'staging', label: 'Restore to staging' },
                { value: 'sandbox', label: 'Restore to sandbox' },
                { value: 'replace', label: 'Replace production' },
              ]}/>
              <button className="k-btn k-btn-primary" style={{ marginLeft: 'auto' }}><Icon name="play" size={12}/> Begin restore</button>
            </div>
          </div>
        </Card>

        <Card title="Recent restores & DR tests">
          <table className="k-table" style={{ width: '100%' }}>
            <thead><tr><th>When</th><th>Type</th><th>To</th><th>Source</th><th>Duration</th><th>Result</th></tr></thead>
            <tbody>
              {[
                { t: 'Apr 28 (last DR test)', tp: 'DR test', to: 'DR sandbox', src: 'Mar 28 snapshot', dur: '14m 02s', r: 'pass' },
                { t: 'Mar 22', tp: 'Test restore', to: 'Staging', src: 'PITR — 24h ago', dur: '12m 18s', r: 'pass' },
                { t: 'Mar 14', tp: 'Operational', to: 'Production', src: 'PITR — 4h ago (after bad import)', dur: '8m 42s', r: 'pass' },
                { t: 'Feb 28 (Q1 DR test)', tp: 'DR test', to: 'DR region', src: 'Cross-region replica', dur: '11m 24s', r: 'pass' },
                { t: 'Jan 30', tp: 'Test restore', to: 'Staging', src: 'Monthly snapshot', dur: '47m 18s', r: 'pass-slow', note: 'Slower than RTO — addressed in Feb test' },
              ].map((r, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 11.5 }}>{r.t}</td>
                  <td><span className="k-chip" style={{ background: 'var(--bg-subtle)' }}>{r.tp}</span></td>
                  <td style={{ fontSize: 12 }}>{r.to}</td>
                  <td style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{r.src}</td>
                  <td className="mono" style={{ fontSize: 11.5 }}>{r.dur}</td>
                  <td>
                    <span className="k-chip" style={{
                      background: r.r === 'pass' ? 'var(--success-100)' : 'rgba(245,158,11,0.12)',
                      color: r.r === 'pass' ? 'var(--success-700)' : '#92400e',
                    }}>{r.r}</span>
                    {r.note && <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>{r.note}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DATA WAREHOUSE SYNC
// ─────────────────────────────────────────────────────────────
function DataWarehouseSync({ setRoute }) {
  return (
    <div>
      <PageHeader
        title="Data warehouse sync"
        description="Stream every record + event to Snowflake, BigQuery, Databricks, Redshift, or S3. Schema-managed, schema-tracked."
        actions={
          <>
            <button className="k-btn k-btn-ghost"><Icon name="fileText" size={13}/> Schema docs</button>
            <button className="k-btn k-btn-primary"><Icon name="plus" size={13}/> New destination</button>
          </>
        }
      />
      <div style={{ padding: '20px 28px 32px' }}>
        <Card title="Active destinations">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { name: 'Snowflake — KAENAL.PROD', vendor: 'Snowflake', color: '#29b5e8', conn: 'kaenal.snowflakecomputing.com / KAENAL_PROD', lag: '8 sec', rows: '184.2M', mode: 'CDC streaming', status: 'healthy' },
              { name: 'Databricks — gold layer', vendor: 'Databricks', color: '#ff3621', conn: 'precision-auto.cloud.databricks.com', lag: '14 min', rows: '184.2M', mode: 'Hourly batch', status: 'healthy' },
              { name: 'S3 raw events bucket', vendor: 'AWS S3', color: '#ff9900', conn: 's3://precision-auto-kaenal-events/', lag: '< 1 sec', rows: '1.8B', mode: 'Event stream', status: 'healthy' },
              { name: 'BigQuery — reporting', vendor: 'BigQuery', color: '#4285f4', conn: 'kaenal-prod-1842 · reporting dataset', lag: '4 min', rows: '184.2M', mode: 'CDC streaming', status: 'degraded', err: 'Bad row in dlq — schema mismatch on ncr.severity_v2' },
            ].map((d, i) => (
              <div key={i} style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 8, background: d.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11 }}>
                    {d.vendor.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{d.name}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{d.conn}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 18, fontSize: 11.5 }}>
                    <div><div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Lag</div><div style={{ fontWeight: 600 }} className="mono">{d.lag}</div></div>
                    <div><div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Rows</div><div style={{ fontWeight: 600 }} className="mono">{d.rows}</div></div>
                    <div><div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Mode</div><div>{d.mode}</div></div>
                  </div>
                  {d.status === 'healthy'
                    ? <span className="k-chip" style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}>Healthy</span>
                    : <span className="k-chip" style={{ background: 'rgba(245,158,11,0.12)', color: '#92400e' }}>Degraded</span>}
                </div>
                {d.err && (
                  <div style={{ marginTop: 8, padding: 8, background: 'rgba(245,158,11,0.08)', borderRadius: 4, fontSize: 11.5, color: '#92400e' }}>
                    <Icon name="alert" size={11} style={{ verticalAlign: '-1px', marginRight: 4 }}/> {d.err}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card title="Synced tables" desc="46 entity tables · 12 enrichment views · auto-managed">
          <table className="k-table" style={{ width: '100%' }}>
            <thead><tr><th>Table</th><th>Columns</th><th>Rows</th><th>Last sync</th><th>Schema version</th></tr></thead>
            <tbody>
              {[
                { t: 'kaenal_ncrs', c: 47, r: 142847, sync: '12 sec ago', sv: 'v18 (current)' },
                { t: 'kaenal_inspections', c: 38, r: 1842410, sync: '4 sec ago', sv: 'v22 (current)' },
                { t: 'kaenal_inspection_responses', c: 18, r: 24842410, sync: '4 sec ago', sv: 'v8 (current)' },
                { t: 'kaenal_8d', c: 84, r: 4820, sync: '24 sec ago', sv: 'v12 (current)' },
                { t: 'kaenal_audits', c: 28, r: 184, sync: '48 sec ago', sv: 'v6 (current)' },
                { t: 'kaenal_documents', c: 32, r: 12420, sync: '14 sec ago', sv: 'v14 (current)' },
                { t: 'kaenal_spc_signals', c: 16, r: 84210, sync: '4 sec ago', sv: 'v4 (current)' },
                { t: 'kaenal_user_activity', c: 12, r: 84247120, sync: 'streaming', sv: 'v3 (current)' },
                { t: 'kaenal_dim_users', c: 18, r: 412, sync: '4 min ago', sv: 'v8 (current)' },
                { t: 'kaenal_dim_areas', c: 12, r: 47, sync: '1 hour ago', sv: 'v4 (current)' },
              ].map(r => (
                <tr key={r.t}>
                  <td className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>{r.t}</td>
                  <td className="mono">{r.c}</td>
                  <td className="mono">{r.r.toLocaleString()}</td>
                  <td style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{r.sync}</td>
                  <td><span className="k-chip mono" style={{ background: 'var(--bg-subtle)', fontSize: 10 }}>{r.sv}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card title="Schema change log">
            {[
              { v: 'v18', d: '2 days ago', desc: 'Added kaenal_ncrs.severity_v2 (new 1-9 scale)', back: true },
              { v: 'v17', d: '2 weeks ago', desc: 'Added kaenal_ncrs.linked_complaint_id', back: true },
              { v: 'v16', d: '1 month ago', desc: 'Renamed kaenal_8d.lead_user_id → owner_user_id', back: false },
              { v: 'v15', d: '6 weeks ago', desc: 'Added kaenal_inspections.template_version', back: true },
            ].map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderBottom: '1px solid var(--border)' }}>
                <span className="mono k-chip" style={{ background: 'var(--bg-subtle)', fontSize: 11 }}>{c.v}</span>
                <span style={{ flex: 1, fontSize: 12 }}>{c.desc}</span>
                <span className="k-chip" style={{ background: c.back ? 'var(--success-100)' : 'rgba(245,158,11,0.12)', color: c.back ? 'var(--success-700)' : '#92400e', fontSize: 10 }}>
                  {c.back ? 'Backward compatible' : 'Breaking'}
                </span>
                <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{c.d}</span>
              </div>
            ))}
          </Card>

          <Card title="Sample queries">
            <div style={{ padding: 12, background: 'var(--slate-900)', color: '#cbd5e1', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.55 }}>
              <div style={{ color: '#94a3b8' }}>-- Top defect categories last 30 days</div>
              <div><span style={{ color: '#a78bfa' }}>SELECT</span> category, <span style={{ color: '#a78bfa' }}>COUNT</span>(*) cnt</div>
              <div><span style={{ color: '#a78bfa' }}>FROM</span> KAENAL.PROD.kaenal_ncrs</div>
              <div><span style={{ color: '#a78bfa' }}>WHERE</span> created_at &gt; <span style={{ color: '#bef264' }}>CURRENT_DATE</span> - <span style={{ color: '#fbbf24' }}>30</span></div>
              <div><span style={{ color: '#a78bfa' }}>GROUP BY</span> category</div>
              <div><span style={{ color: '#a78bfa' }}>ORDER BY</span> cnt <span style={{ color: '#a78bfa' }}>DESC</span> <span style={{ color: '#a78bfa' }}>LIMIT</span> <span style={{ color: '#fbbf24' }}>10</span>;</div>
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
              <button className="k-btn k-btn-secondary k-btn-sm"><Icon name="copy" size={11}/> Copy</button>
              <button className="k-btn k-btn-secondary k-btn-sm"><Icon name="external" size={11}/> Open in Snowflake</button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BULK IMPORT WIZARD
// ─────────────────────────────────────────────────────────────
function BulkImport({ setRoute }) {
  const [step, setStep] = React.useState(2);
  const steps = ['Source', 'Map fields', 'Validate', 'Dry run', 'Commit'];

  return (
    <div>
      <PageHeader
        title="Bulk import"
        description="Migrate from legacy systems (QAD, SAP QM, Trackwise) or onboard a new plant from CSV / Excel / XML."
        actions={<button className="k-btn k-btn-secondary">Save as job</button>}
      />
      <div style={{ padding: '20px 28px 32px' }}>
        {/* Stepper */}
        <div style={{ display: 'flex', gap: 0, padding: 16, background: 'var(--surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', marginBottom: 18 }}>
          {steps.map((s, i) => (
            <React.Fragment key={s}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: i === steps.length - 1 ? '0 0 auto' : 1 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: i < step ? '#22c55e' : i === step ? 'var(--accent)' : 'var(--bg-subtle)',
                  color: i <= step ? 'white' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 12,
                }}>{i < step ? <Icon name="check" size={12} stroke={3}/> : i + 1}</div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Step {i + 1}</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{s}</div>
                </div>
              </div>
              {i < steps.length - 1 && <div style={{ flex: 1, height: 2, background: i < step ? '#22c55e' : 'var(--border)', alignSelf: 'center', margin: '0 14px' }}/>}
            </React.Fragment>
          ))}
        </div>

        {step === 2 && <ValidateStep next={() => setStep(3)}/>}
      </div>
    </div>
  );
}

function ValidateStep({ next }) {
  return (
    <>
      <Card title="Validation results" desc="Dry-run validation on 4,820 NCRs from QAD export — no records written yet">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
          {[
            { l: 'Total rows', v: '4,820', c: '#64748b' },
            { l: 'Will import', v: '4,742', c: '#16a34a' },
            { l: 'Errors', v: '38', c: '#dc2626' },
            { l: 'Warnings', v: '40', c: '#f59e0b' },
          ].map(s => (
            <div key={s.l} style={{ padding: 12, background: 'var(--bg-subtle)', borderRadius: 6 }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{s.l}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.c }}>{s.v}</div>
            </div>
          ))}
        </div>

        <div className="k-overline" style={{ marginBottom: 8 }}>Errors (blocking — 38)</div>
        <div style={{ marginBottom: 14, padding: 12, background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 'var(--r-md)' }}>
          {[
            { c: 24, msg: 'Required field `area_id` missing or invalid — example row 1842: area_id="AREA_X" not in current taxonomy' },
            { c: 12, msg: 'Severity must be one of {critical, high, medium, low} — example row 247: severity="Sev1" (legacy)' },
            { c: 2, msg: 'Reporter user_id does not exist in workspace — row 4012: legacy_user_id=84217' },
          ].map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
              <span className="mono" style={{ background: '#dc2626', color: 'white', borderRadius: 4, padding: '1px 8px', fontSize: 11, fontWeight: 700, flexShrink: 0, alignSelf: 'flex-start' }}>{e.c}×</span>
              <span style={{ flex: 1, fontSize: 12, color: '#7f1d1d' }}>{e.msg}</span>
              <button className="k-btn k-btn-secondary k-btn-sm" style={{ flexShrink: 0 }}>Fix mapping</button>
            </div>
          ))}
        </div>

        <div className="k-overline" style={{ marginBottom: 8 }}>Warnings (non-blocking — 40)</div>
        <div style={{ marginBottom: 14, padding: 12, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--r-md)' }}>
          {[
            { c: 24, msg: 'Disposition is empty — will default to "Pending review"' },
            { c: 12, msg: 'created_at older than retention policy (> 7 years) — will be marked read-only' },
            { c: 4, msg: 'Photo attachments referenced but file not found in upload bundle' },
          ].map((w, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
              <span className="mono" style={{ background: '#f59e0b', color: 'white', borderRadius: 4, padding: '1px 8px', fontSize: 11, fontWeight: 700, flexShrink: 0, alignSelf: 'flex-start' }}>{w.c}×</span>
              <span style={{ flex: 1, fontSize: 12, color: '#92400e' }}>{w.msg}</span>
            </div>
          ))}
        </div>

        <div className="k-overline" style={{ marginBottom: 8 }}>Sample preview (first 4 rows)</div>
        <div style={{ overflow: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
          <table style={{ width: '100%', fontSize: 12, minWidth: 720 }}>
            <thead style={{ background: 'var(--bg-subtle)' }}>
              <tr>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Legacy ID</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Title</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Severity</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Area</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['QAD-NCR-018724', 'Weld bead missing on bracket VBR-3041', 'high', 'pune-1/weld-4', '2024-08-12'],
                ['QAD-NCR-018725', 'Surface finish below Ra spec', 'medium', 'pune-1/grind-2', '2024-08-12'],
                ['QAD-NCR-018726', 'Dimensional out of tol — hub bore', 'critical', 'pune-1/cmm-lab', '2024-08-13', true],
                ['QAD-NCR-018727', 'Cosmetic — paint runs', 'low', 'pune-1/paint', '2024-08-13'],
              ].map(r => (
                <tr key={r[0]} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="mono" style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{r[0]}</td>
                  <td style={{ padding: '8px 10px' }}>{r[1]}</td>
                  <td style={{ padding: '8px 10px' }}><span className="k-chip" style={{ background: 'var(--bg-subtle)' }}>{r[2]}</span></td>
                  <td className="mono" style={{ padding: '8px 10px' }}>{r[3]}</td>
                  <td className="mono" style={{ padding: '8px 10px' }}>{r[4]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button className="k-btn k-btn-secondary">Back</button>
          <button className="k-btn k-btn-secondary">Re-run validation</button>
          <button onClick={next} className="k-btn k-btn-primary" style={{ marginLeft: 'auto' }}><Icon name="play" size={12}/> Continue to dry run</button>
        </div>
      </Card>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// DATA VALIDATION RULES
// ─────────────────────────────────────────────────────────────
function ValidationRules({ setRoute }) {
  return (
    <div>
      <PageHeader
        title="Data validation rules"
        description="Required fields, format checks, business rules. Applied at form submit + on import. Per record type, conditional."
        actions={<button className="k-btn k-btn-primary"><Icon name="plus" size={13}/> New rule</button>}
      />
      <div style={{ padding: '20px 28px 32px' }}>
        <Card title="NCR validation rules" desc="Inherited from parent workspace · 18 rules">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { name: 'Severity required', cond: 'On create', action: 'Block', when: 'severity is empty' },
              { name: 'Area required', cond: 'On create', action: 'Block', when: 'area_id is empty or invalid' },
              { name: 'Photo required for critical', cond: 'When severity = critical', action: 'Block', when: 'attachments.photos < 1' },
              { name: 'Customer reference required for customer-NCR', cond: 'When source = customer', action: 'Block', when: 'customer_ref is empty' },
              { name: '8D required for critical & high', cond: 'On disposition', action: 'Block', when: 'severity in (critical, high) AND linked_8d is null' },
              { name: 'Containment must precede disposition', cond: 'On disposition', action: 'Warn', when: 'containment_action is empty' },
              { name: 'Approver cannot be reporter', cond: 'On approve', action: 'Block', when: 'approver_user_id = reporter_user_id' },
              { name: 'Disposition signer must be trained', cond: 'On disposition', action: 'Block', when: 'signer.training[8d-problem-solving] != valid' },
              { name: 'Close requires CAPA effectiveness verified', cond: 'On close', action: 'Block', when: 'CAPA.effectiveness_verified is false' },
              { name: 'Aging — 14 days without action', cond: 'Background', action: 'Escalate to Quality Manager', when: 'updated_at < now() - 14 days AND status != closed' },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
                <Icon name="shield" size={14} style={{ color: 'var(--accent)' }}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    <span className="k-chip" style={{ background: 'var(--bg-subtle)', fontSize: 10, marginRight: 4 }}>{r.cond}</span>
                    <span className="mono">{r.when}</span>
                  </div>
                </div>
                <span className="k-chip" style={{
                  background: r.action === 'Block' ? 'rgba(220,38,38,0.10)' : r.action.startsWith('Warn') ? 'rgba(245,158,11,0.12)' : 'rgba(124,58,237,0.10)',
                  color: r.action === 'Block' ? '#b91c1c' : r.action.startsWith('Warn') ? '#92400e' : '#7c3aed',
                }}>{r.action}</span>
                <Toggle on={true}/>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Rule builder">
          <div style={{ padding: 14, background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>WHEN</span>
              <select className="k-input" style={{ width: 'auto', height: 30 }}><option>On submit</option><option>On approve</option></select>
              <span style={{ fontWeight: 600 }}>FOR</span>
              <select className="k-input" style={{ width: 'auto', height: 30 }}><option>NCR</option><option>Inspection</option><option>Document</option></select>
              <span style={{ fontWeight: 600 }}>IF</span>
              <select className="k-input" style={{ width: 'auto', height: 30 }}><option>severity</option><option>area</option></select>
              <select className="k-input" style={{ width: 'auto', height: 30 }}><option>=</option><option>in</option></select>
              <input className="k-input" defaultValue="critical" style={{ width: 120, height: 30 }}/>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>THEN</span>
              <select className="k-input" style={{ width: 'auto', height: 30 }}><option>Block submit</option><option>Warn user</option><option>Auto-escalate</option></select>
              <span>with message</span>
              <input className="k-input" defaultValue="Critical NCRs require at least 1 photo of the defect" style={{ flex: 1, height: 30 }}/>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="k-btn k-btn-secondary"><Icon name="play" size={12}/> Test against last 100 records</button>
            <button className="k-btn k-btn-primary" style={{ marginLeft: 'auto' }}>Save rule</button>
          </div>
        </Card>

        <Card title="Recent validation events">
          <table className="k-table" style={{ width: '100%' }}>
            <thead><tr><th>When</th><th>User</th><th>Action</th><th>Rule</th><th>Outcome</th></tr></thead>
            <tbody>
              {[
                { t: '12 min ago', u: 'u5', a: 'Submit NCR', rule: 'Photo required for critical', out: 'Blocked' },
                { t: '34 min ago', u: 'u-jorge', a: 'Submit Inspection', rule: 'Operator badge required', out: 'Blocked' },
                { t: '1h ago', u: 'u2', a: 'Disposition NCR', rule: 'Approver != reporter', out: 'Blocked' },
                { t: '2h ago', u: 'u4', a: 'Close NCR', rule: 'CAPA effectiveness verified', out: 'Warned, override allowed by QM' },
                { t: '4h ago', u: 'u1', a: 'Bulk import', rule: 'Severity in allowed list', out: '38 rows rejected' },
              ].map((r, i) => (
                <tr key={i}>
                  <td className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{r.t}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Avatar user={r.u} size={22}/>
                      <span style={{ fontSize: 12 }}>{userById(r.u)?.name?.split(' ')[0]}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 12 }}>{r.a}</td>
                  <td style={{ fontSize: 12 }}>{r.rule}</td>
                  <td><span className="k-chip" style={{ background: r.out === 'Blocked' ? 'rgba(220,38,38,0.10)' : 'rgba(245,158,11,0.12)', color: r.out === 'Blocked' ? '#b91c1c' : '#92400e' }}>{r.out}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

Object.assign(window, { StatusPage, BackupRestore, DataWarehouseSync, BulkImport, ValidationRules });
