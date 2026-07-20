// Kaenal — Compliance extras
// DSAR workflow, Legal hold, DLP policies, BYOK / customer-managed keys

// ─────────────────────────────────────────────────────────────
// DSAR — GDPR Data Subject Access Request
// ─────────────────────────────────────────────────────────────
const DSAR_REQUESTS = [
  { id: 'DSAR-2026-014', subject: 'Anita Kapoor', email: 'anita.kapoor@gmail.com', kind: 'access', country: '🇮🇳 India', received: '2 hours ago', deadline: 'Jun 17 (29d)', status: 'collecting', progress: 60 },
  { id: 'DSAR-2026-013', subject: 'Carlos Rodriguez (ex-employee)', email: 'carlos.r@personal.com', kind: 'erasure', country: '🇪🇸 Spain', received: 'Yesterday', deadline: 'Jun 16 (28d)', status: 'review', progress: 80 },
  { id: 'DSAR-2026-012', subject: 'Klaus Müller (customer contact)', email: 'klaus.muller@daimlertruck.com', kind: 'portability', country: '🇩🇪 Germany', received: '3 days ago', deadline: 'Jun 14 (26d)', status: 'collecting', progress: 35 },
  { id: 'DSAR-2026-011', subject: 'Operator badge P-184729', email: 'sarah.ahmed@…', kind: 'access', country: '🇮🇳 India', received: '1 week ago', deadline: 'Jun 08 (20d)', status: 'delivered', progress: 100 },
  { id: 'DSAR-2026-010', subject: 'Jane Doe (visitor sign-in)', email: 'jane.d@example.com', kind: 'erasure', country: '🇺🇸 California', received: '2 weeks ago', deadline: 'Jun 01 (13d)', status: 'delivered', progress: 100 },
];

function DSARWorkflow({ setRoute }) {
  const [selected, setSelected] = React.useState('DSAR-2026-014');
  const r = DSAR_REQUESTS.find(x => x.id === selected) || DSAR_REQUESTS[0];

  return (
    <div>
      <PageHeader
        title="Data subject requests"
        description="GDPR Art. 15 (access), Art. 17 (erasure), Art. 20 (portability), CCPA equivalents. 30-day SLA."
        actions={
          <>
            <button className="k-btn k-btn-ghost"><Icon name="download" size={13}/> Quarterly report</button>
            <button className="k-btn k-btn-primary"><Icon name="plus" size={13}/> Log new request</button>
          </>
        }
      />
      <div style={{ padding: '20px 28px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 18 }}>
          {[
            { l: 'Open', v: 5, c: '#2563eb' },
            { l: 'Avg resolution', v: '11d', c: '#16a34a' },
            { l: 'SLA breach risk', v: 1, c: '#f59e0b' },
            { l: 'Erasure (90d)', v: 8, c: '#7c3aed' },
            { l: 'Access (90d)', v: 24, c: '#0d9488' },
          ].map(k => (
            <div key={k.l} className="k-surface" style={{ padding: 12 }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{k.l}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: k.c }}>{k.v}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
          <Card title="Active & recent requests">
            <table className="k-table" style={{ width: '100%' }}>
              <thead><tr><th>ID</th><th>Subject</th><th>Type</th><th>Deadline</th><th>Progress</th></tr></thead>
              <tbody>
                {DSAR_REQUESTS.map(d => (
                  <tr key={d.id} onClick={() => setSelected(d.id)} style={{ cursor: 'pointer', background: selected === d.id ? 'var(--accent-soft)' : '' }}>
                    <td className="mono" style={{ fontSize: 11.5 }}>{d.id}</td>
                    <td>
                      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{d.subject}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{d.email} · {d.country}</div>
                    </td>
                    <td>
                      <span className="k-chip" style={{
                        background: d.kind === 'erasure' ? 'rgba(220,38,38,0.10)' : d.kind === 'portability' ? 'rgba(124,58,237,0.10)' : 'var(--bg-subtle)',
                        color: d.kind === 'erasure' ? '#b91c1c' : d.kind === 'portability' ? '#7c3aed' : 'var(--text)',
                      }}>{d.kind}</span>
                    </td>
                    <td className="mono" style={{ fontSize: 11.5 }}>{d.deadline}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 80, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${d.progress}%`, height: '100%', background: d.status === 'delivered' ? '#22c55e' : '#2563eb' }}/>
                        </div>
                        <span style={{ fontSize: 11 }}>{d.status}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title={r.id} desc={r.kind + ' · ' + r.subject}>
            <div className="k-overline" style={{ marginBottom: 8 }}>Discovery</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {[
                { sys: 'Kaenal core (NCRs, inspections)', found: 47, status: 'done' },
                { sys: 'Document drawer (audit attachments)', found: 12, status: 'done' },
                { sys: 'Mobile inspector — offline queue', found: 0, status: 'done' },
                { sys: 'Email parser inbox', found: 4, status: 'done' },
                { sys: 'AI audit log (prompts mentioning subject)', found: 18, status: 'done' },
                { sys: 'Visitor sign-in (RFID badge logs)', found: 2, status: 'done' },
                { sys: 'Backup / cold storage (S3 Glacier)', found: '?', status: 'pending' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: s.status === 'done' ? 'var(--success-50)' : 'var(--bg-subtle)', borderRadius: 4, fontSize: 12 }}>
                  <Icon name={s.status === 'done' ? 'check' : 'clock'} size={12} stroke={2.5} style={{ color: s.status === 'done' ? 'var(--success-600)' : '#f59e0b' }}/>
                  <span style={{ flex: 1 }}>{s.sys}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.found} records</span>
                </div>
              ))}
            </div>

            <div className="k-overline" style={{ marginBottom: 6 }}>Sensitive references</div>
            <div style={{ padding: 10, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6, fontSize: 11.5, marginBottom: 14 }}>
              <div style={{ fontWeight: 600, color: '#92400e' }}>4 records reference other people</div>
              <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>Subject is co-signer on 4 inspection records with other inspectors. Their names must be redacted before delivery (Art. 15(4)).</div>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <button className="k-btn k-btn-primary"><Icon name="package" size={12}/> Generate package</button>
              <button className="k-btn k-btn-secondary">Send to legal</button>
            </div>
          </Card>
        </div>

        <Card title="Configuration">
          <Row label="Self-service portal" hint="Subjects can submit requests at kaenal.app/dsar/precision-auto"><Toggle on={true}/></Row>
          <Row label="Identity verification"><Segmented value="govid" onChange={() => {}} options={[
            { value: 'email', label: 'Email confirm' },
            { value: 'govid', label: 'Gov ID upload' },
            { value: 'sso', label: 'SSO assertion' },
          ]}/></Row>
          <Row label="Erasure scope on departure"><Segmented value="anon" onChange={() => {}} options={[
            { value: 'delete', label: 'Hard delete' },
            { value: 'anon', label: 'Anonymize (preserve audit)' },
            { value: 'keep', label: 'Keep (legal basis)' },
          ]}/></Row>
          <Row label="Backup tombstoning" hint="Mark requests so subject is purged on next backup roll-off (≤ 30 days)"><Toggle on={true}/></Row>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// LEGAL HOLD
// ─────────────────────────────────────────────────────────────
function LegalHold({ setRoute }) {
  return (
    <div>
      <PageHeader
        title="Legal hold"
        description="Freeze records relevant to litigation, audit, or investigation. Holds bypass retention and erasure."
        actions={
          <>
            <button className="k-btn k-btn-ghost"><Icon name="download" size={13}/> Hold register</button>
            <button className="k-btn k-btn-primary"><Icon name="lock" size={13}/> New hold</button>
          </>
        }
      />
      <div style={{ padding: '20px 28px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
          {[
            { l: 'Active holds', v: 4, c: '#dc2626' },
            { l: 'Records frozen', v: '12,847', c: '#7c3aed' },
            { l: 'Custodians notified', v: 28, c: '#2563eb' },
            { l: 'Storage retained', v: '8.4 GB', c: '#0d9488' },
          ].map(k => (
            <div key={k.l} className="k-surface" style={{ padding: 14 }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{k.l}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: k.c }}>{k.v}</div>
            </div>
          ))}
        </div>

        <Card title="Active holds">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { id: 'LH-2026-004', name: 'Volvo T-9384 field failure — potential litigation', matter: 'External counsel: Khaitan & Co.', custodians: 12, records: 4820, scope: ['NCR-2026-0142', 'INS-2026-0342…0512', '8D-2026-0015', 'CAPA-2026-0042', 'Documents tagged #volvo-vbr'], opened: '12 days ago', status: 'active', color: '#dc2626' },
              { id: 'LH-2026-003', name: 'IATF audit — Pune-1 evidence preservation', matter: 'Internal — Compliance', custodians: 8, records: 2840, scope: ['All inspections in Pune-1 since Jan 1, 2026', 'Audit AUD-2026-0021 evidence pack'], opened: '38 days ago', status: 'active', color: '#7c3aed' },
              { id: 'LH-2026-002', name: 'Carlos R. — wrongful termination claim', matter: 'External counsel: Trilegal', custodians: 4, records: 187, scope: ['Carlos R. account activity', 'Inspections he signed', 'NCRs where he was named'], opened: '64 days ago', status: 'active', color: '#dc2626' },
              { id: 'LH-2026-001', name: 'Bosch surface finish dispute', matter: 'Internal — Quality', custodians: 4, records: 5000, scope: ['BHS-12 production records'], opened: '4 months ago', status: 'active', color: '#0d9488' },
            ].map(h => (
              <div key={h.id} style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 'var(--r-md)', borderLeft: `3px solid ${h.color}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <Icon name="lock" size={18} style={{ color: h.color, marginTop: 2 }}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{h.id}</span>
                      <span className="k-chip" style={{ background: 'rgba(220,38,38,0.10)', color: '#b91c1c' }}>Active</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· Opened {h.opened}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{h.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 8 }}>{h.matter} · {h.custodians} custodians notified · {h.records.toLocaleString()} records frozen</div>
                    <div className="k-overline" style={{ marginBottom: 4 }}>Scope</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {h.scope.map((s, i) => <span key={i} className="k-chip mono" style={{ background: 'var(--bg-subtle)', fontSize: 10 }}>{s}</span>)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button className="k-btn k-btn-secondary k-btn-sm">View custodians</button>
                    <button className="k-btn k-btn-secondary k-btn-sm">Export</button>
                    <button className="k-btn k-btn-secondary k-btn-sm" style={{ color: '#dc2626' }}>Release</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Custodian acknowledgment" desc="People who hold relevant data — by law must acknowledge they will preserve it">
          <table className="k-table" style={{ width: '100%' }}>
            <thead><tr><th>Custodian</th><th>Hold</th><th>Notified</th><th>Ack'd</th><th></th></tr></thead>
            <tbody>
              {[
                { u: 'u1', h: 'LH-2026-004 · Volvo', notified: '12 days ago', ackd: '11 days ago' },
                { u: 'u4', h: 'LH-2026-004 · Volvo', notified: '12 days ago', ackd: '12 days ago' },
                { u: 'u2', h: 'LH-2026-003 · IATF', notified: '38 days ago', ackd: 'Reminder sent', warn: true },
                { u: 'u5', h: 'LH-2026-002 · Carlos R.', notified: '64 days ago', ackd: '64 days ago' },
                { u: 'u3', h: 'LH-2026-001 · Bosch', notified: '4 months ago', ackd: '4 months ago' },
              ].map((r, i) => {
                const u = userById(r.u);
                return (
                  <tr key={i}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar user={r.u} size={26}/>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{u?.name}</span>
                      </div>
                    </td>
                    <td className="mono" style={{ fontSize: 11.5 }}>{r.h}</td>
                    <td style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{r.notified}</td>
                    <td>
                      {r.warn
                        ? <span className="k-chip" style={{ background: 'rgba(245,158,11,0.12)', color: '#92400e' }}>{r.ackd}</span>
                        : <span className="k-chip" style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}><Icon name="check" size={10} stroke={3}/> {r.ackd}</span>}
                    </td>
                    <td><button className="k-btn-plain" style={{ padding: 6 }}><Icon name="more" size={13}/></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DLP — Data Loss Prevention
// ─────────────────────────────────────────────────────────────
function DLPPolicies({ setRoute }) {
  return (
    <div>
      <PageHeader
        title="Data loss prevention"
        description="Pre-egress controls on uploads, downloads, exports, and outbound emails. Pattern-based + label-based."
        actions={<button className="k-btn k-btn-primary"><Icon name="plus" size={13}/> New policy</button>}
      />
      <div style={{ padding: '20px 28px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
          {[
            { l: 'Policies active', v: 18, c: '#2563eb' },
            { l: 'Blocked (24h)', v: 47, c: '#dc2626' },
            { l: 'Warned (24h)', v: 184, c: '#f59e0b' },
            { l: 'Allowed-with-watermark', v: 412, c: '#7c3aed' },
          ].map(k => (
            <div key={k.l} className="k-surface" style={{ padding: 14 }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{k.l}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: k.c }}>{k.v}</div>
            </div>
          ))}
        </div>

        <Card title="Policies"
          footer={<button className="k-btn k-btn-primary"><Icon name="plus" size={13}/> New policy</button>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { n: 'Block uploads containing Aadhaar / SSN', pat: 'PII patterns', action: 'block', surf: 'All upload surfaces', hits24: 4, on: true },
              { n: 'Block exports of customer drawings to external email', pat: 'Customer Confidential label', action: 'block', surf: 'Email, download', hits24: 12, on: true },
              { n: 'Watermark all PDFs containing supplier pricing', pat: 'Supplier Confidential label', action: 'watermark', surf: 'PDF export', hits24: 247, on: true },
              { n: 'Warn on bulk export > 1000 records', pat: 'Volume', action: 'warn', surf: 'CSV export', hits24: 8, on: true },
              { n: 'Block paste of API tokens into chat / forms', pat: 'kn_sk_[A-Za-z0-9]{32,}', action: 'block', surf: 'AI drawer, chat', hits24: 2, on: true },
              { n: 'Quarantine PHI in inspection notes', pat: 'HIPAA detectors', action: 'quarantine', surf: 'Inspections, NCR', hits24: 0, on: true },
              { n: 'Block screenshots of restricted records', pat: 'Restricted label', action: 'block', surf: 'Mobile + web', hits24: 24, on: false, note: 'iOS only — Android coverage 80%' },
              { n: 'Notify when document downloaded > 5× same user', pat: 'Behavior', action: 'notify', surf: 'Documents', hits24: 2, on: true },
            ].map((p, i) => (
              <div key={i} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: p.action === 'block' ? 'rgba(220,38,38,0.10)' : p.action === 'warn' ? 'rgba(245,158,11,0.12)' : p.action === 'watermark' ? 'rgba(124,58,237,0.10)' : 'rgba(37,99,235,0.10)',
                  color: p.action === 'block' ? '#b91c1c' : p.action === 'warn' ? '#92400e' : p.action === 'watermark' ? '#7c3aed' : '#1d4ed8',
                }}><Icon name={p.action === 'block' ? 'lock' : p.action === 'watermark' ? 'eye' : p.action === 'warn' ? 'alert' : 'bell'} size={15}/></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.n}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    <span className="mono">{p.pat}</span> · {p.surf}
                    {p.note && <span style={{ color: '#f59e0b', marginLeft: 6 }}>· {p.note}</span>}
                  </div>
                </div>
                <span className="k-chip" style={{
                  background: p.action === 'block' ? 'rgba(220,38,38,0.10)' : p.action === 'warn' ? 'rgba(245,158,11,0.12)' : 'rgba(124,58,237,0.10)',
                  color: p.action === 'block' ? '#b91c1c' : p.action === 'warn' ? '#92400e' : '#7c3aed',
                  fontSize: 10,
                }}>{p.action.toUpperCase()}</span>
                <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)', minWidth: 40 }}>{p.hits24}/24h</span>
                <Toggle on={p.on}/>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Recent events">
          <table className="k-table" style={{ width: '100%' }}>
            <thead><tr><th>When</th><th>User</th><th>Action</th><th>Resource</th><th>Policy</th></tr></thead>
            <tbody>
              {[
                { t: '12 min ago', u: 'u5', a: 'blocked', r: 'Attempted to export 12,400 inspections to CSV', p: 'Bulk volume' },
                { t: '28 min ago', u: 'u3', a: 'watermarked', r: 'Downloaded BHS-12 supplier pricing PDF', p: 'Supplier confidential' },
                { t: '1h ago', u: 'u-jorge', a: 'blocked', r: 'Pasted "kn_sk_••••" into AI chat', p: 'API token paste' },
                { t: '2h ago', u: 'u4', a: 'warned', r: 'Forwarded customer NCR PDF externally', p: 'Customer label' },
                { t: '4h ago', u: 'u6', a: 'blocked', r: 'Uploaded scanned visa with Aadhaar visible', p: 'PII upload' },
                { t: '8h ago', u: 'u-anita', a: 'notified', r: 'Downloaded same drawing 6 times', p: 'Behavior threshold' },
              ].map((e, i) => (
                <tr key={i}>
                  <td className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{e.t}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Avatar user={e.u} size={22}/>
                      <span style={{ fontSize: 12 }}>{userById(e.u)?.name?.split(' ')[0]}</span>
                    </div>
                  </td>
                  <td>
                    <span className="k-chip" style={{
                      background: e.a === 'blocked' ? 'rgba(220,38,38,0.10)' : e.a === 'warned' || e.a === 'notified' ? 'rgba(245,158,11,0.12)' : 'rgba(124,58,237,0.10)',
                      color: e.a === 'blocked' ? '#b91c1c' : e.a === 'warned' || e.a === 'notified' ? '#92400e' : '#7c3aed',
                    }}>{e.a}</span>
                  </td>
                  <td style={{ fontSize: 12 }}>{e.r}</td>
                  <td style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{e.p}</td>
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
// BYOK — Bring your own key / Customer-managed keys
// ─────────────────────────────────────────────────────────────
function BYOKKeys({ setRoute }) {
  return (
    <div>
      <PageHeader
        title="Customer-managed keys"
        description="Encrypt customer data at rest with keys you own in your AWS KMS or Azure Key Vault. Rotate any time. Revoke = lockout."
        actions={
          <>
            <button className="k-btn k-btn-ghost"><Icon name="download" size={13}/> Architecture PDF</button>
            <button className="k-btn k-btn-primary"><Icon name="key" size={13}/> Add key</button>
          </>
        }
      />
      <div style={{ padding: '20px 28px 32px' }}>
        <div style={{
          padding: 18, marginBottom: 18,
          background: 'linear-gradient(135deg, #0c4a6e, #1e3a8a)',
          color: 'white', borderRadius: 'var(--r-lg)',
          display: 'flex', alignItems: 'center', gap: 18,
        }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="key" size={26}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Customer-managed encryption active</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4, maxWidth: 540 }}>
              Customer data envelope-encrypted with your AWS KMS key. We never store key material — every read/write makes a KMS call from your account.
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 11, opacity: 0.8 }}>
            <div>KMS calls (24h): <strong className="mono" style={{ color: 'white' }}>184,247</strong></div>
            <div>Last rotation: <strong style={{ color: 'white' }}>87 days ago</strong></div>
          </div>
        </div>

        <Card title="Active keys"
          footer={<button className="k-btn k-btn-primary"><Icon name="plus" size={13}/> Register another</button>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { name: 'precision-auto-prod', vendor: 'AWS KMS', arn: 'arn:aws:kms:ap-south-1:842901234567:key/8a7b2c93-d4e5-f6a7-b8c9-d0e1f2a3b4c5', scope: 'All workspaces', status: 'active', age: 87, lastUse: '4 sec ago' },
              { name: 'precision-auto-eu', vendor: 'Azure Key Vault', arn: '/keyvault/precision-eu/keys/kaenal-prod/v3', scope: 'Bratislava only', status: 'active', age: 22, lastUse: '14 min ago' },
              { name: 'precision-auto-archive', vendor: 'AWS KMS', arn: 'arn:aws:kms:ap-south-1:842901234567:key/legacy-2024', scope: 'Cold storage (S3 Glacier)', status: 'rotating-out', age: 412, lastUse: '8 hours ago' },
            ].map((k, i) => (
              <div key={i} style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 8, background: k.vendor === 'AWS KMS' ? '#ff9900' : '#0078d4', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11 }}>
                    {k.vendor === 'AWS KMS' ? 'AWS' : 'AZ'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{k.name}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 540 }}>{k.arn}</div>
                  </div>
                  {k.status === 'active'
                    ? <span className="k-chip" style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}>Active</span>
                    : <span className="k-chip" style={{ background: 'rgba(245,158,11,0.12)', color: '#92400e' }}>Rotating out</span>}
                  <button className="k-btn-plain" style={{ padding: 6 }}><Icon name="more" size={13}/></button>
                </div>
                <div style={{ display: 'flex', gap: 24, marginTop: 10, fontSize: 11.5, color: 'var(--text-muted)' }}>
                  <span><strong style={{ color: 'var(--text)' }}>Scope:</strong> {k.scope}</span>
                  <span><strong style={{ color: 'var(--text)' }}>Age:</strong> {k.age} days</span>
                  <span><strong style={{ color: 'var(--text)' }}>Last use:</strong> {k.lastUse}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card title="Rotation schedule">
            <Row label="Auto-rotate keys"><Segmented value="365" onChange={() => {}} options={[
              { value: '90', label: '90 days' }, { value: '180', label: '180 days' }, { value: '365', label: '1 year' }, { value: 'manual', label: 'Manual' },
            ]}/></Row>
            <Row label="Re-key envelope on rotation" hint="When set, all data envelopes are re-encrypted in background"><Toggle on={true}/></Row>
            <Row label="Rotation completion alert"><Toggle on={true}/></Row>
            <div style={{ marginTop: 10, padding: 12, background: 'var(--bg-subtle)', borderRadius: 6, fontSize: 11.5 }}>
              <strong>Next rotation:</strong> precision-auto-prod in <strong>278 days</strong> (Feb 19, 2027)
            </div>
          </Card>

          <Card title="Break-glass procedure">
            <Row label="If you revoke a key" hint="Kaenal cannot read your encrypted data; service immediately degrades">
              <span className="k-chip" style={{ background: 'rgba(220,38,38,0.10)', color: '#b91c1c' }}>Hard lockout</span>
            </Row>
            <Row label="Grace period before lockout"><Segmented value="0" onChange={() => {}} options={[
              { value: '0', label: 'Immediate' }, { value: '24h', label: '24h' }, { value: '7d', label: '7 days' },
            ]}/></Row>
            <Row label="Approval required to revoke" hint="2 admin approvals + 24h delay"><Toggle on={true}/></Row>
            <div style={{ marginTop: 10, padding: 12, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, fontSize: 11.5, color: '#7f1d1d' }}>
              <strong>⚠ Test break-glass quarterly.</strong> Last test: 14 days ago — recovery time 12m 40s.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DSARWorkflow, LegalHold, DLPPolicies, BYOKKeys });
