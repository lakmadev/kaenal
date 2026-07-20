// Kaenal — Trust Center
// Compliance certificates, sub-processors, security controls, audit reports

const CERTIFICATIONS = [
  { id: 'soc2', name: 'SOC 2 Type II', issuer: 'A-LIGN', status: 'current', expires: '2026-09-15', scope: 'Security, Availability, Confidentiality', logo: '⌖', color: '#2563eb' },
  { id: 'iso27001', name: 'ISO 27001:2022', issuer: 'BSI', status: 'current', expires: '2027-02-28', scope: 'ISMS — Information Security', logo: 'ISO', color: '#0d9488' },
  { id: 'iso27017', name: 'ISO 27017:2015', issuer: 'BSI', status: 'current', expires: '2027-02-28', scope: 'Cloud-specific controls', logo: 'ISO', color: '#0d9488' },
  { id: 'iso27018', name: 'ISO 27018:2019', issuer: 'BSI', status: 'current', expires: '2027-02-28', scope: 'PII in public cloud', logo: 'ISO', color: '#0d9488' },
  { id: 'gdpr', name: 'GDPR', issuer: 'Self-attested + ext. audit', status: 'current', expires: 'Continuous', scope: 'EU data protection', logo: 'EU', color: '#1e3a8a' },
  { id: 'ccpa', name: 'CCPA / CPRA', issuer: 'Self-attested', status: 'current', expires: 'Continuous', scope: 'California privacy', logo: 'CA', color: '#dc2626' },
  { id: 'hipaa', name: 'HIPAA (BAA available)', issuer: 'Self-attested + ext. audit', status: 'current', expires: 'Continuous', scope: 'PHI handling', logo: 'HIP', color: '#7c3aed' },
  { id: 'fedramp', name: 'FedRAMP Moderate', issuer: '3PAO — Coalfire', status: 'inProgress', expires: 'Q3 2026', scope: 'US Gov cloud workloads', logo: 'GOV', color: '#0891b2' },
  { id: 'tisax', name: 'TISAX Level 3', issuer: 'ENX Association', status: 'current', expires: '2026-11-04', scope: 'Automotive supplier security', logo: 'TX', color: '#ea580c' },
  { id: 'csa-star', name: 'CSA STAR Level 2', issuer: 'BSI', status: 'current', expires: '2026-08-19', scope: 'Cloud security maturity', logo: 'CSA', color: '#16a34a' },
];

const SUBPROCESSORS = [
  { name: 'Amazon Web Services', purpose: 'Primary infrastructure & storage', region: 'EU-West (Frankfurt), AP-South (Mumbai), US-East (Virginia)', country: 'US (HQ)', dpa: true, since: '2021' },
  { name: 'Anthropic', purpose: 'AI inference for root-cause analysis & summaries', region: 'US-East', country: 'US', dpa: true, since: '2024' },
  { name: 'Cloudflare', purpose: 'Edge CDN, DDoS protection, WAF', region: 'Global', country: 'US', dpa: true, since: '2021' },
  { name: 'Datadog', purpose: 'Application performance monitoring & logs', region: 'EU + US', country: 'US', dpa: true, since: '2022' },
  { name: 'Sentry', purpose: 'Error tracking', region: 'EU-only routing', country: 'US', dpa: true, since: '2022' },
  { name: 'SendGrid (Twilio)', purpose: 'Transactional email delivery', region: 'EU + US', country: 'US', dpa: true, since: '2021' },
  { name: 'Twilio', purpose: 'SMS for critical NCR alerts', region: 'Global', country: 'US', dpa: true, since: '2022' },
  { name: 'Stripe', purpose: 'Payment processing (billing)', region: 'EU + US', country: 'US', dpa: true, since: '2021' },
  { name: 'PagerDuty', purpose: 'Internal on-call incident management', region: 'US', country: 'US', dpa: true, since: '2022' },
  { name: 'GitHub', purpose: 'Source code management & CI/CD', region: 'US', country: 'US', dpa: true, since: '2021' },
  { name: 'Linear', purpose: 'Internal product issue tracking (no customer data)', region: 'US', country: 'US', dpa: false, since: '2022' },
];

const SECURITY_CONTROLS = [
  { cat: 'Data protection', items: [
    { l: 'Encryption at rest', d: 'AES-256-GCM for all customer data', ok: true },
    { l: 'Encryption in transit', d: 'TLS 1.3 minimum; HSTS preload', ok: true },
    { l: 'Customer-managed keys (BYOK)', d: 'AWS KMS or Azure Key Vault — Enterprise plan', ok: true },
    { l: 'Field-level encryption', d: 'PII fields encrypted with per-tenant key', ok: true },
    { l: 'Tokenization for high-sensitivity fields', d: 'Operator IDs & signatures', ok: true },
  ]},
  { cat: 'Access & authentication', items: [
    { l: 'SAML 2.0 + OIDC SSO', d: 'Microsoft Entra, Okta, Google, Auth0, Ping, Auth0, custom', ok: true },
    { l: 'SCIM 2.0 provisioning', d: 'Auto-provision / deprovision via IdP', ok: true },
    { l: 'MFA required', d: 'TOTP, WebAuthn, hardware keys', ok: true },
    { l: 'IP allowlists & geo-fencing', d: 'Workspace-level network policy', ok: true },
    { l: 'Session policies', d: 'Idle/absolute timeouts, max concurrent sessions', ok: true },
  ]},
  { cat: 'Resilience', items: [
    { l: 'Multi-AZ active-active', d: 'Zero downtime for AZ failure', ok: true },
    { l: 'Daily backups', d: '35-day retention, cross-region replication', ok: true },
    { l: 'RPO ≤ 1 hour', d: 'Recovery Point Objective', ok: true },
    { l: 'RTO ≤ 4 hours', d: 'Recovery Time Objective', ok: true },
    { l: '99.95% uptime SLA', d: 'Last 12 months: 99.992%', ok: true },
  ]},
  { cat: 'Monitoring & response', items: [
    { l: '24×7 SOC', d: 'Tier-3 SOC with quarterly tabletop exercises', ok: true },
    { l: 'SIEM with 1-year hot retention', d: 'CloudTrail + app logs in SIEM', ok: true },
    { l: 'Bug bounty (HackerOne)', d: 'Public program since 2023', ok: true },
    { l: 'Penetration testing', d: 'Annual external + quarterly internal', ok: true },
    { l: 'Incident response runbooks', d: 'Tabletop tested quarterly', ok: true },
  ]},
];

const REPORTS = [
  { name: 'SOC 2 Type II Report', date: 'Mar 2026', size: '2.1 MB', kind: 'pdf', nda: true },
  { name: 'ISO 27001 Certificate', date: 'Feb 2026', size: '184 KB', kind: 'pdf', nda: false },
  { name: 'Penetration Test Report (Q1 2026)', date: 'Apr 2026', size: '4.8 MB', kind: 'pdf', nda: true },
  { name: 'CAIQ v4.0 (CSA Cloud Controls)', date: 'Feb 2026', size: '420 KB', kind: 'xlsx', nda: false },
  { name: 'SIG Lite 2026', date: 'Feb 2026', size: '380 KB', kind: 'xlsx', nda: true },
  { name: 'GDPR Data Processing Agreement (DPA)', date: 'Continuous', size: '210 KB', kind: 'pdf', nda: false },
  { name: 'Standard Contractual Clauses (SCC)', date: 'Continuous', size: '180 KB', kind: 'pdf', nda: false },
  { name: 'Business Continuity Plan summary', date: 'Jan 2026', size: '620 KB', kind: 'pdf', nda: true },
];

function TrustCenter() {
  return (
    <SettingsPage title="Trust Center" subtitle="Compliance posture, sub-processors, security controls, and audit reports"
      actions={
        <>
          <button className="k-btn k-btn-secondary"><Icon name="bell" size={14}/> Subscribe to updates</button>
          <button className="k-btn k-btn-secondary"><Icon name="external" size={14}/> Public trust page</button>
        </>
      }>
      {/* Hero posture */}
      <div style={{
        padding: 20, marginBottom: 18,
        background: 'linear-gradient(135deg, #1e3a8a, #312e81 60%, #4c1d95)',
        color: 'white', borderRadius: 'var(--r-lg)',
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 20,
      }}>
        <div style={{ gridColumn: '1 / 3', display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(34,197,94,0.18)', border: '2px solid rgba(34,197,94,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon name="shieldCheck" size={32} stroke={2}/>
          </div>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.12em', fontWeight: 700, opacity: 0.7 }}>SECURITY POSTURE</div>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.01em', margin: '4px 0' }}>Enterprise-grade</div>
            <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.5, maxWidth: 360 }}>
              SOC 2 Type II · ISO 27001/17/18 · TISAX L3 · GDPR · HIPAA-ready · FedRAMP Moderate in progress
            </div>
          </div>
        </div>
        {[
          { l: 'Last security incident', v: '0', s: '12 months' },
          { l: 'Uptime', v: '99.99%', s: 'Last 12 months' },
          { l: 'Pen tests / year', v: '5', s: '1 external + 4 internal' },
          { l: 'Open critical CVEs', v: '0', s: 'SLA: < 24h' },
          { l: 'Sub-processors', v: SUBPROCESSORS.length, s: '11 with DPA, 1 ops-only' },
          { l: 'Mean time to patch', v: '8h', s: 'Critical severity' },
        ].slice(0, 4).map(s => (
          <div key={s.l} style={{ borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: 14 }}>
            <div style={{ fontSize: 10, opacity: 0.7, letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>{s.l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{s.v}</div>
            <div style={{ fontSize: 10.5, opacity: 0.7, marginTop: 3 }}>{s.s}</div>
          </div>
        ))}
      </div>

      {/* Certifications */}
      <Card title="Certifications & attestations" desc="Current third-party verified compliance">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {CERTIFICATIONS.map(c => (
            <div key={c.id} style={{
              padding: 14, border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
              display: 'flex', flexDirection: 'column', gap: 8,
              background: c.status === 'inProgress' ? 'var(--bg-subtle)' : 'var(--surface)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 8, background: c.color + '18', color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11 }}>
                  {c.logo}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{c.issuer}</div>
                </div>
                {c.status === 'current' ? (
                  <Icon name="check" size={16} stroke={2.5} style={{ color: 'var(--success-600)' }}/>
                ) : (
                  <Icon name="clock" size={16} style={{ color: 'var(--warning-600)' }}/>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{c.scope}</div>
              <div style={{ fontSize: 10.5, color: c.status === 'inProgress' ? 'var(--warning-700)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 'auto' }}>
                <Icon name="calendar" size={10}/>
                {c.status === 'inProgress' ? 'Target: ' : 'Expires: '}{c.expires}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Audit reports */}
      <Card title="Audit reports & questionnaires" desc="Downloadable. NDA-gated items require a signed mutual NDA — admin can request.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {REPORTS.map((r, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 6, background: r.kind === 'pdf' ? 'rgba(220,38,38,0.10)' : 'rgba(22,163,74,0.10)', color: r.kind === 'pdf' ? '#dc2626' : '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', flexShrink: 0 }}>
                {r.kind.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{r.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Updated {r.date} · {r.size}</div>
              </div>
              {r.nda && <span className="k-chip" style={{ background: 'rgba(245,158,11,0.12)', color: '#92400e', fontSize: 10 }}>
                <Icon name="lock" size={10}/> NDA required
              </span>}
              <button className="k-btn k-btn-secondary k-btn-sm">
                <Icon name="download" size={13}/> {r.nda ? 'Request' : 'Download'}
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* Security controls */}
      <Card title="Security controls" desc="What we do, in detail">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {SECURITY_CONTROLS.map(g => (
            <div key={g.cat}>
              <div className="k-overline" style={{ marginBottom: 10 }}>{g.cat}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {g.items.map(it => (
                  <div key={it.l} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 20, height: 20, borderRadius: 4, background: 'var(--success-100)', color: 'var(--success-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon name="check" size={11} stroke={3}/>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{it.l}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{it.d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Sub-processors */}
      <Card title="Sub-processors" desc="Third parties that process customer data on our behalf. Notification 30 days before any addition.">
        <table className="k-table" style={{ width: '100%' }}>
          <thead><tr>
            <th>Vendor</th>
            <th>Purpose</th>
            <th>Region</th>
            <th>HQ</th>
            <th>DPA</th>
            <th>Since</th>
          </tr></thead>
          <tbody>
            {SUBPROCESSORS.map(s => (
              <tr key={s.name}>
                <td><strong style={{ fontSize: 13 }}>{s.name}</strong></td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.purpose}</td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.region}</td>
                <td style={{ fontSize: 12 }}>{s.country}</td>
                <td>
                  {s.dpa ? (
                    <span className="k-chip" style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}><Icon name="check" size={10} stroke={3}/>Signed</span>
                  ) : (
                    <span className="k-chip" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>—</span>
                  )}
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.since}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Vulnerability disclosure */}
      <Card title="Responsible disclosure & bug bounty">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(124,58,237,0.10)', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="shieldCheck" size={18}/>
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>HackerOne Bug Bounty</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Public since 2023</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
              Bounties: $500–$25,000 based on severity. 312 reports triaged, 47 paid in last 12 months.
            </div>
            <button className="k-btn k-btn-secondary k-btn-sm"><Icon name="external" size={12}/> View program</button>
          </div>
          <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(37,99,235,0.10)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="mail" size={18}/>
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>security@kaenal.app</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>For non-bounty reports</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
              PGP-encrypted reports preferred. Initial response within 1 business day. <br/>
              Fingerprint: <span className="mono" style={{ fontSize: 11 }}>A2F3 88B1 9D7C E45A</span>
            </div>
            <button className="k-btn k-btn-secondary k-btn-sm"><Icon name="download" size={12}/> Download PGP key</button>
          </div>
        </div>
      </Card>

      {/* Status & SLA */}
      <Card title="Operational status">
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} className="pulse-dot"/>
              <span style={{ fontSize: 14, fontWeight: 600 }}>All systems operational</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Last updated 2 min ago</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { l: 'API', up: 99.998 },
                { l: 'Web app', up: 99.995 },
                { l: 'AI services', up: 99.96 },
                { l: 'Mobile sync', up: 99.99 },
                { l: 'Integrations', up: 99.94 },
              ].map(s => (
                <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', background: 'var(--bg-subtle)', borderRadius: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.up >= 99.95 ? '#22c55e' : '#f59e0b' }}/>
                  <span style={{ flex: 1, fontSize: 12.5 }}>{s.l}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.up}%</span>
                </div>
              ))}
            </div>
            <button className="k-btn k-btn-secondary k-btn-sm" style={{ marginTop: 12 }}>
              <Icon name="external" size={12}/> Public status page
            </button>
          </div>
          <div style={{ padding: 14, background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)' }}>
            <div className="k-overline" style={{ marginBottom: 8 }}>Uptime — last 90 days</div>
            <div style={{ display: 'flex', gap: 1.5, height: 32, marginBottom: 10 }}>
              {Array.from({ length: 90 }).map((_, i) => {
                const incident = i === 22 || i === 67;
                return <div key={i} style={{ flex: 1, background: incident ? '#f59e0b' : '#22c55e', borderRadius: 1, minWidth: 2 }} title={`Day ${i + 1}`}/>;
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
              <span>90 days ago</span>
              <span>Today</span>
            </div>
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>2 incidents</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total downtime: 18m 24s</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>SLA credit applied: $0</div>
            </div>
          </div>
        </div>
      </Card>
    </SettingsPage>
  );
}

Object.assign(window, { TrustCenter });
