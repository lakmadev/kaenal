// Kaenal — Advanced Identity & Access Management
// SSO (SAML/OIDC), SCIM provisioning, IP allowlists, Session policies,
// Service accounts, Delegated administration

// ─────────────────────────────────────────────────────────────
// SSO CONFIGURATION
// ─────────────────────────────────────────────────────────────
const IDP_PROVIDERS = [
  { id: 'entra', name: 'Microsoft Entra ID', short: 'Entra ID', logo: 'MS', color: '#0078d4', protocols: ['SAML', 'OIDC'], guide: 'docs/entra' },
  { id: 'okta', name: 'Okta', short: 'Okta', logo: 'Okta', color: '#007dc1', protocols: ['SAML', 'OIDC'], guide: 'docs/okta' },
  { id: 'google', name: 'Google Workspace', short: 'Google', logo: 'G', color: '#4285f4', protocols: ['SAML'], guide: 'docs/google' },
  { id: 'auth0', name: 'Auth0 / Okta Customer Identity', short: 'Auth0', logo: 'A0', color: '#eb5424', protocols: ['SAML', 'OIDC'], guide: 'docs/auth0' },
  { id: 'ping', name: 'PingFederate / PingOne', short: 'Ping', logo: 'P', color: '#ff6c00', protocols: ['SAML', 'OIDC'], guide: 'docs/ping' },
  { id: 'onelogin', name: 'OneLogin', short: 'OneLogin', logo: '1L', color: '#1c1f2a', protocols: ['SAML'], guide: 'docs/onelogin' },
  { id: 'jumpcloud', name: 'JumpCloud', short: 'JumpCloud', logo: 'JC', color: '#06acac', protocols: ['SAML', 'OIDC'], guide: 'docs/jumpcloud' },
  { id: 'custom', name: 'Custom SAML / OIDC', short: 'Custom', logo: '⌖', color: '#64748b', protocols: ['SAML', 'OIDC'], guide: 'docs/custom' },
];

function SsoConfig() {
  const [provider, setProvider] = React.useState('entra');
  const [protocol, setProtocol] = React.useState('SAML');
  const [testStatus, setTestStatus] = React.useState(null); // null | 'testing' | 'success' | 'failed'
  const idp = IDP_PROVIDERS.find(p => p.id === provider);

  const runTest = async () => {
    setTestStatus('testing');
    await new Promise(r => setTimeout(r, 1800));
    setTestStatus(Math.random() > 0.15 ? 'success' : 'failed');
  };

  return (
    <SettingsPage title="Single Sign-On"
      subtitle="Configure SAML 2.0 or OIDC to delegate authentication to your identity provider"
      actions={
        <>
          <button onClick={runTest} className="k-btn k-btn-secondary" disabled={testStatus === 'testing'}>
            {testStatus === 'testing' ? <><Icon name="refresh" size={13}/> Testing…</> : <><Icon name="check" size={13}/> Test SSO</>}
          </button>
          <button className="k-btn k-btn-primary"><Icon name="check" size={13}/> Save & enable</button>
        </>
      }>

      {/* Status banner */}
      <div style={{
        padding: 14, marginBottom: 18,
        background: 'var(--success-50)', border: '1px solid var(--success-200, rgba(34,197,94,0.3))',
        borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--success-100)', color: 'var(--success-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="shieldCheck" size={18} stroke={2}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>SSO is active — Microsoft Entra ID (SAML)</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>412 members signing in via SSO · Domain claim verified for <span className="mono">precision-auto.com</span></div>
        </div>
        <Segmented size="sm" value="enforce" onChange={() => {}} options={[
          { value: 'optional', label: 'Optional' },
          { value: 'enforce', label: 'Enforced' },
        ]}/>
      </div>

      {testStatus && testStatus !== 'testing' && (
        <div style={{
          padding: 12, marginBottom: 14,
          background: testStatus === 'success' ? 'var(--success-50)' : 'rgba(220,38,38,0.06)',
          border: `1px solid ${testStatus === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(220,38,38,0.2)'}`,
          borderRadius: 'var(--r-md)', display: 'flex', gap: 10, fontSize: 12.5,
        }}>
          <Icon name={testStatus === 'success' ? 'check' : 'alert'} size={16} stroke={2.5} style={{ color: testStatus === 'success' ? 'var(--success-600)' : '#dc2626' }}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{testStatus === 'success' ? 'SSO test successful' : 'SSO test failed'}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 11.5, marginTop: 2 }}>
              {testStatus === 'success'
                ? 'IdP authenticated test user · all required attributes mapped (email, firstName, lastName, role)'
                : 'IdP response missing required attribute: "department". Update attribute mapping in your IdP.'}
            </div>
          </div>
          <button onClick={() => setTestStatus(null)} className="k-btn-plain" style={{ padding: 4 }}><Icon name="x" size={13}/></button>
        </div>
      )}

      <Card title="Identity provider" desc="Pick your IdP for guided setup, or choose custom for any SAML 2.0 / OIDC provider">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
          {IDP_PROVIDERS.map(p => (
            <button key={p.id} onClick={() => setProvider(p.id)} style={{
              padding: 12, border: provider === p.id ? '2px solid var(--accent)' : '1px solid var(--border)',
              borderRadius: 'var(--r-md)', background: provider === p.id ? 'var(--accent-soft)' : 'var(--surface)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer', textAlign: 'center',
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: p.color, color: 'white', fontWeight: 800, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.04em' }}>{p.logo}</div>
              <div style={{ fontSize: 11.5, fontWeight: 600 }}>{p.short}</div>
            </button>
          ))}
        </div>

        <Row label="Protocol" hint={`Supported by ${idp.short}: ${idp.protocols.join(', ')}`}>
          <Segmented value={protocol} onChange={setProtocol} options={idp.protocols.map(p => ({ value: p, label: p }))}/>
        </Row>
      </Card>

      {/* Service Provider info (we give them this) */}
      <Card title={`Step 1 — Configure ${idp.short} (in your IdP)`} desc={`Use these values when creating a new ${protocol} app in ${idp.short}`}>
        <div style={{ padding: 12, background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {protocol === 'SAML' ? (
            <>
              <CopyField label="Identifier (Entity ID)" value="urn:kaenal:precision-auto"/>
              <CopyField label="Reply URL (ACS)" value="https://auth.kaenal.app/saml/precision-auto/acs"/>
              <CopyField label="Sign-on URL" value="https://precision-auto.kaenal.app"/>
              <CopyField label="Logout URL (SLO)" value="https://auth.kaenal.app/saml/precision-auto/slo"/>
              <CopyField label="Signing certificate" value="MIIDazCCAlOgAwIBAgIUO5..." cert/>
            </>
          ) : (
            <>
              <CopyField label="Redirect URI" value="https://auth.kaenal.app/oidc/precision-auto/callback"/>
              <CopyField label="Post-logout URI" value="https://precision-auto.kaenal.app/auth/logged-out"/>
              <CopyField label="Required scopes" value="openid email profile groups"/>
            </>
          )}
        </div>
      </Card>

      {/* IdP details (they give us) */}
      <Card title={`Step 2 — Paste ${idp.short} details (here)`}>
        {protocol === 'SAML' ? (
          <>
            <Row label="IdP Metadata URL" hint="Recommended — we'll auto-pull and refresh">
              <input className="k-input" defaultValue="https://login.microsoftonline.com/8a7b2c93/federationmetadata/2007-06/federationmetadata.xml"/>
            </Row>
            <Row label="Or upload metadata XML">
              <button className="k-btn k-btn-secondary k-btn-sm"><Icon name="upload" size={12}/> Upload XML</button>
            </Row>
            <Row label="Sign-in URL"><input className="k-input" defaultValue="https://login.microsoftonline.com/8a7b2c93/saml2"/></Row>
            <Row label="Sign-out URL"><input className="k-input" defaultValue="https://login.microsoftonline.com/8a7b2c93/saml2"/></Row>
            <Row label="IdP signing certificate">
              <textarea className="k-input mono" rows={3} defaultValue="MIIDmTCCAoGgAwIBAgIQE/W6kPnYJVKpiZeUiqvxoTANBgkqhk..." style={{ fontSize: 11, height: 80 }}/>
            </Row>
            <Row label="Signature algorithm">
              <Segmented size="sm" value="rsa-sha256" onChange={() => {}} options={[
                { value: 'rsa-sha256', label: 'RSA-SHA256' },
                { value: 'rsa-sha512', label: 'RSA-SHA512' },
              ]}/>
            </Row>
          </>
        ) : (
          <>
            <Row label="OIDC Discovery URL">
              <input className="k-input" defaultValue="https://login.microsoftonline.com/8a7b2c93/v2.0/.well-known/openid-configuration"/>
            </Row>
            <Row label="Client ID"><input className="k-input" defaultValue="3d4e5f6a-7b8c-9d0e-1f2a-3b4c5d6e7f8a"/></Row>
            <Row label="Client Secret"><input className="k-input" type="password" defaultValue="••••••••••••••••••••••••"/></Row>
          </>
        )}
      </Card>

      {/* Attribute mapping */}
      <Card title="Step 3 — Attribute mapping" desc="Map IdP claims to Kaenal user fields">
        <table style={{ width: '100%' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Kaenal field</th>
              <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>IdP claim</th>
              <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', width: 100 }}>Required</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Email', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', true],
              ['First name', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname', true],
              ['Last name', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname', true],
              ['Display name', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name', false],
              ['Department', 'department', false],
              ['Job title', 'jobTitle', false],
              ['Groups', 'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups', false],
              ['Employee ID', 'extension_employeeId', false],
            ].map(([label, claim, req]) => (
              <tr key={label} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 0', fontSize: 13, fontWeight: 500 }}>{label}</td>
                <td style={{ padding: '10px 0' }}>
                  <input className="k-input mono" defaultValue={claim} style={{ fontSize: 11, height: 28, padding: '0 8px' }}/>
                </td>
                <td style={{ padding: '10px 0' }}>
                  {req ? <span className="k-chip" style={{ background: 'rgba(220,38,38,0.10)', color: '#b91c1c', fontSize: 10 }}>Required</span> : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Optional</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* JIT + advanced */}
      <Card title="Advanced">
        <Row label="Just-in-time provisioning" hint="Create user accounts automatically on first sign-in"><Toggle on={true}/></Row>
        <Row label="Default role for JIT" hint="When a new account is auto-created">
          <select className="k-input" defaultValue="inspector" style={{ width: 200 }}>
            <option value="qm">Quality Manager</option>
            <option value="qe">Quality Engineer</option>
            <option value="inspector">Inspector</option>
            <option value="viewer">Read-only</option>
          </select>
        </Row>
        <Row label="Domain claims" hint="Auto-route these email domains to this SSO connection">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['precision-auto.com', 'precisionauto.in'].map(d => (
              <span key={d} className="k-chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                <Icon name="check" size={10} stroke={3}/>{d}
              </span>
            ))}
            <button style={{ padding: '3px 8px', border: '1px dashed var(--border-strong)', borderRadius: 'var(--r-full)', fontSize: 11, color: 'var(--text-muted)', background: 'transparent', cursor: 'pointer' }}>
              <Icon name="plus" size={10}/> Add domain
            </button>
          </div>
        </Row>
        <Row label="Force re-auth for sensitive actions" hint="e.g. approving documents, deleting NCRs"><Toggle on={true}/></Row>
      </Card>
    </SettingsPage>
  );
}

function CopyField({ label, value, cert }) {
  const [copied, setCopied] = React.useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
        <div className="mono" style={{
          flex: 1, padding: '7px 10px', background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
          fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{value}</div>
        <button onClick={copy} className="k-btn k-btn-secondary k-btn-sm" style={{ minWidth: 80 }}>
          <Icon name={copied ? 'check' : 'copy'} size={12}/> {copied ? 'Copied' : 'Copy'}
        </button>
        {cert && <button className="k-btn k-btn-secondary k-btn-sm"><Icon name="download" size={12}/></button>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SCIM PROVISIONING
// ─────────────────────────────────────────────────────────────
function ScimConfig() {
  const [showToken, setShowToken] = React.useState(false);
  return (
    <SettingsPage title="SCIM provisioning"
      subtitle="Automatically provision, update, and deprovision users from your IdP via SCIM 2.0"
      actions={
        <>
          <button className="k-btn k-btn-secondary"><Icon name="refresh" size={13}/> Force full sync</button>
          <button className="k-btn k-btn-primary"><Icon name="check" size={13}/> Save</button>
        </>
      }>
      {/* Status */}
      <div style={{
        padding: 14, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--success-50)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 'var(--r-md)',
      }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(34,197,94,0.18)', color: 'var(--success-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="pulse-dot" style={{ background: '#22c55e', width: 10, height: 10 }}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>SCIM sync healthy — last sync 4 min ago</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>412 active users · 23 pending invites · 4 groups mapped to roles</div>
        </div>
        <span className="k-chip" style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}>Connected</span>
      </div>

      <Card title="SCIM endpoint" desc="Use these values to configure SCIM provisioning in your IdP">
        <div style={{ padding: 12, background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <CopyField label="SCIM base URL" value="https://scim.kaenal.app/v2/precision-auto"/>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>Bearer token</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <div className="mono" style={{
                flex: 1, padding: '7px 10px', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
                fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {showToken ? 'kn_scim_8a7b2c93d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a' : 'kn_scim_••••••••••••••••••••••••••••••••••••'}
              </div>
              <button onClick={() => setShowToken(s => !s)} className="k-btn k-btn-secondary k-btn-sm">
                <Icon name={showToken ? 'eyeOff' : 'eye'} size={12}/>
              </button>
              <button className="k-btn k-btn-secondary k-btn-sm"><Icon name="copy" size={12}/></button>
              <button className="k-btn k-btn-secondary k-btn-sm" style={{ color: '#dc2626' }}><Icon name="refresh" size={12}/> Rotate</button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              Created Mar 12, 2026 · Last used 4 min ago · Expires Mar 12, 2027
            </div>
          </div>
        </div>
      </Card>

      {/* Group → role mapping */}
      <Card title="Group → role mapping" desc="When SCIM creates a user in a group, assign them this role"
        footer={<button className="k-btn k-btn-ghost"><Icon name="plus" size={13}/> Add mapping</button>}>
        <table style={{ width: '100%' }}>
          <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>IdP group</th>
            <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Kaenal role</th>
            <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Scope</th>
            <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, width: 80 }}>Users</th>
            <th></th>
          </tr></thead>
          <tbody>
            {[
              { g: 'precision-auto-quality-admin', r: 'Workspace Admin', s: 'All plants', u: 4, c: '#dc2626' },
              { g: 'precision-auto-quality-mgr-pune', r: 'Quality Manager', s: 'Pune-1', u: 6, c: '#2563eb' },
              { g: 'precision-auto-quality-eng', r: 'Quality Engineer', s: 'All plants', u: 38, c: '#0d9488' },
              { g: 'precision-auto-inspectors', r: 'Inspector', s: 'Assigned area', u: 142, c: '#7c3aed' },
              { g: 'precision-auto-line-supervisor', r: 'Line Supervisor', s: 'Assigned area', u: 34, c: '#ea580c' },
              { g: 'external-auditors', r: 'External Auditor', s: 'Audit period only', u: 8, c: '#f59e0b' },
            ].map(m => (
              <tr key={m.g} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 0' }}><span className="mono" style={{ fontSize: 11.5 }}>{m.g}</span></td>
                <td style={{ padding: '10px 0' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 500 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.c }}/>
                    {m.r}
                  </span>
                </td>
                <td style={{ padding: '10px 0', fontSize: 12, color: 'var(--text-muted)' }}>{m.s}</td>
                <td style={{ padding: '10px 0', fontSize: 12, fontWeight: 600 }}>{m.u}</td>
                <td style={{ padding: '10px 0', textAlign: 'right' }}><button className="k-btn-plain" style={{ padding: 6 }}><Icon name="more" size={13}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Attribute sync */}
      <Card title="Attribute sync">
        <Row label="Sync user profile updates"><Toggle on={true}/></Row>
        <Row label="Deprovision on group removal" hint="When a user is removed from all mapped groups, their account is suspended"><Toggle on={true}/></Row>
        <Row label="Delete after N days of suspension"><input type="number" defaultValue={30} className="k-input" style={{ width: 80 }}/></Row>
        <Row label="Push user updates from Kaenal to IdP" hint="One-way (default) keeps IdP as source of truth"><Toggle on={false}/></Row>
      </Card>

      {/* Sync log */}
      <Card title="Recent sync events" desc="Last 24 hours"
        footer={<button className="k-btn k-btn-ghost"><Icon name="download" size={13}/> Export 90-day log</button>}>
        <table className="k-table" style={{ width: '100%' }}>
          <thead><tr>
            <th style={{ width: 110 }}>When</th>
            <th>Event</th>
            <th>User / Group</th>
            <th style={{ width: 90 }}>Result</th>
          </tr></thead>
          <tbody>
            {[
              { t: '4 min ago', e: 'user.create', who: 'sarah.ahmed@precision-auto.com', r: 'ok' },
              { t: '12 min ago', e: 'user.update', who: 'marcus.lee@precision-auto.com — department changed', r: 'ok' },
              { t: '1h ago', e: 'group.member.add', who: '+ jorge.martinez to quality-eng', r: 'ok' },
              { t: '3h ago', e: 'user.suspend', who: 'carlos.r@precision-auto.com — removed from all groups', r: 'ok' },
              { t: '6h ago', e: 'user.create', who: 'anita.kapoor@precision-auto.com', r: 'fail', err: 'Email domain not in allowed list' },
              { t: '8h ago', e: 'bulk.import', who: '47 users from quality-eng', r: 'ok' },
              { t: 'Yesterday', e: 'group.delete', who: 'legacy-inspectors', r: 'ok' },
            ].map((ev, i) => (
              <tr key={i}>
                <td style={{ fontSize: 11.5, color: 'var(--text-muted)' }} className="mono">{ev.t}</td>
                <td className="mono" style={{ fontSize: 11.5 }}>{ev.e}</td>
                <td style={{ fontSize: 12 }}>
                  {ev.who}
                  {ev.err && <div style={{ fontSize: 10.5, color: '#dc2626', marginTop: 2 }}>{ev.err}</div>}
                </td>
                <td>
                  {ev.r === 'ok'
                    ? <span className="k-chip" style={{ background: 'var(--success-100)', color: 'var(--success-700)', fontSize: 10 }}>✓ Synced</span>
                    : <span className="k-chip" style={{ background: 'rgba(220,38,38,0.10)', color: '#b91c1c', fontSize: 10 }}><Icon name="alert" size={10}/> Failed</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </SettingsPage>
  );
}

// ─────────────────────────────────────────────────────────────
// IP ALLOWLISTS & GEO-FENCING
// ─────────────────────────────────────────────────────────────
function NetworkPolicy() {
  return (
    <SettingsPage title="Network policy" subtitle="IP allowlists, geo-fencing, and VPN requirements"
      actions={<button className="k-btn k-btn-primary"><Icon name="check" size={14}/> Save policy</button>}>

      <Card title="IP allowlist" desc="Only sign-ins from these CIDR ranges are allowed. SSO can bypass with a separate policy."
        footer={
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button className="k-btn k-btn-ghost"><Icon name="upload" size={13}/> Import</button>
            <button className="k-btn k-btn-primary"><Icon name="plus" size={13}/> Add range</button>
          </div>
        }>
        <Row label="Enforcement">
          <Segmented value="enforce" onChange={() => {}} options={[
            { value: 'off', label: 'Off' },
            { value: 'observe', label: 'Observe (log only)' },
            { value: 'enforce', label: 'Enforce (block non-allowlisted)' },
          ]}/>
        </Row>
        <table style={{ width: '100%', marginTop: 12 }}>
          <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>CIDR</th>
            <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Description</th>
            <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Last seen</th>
            <th style={{ width: 100 }}></th>
          </tr></thead>
          <tbody>
            {[
              { c: '192.168.4.0/22', d: 'Pune-1 plant — corporate LAN', l: '2 min ago', hits: 1842 },
              { c: '192.168.8.0/22', d: 'Chennai-2 plant', l: '6 min ago', hits: 1247 },
              { c: '10.45.0.0/16', d: 'Detroit Aluminum plant', l: '14 min ago', hits: 487 },
              { c: '203.0.113.16/28', d: 'Corporate VPN egress (Cloudflare WARP)', l: '1 min ago', hits: 3104 },
              { c: '198.51.100.0/24', d: 'Plant Wi-Fi (BYOD)', l: '8 min ago', hits: 762 },
            ].map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 0' }} className="mono"><strong style={{ fontSize: 13 }}>{r.c}</strong></td>
                <td style={{ padding: '10px 0', fontSize: 12.5 }}>{r.d}</td>
                <td style={{ padding: '10px 0', fontSize: 11.5, color: 'var(--text-muted)' }}>{r.l} · {r.hits.toLocaleString()} hits</td>
                <td style={{ padding: '10px 0', textAlign: 'right' }}>
                  <button className="k-btn-plain" style={{ padding: 6 }}><Icon name="edit" size={13}/></button>
                  <button className="k-btn-plain" style={{ padding: 6, color: 'var(--text-muted)' }}><Icon name="trash" size={13}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 14, padding: 12, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--r-md)', display: 'flex', gap: 10 }}>
          <Icon name="alert" size={16} style={{ color: '#f59e0b' }}/>
          <div style={{ fontSize: 12, color: 'var(--text)' }}>
            Your current IP <strong className="mono">192.168.4.18</strong> is in <strong>Pune-1 plant</strong> and is allowlisted.
            Enforcement is currently active.
          </div>
        </div>
      </Card>

      {/* Geo */}
      <Card title="Geo-fencing" desc="Restrict access by country">
        <Row label="Mode">
          <Segmented value="allow" onChange={() => {}} options={[
            { value: 'off', label: 'Off' },
            { value: 'allow', label: 'Allowlist countries' },
            { value: 'deny', label: 'Blocklist countries' },
          ]}/>
        </Row>
        <Row label="Allowed countries">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[
              { c: '🇮🇳', n: 'India', primary: true },
              { c: '🇺🇸', n: 'United States' },
              { c: '🇸🇰', n: 'Slovakia' },
              { c: '🇩🇪', n: 'Germany' },
              { c: '🇬🇧', n: 'United Kingdom' },
              { c: '🇸🇬', n: 'Singapore' },
            ].map(co => (
              <span key={co.n} className="k-chip" style={{ background: co.primary ? 'var(--accent-soft)' : 'var(--bg-subtle)', color: co.primary ? 'var(--accent)' : 'var(--text)', fontSize: 12, padding: '4px 10px' }}>
                <span style={{ fontSize: 14 }}>{co.c}</span>{co.n}
              </span>
            ))}
            <button style={{ padding: '3px 10px', border: '1px dashed var(--border-strong)', borderRadius: 'var(--r-full)', fontSize: 12, color: 'var(--text-muted)', background: 'transparent', cursor: 'pointer' }}>
              <Icon name="plus" size={11}/> Add country
            </button>
          </div>
        </Row>
        <Row label="Block from sanctioned regions" hint="OFAC + EU sanctions auto-applied"><Toggle on={true}/></Row>
        <Row label="Block known anonymizing proxies" hint="Tor, public VPNs, residential proxies"><Toggle on={true}/></Row>
      </Card>

      {/* Recent blocks */}
      <Card title="Recent blocked attempts">
        <table className="k-table" style={{ width: '100%' }}>
          <thead><tr><th style={{ width: 100 }}>When</th><th>IP</th><th>Country</th><th>Reason</th><th>User</th></tr></thead>
          <tbody>
            {[
              { t: '34 min ago', ip: '203.0.113.42', co: 'Unknown (VPN)', r: 'Anonymizing proxy', u: 'priya.iyer@…' },
              { t: '2h ago', ip: '198.18.42.91', co: '🇷🇺 Russia', r: 'Country blocked', u: 'unknown' },
              { t: '8h ago', ip: '45.83.21.18', co: '🇳🇱 Netherlands', r: 'Outside allowlist', u: 'marcus.lee@…' },
              { t: 'Yesterday', ip: '101.20.4.15', co: '🇨🇳 China', r: 'Country blocked', u: 'unknown' },
            ].map((r, i) => (
              <tr key={i}>
                <td className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{r.t}</td>
                <td className="mono" style={{ fontSize: 12 }}>{r.ip}</td>
                <td style={{ fontSize: 12 }}>{r.co}</td>
                <td><span className="k-chip" style={{ background: 'rgba(220,38,38,0.10)', color: '#b91c1c', fontSize: 11 }}>{r.r}</span></td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.u}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </SettingsPage>
  );
}

// ─────────────────────────────────────────────────────────────
// SESSION POLICIES
// ─────────────────────────────────────────────────────────────
function SessionPolicies() {
  return (
    <SettingsPage title="Session policies" subtitle="Control session lifetime, concurrency, and re-authentication"
      actions={<button className="k-btn k-btn-primary"><Icon name="check" size={14}/> Save</button>}>

      <Card title="Web session lifetime">
        <Row label="Idle timeout" hint="Sign user out after this period of inactivity">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="number" defaultValue={30} className="k-input" style={{ width: 80 }}/>
            <select className="k-input" defaultValue="min" style={{ width: 110 }}>
              <option value="min">minutes</option>
              <option value="hour">hours</option>
            </select>
          </div>
        </Row>
        <Row label="Absolute timeout" hint="Hard maximum regardless of activity">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="number" defaultValue={12} className="k-input" style={{ width: 80 }}/>
            <select className="k-input" defaultValue="hour" style={{ width: 110 }}>
              <option value="hour">hours</option>
              <option value="day">days</option>
            </select>
          </div>
        </Row>
        <Row label="Remember device duration" hint="When 'Trust this device' is checked">
          <Segmented value="30d" onChange={() => {}} options={[
            { value: '7d', label: '7 days' },
            { value: '30d', label: '30 days' },
            { value: '90d', label: '90 days' },
            { value: 'off', label: 'Off' },
          ]}/>
        </Row>
      </Card>

      <Card title="Mobile session lifetime">
        <Row label="Idle timeout" hint="Mobile inspector app — when phone is locked or app backgrounded">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="number" defaultValue={8} className="k-input" style={{ width: 80 }}/>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>hours</span>
          </div>
        </Row>
        <Row label="Require biometric on resume" hint="Face ID / Touch ID when reopening the app"><Toggle on={true}/></Row>
        <Row label="Wipe local data on logout" hint="Offline queue + cached photos"><Toggle on={true}/></Row>
      </Card>

      <Card title="Concurrent sessions">
        <Row label="Max sessions per user" hint="Sign out oldest when exceeded">
          <Segmented value="3" onChange={() => {}} options={[
            { value: '1', label: '1 (single sign-on)' },
            { value: '3', label: '3' },
            { value: '5', label: '5' },
            { value: 'unl', label: 'Unlimited' },
          ]}/>
        </Row>
        <Row label="Notify user when new device signs in" hint="Email + push"><Toggle on={true}/></Row>
      </Card>

      <Card title="Step-up authentication" desc="Require fresh authentication for sensitive operations">
        <Row label="Trigger threshold">
          <Segmented value="15m" onChange={() => {}} options={[
            { value: '5m', label: '5 min' },
            { value: '15m', label: '15 min' },
            { value: '1h', label: '1 hour' },
            { value: '4h', label: '4 hours' },
          ]}/>
        </Row>
        <Row label="Step-up required for">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              'Approving documents',
              'Closing critical NCRs',
              'Disposition: scrap or use-as-is',
              'Deleting any record',
              'Changing permissions',
              'Rotating API tokens',
              'Configuring integrations',
              'Viewing PII / personal data',
            ].map(o => (
              <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                <input type="checkbox" defaultChecked={!['Deleting any record', 'Viewing PII / personal data'].includes(o)} style={{ accentColor: 'var(--accent)' }}/>
                {o}
              </label>
            ))}
          </div>
        </Row>
      </Card>

      <Card title="Workforce safety">
        <Row label="Off-hours sign-in alerts" hint="Alert admins on logins outside 6am–10pm local"><Toggle on={true}/></Row>
        <Row label="Impossible-travel detection" hint="Sign-ins from far-apart locations within minutes"><Toggle on={true}/></Row>
        <Row label="Suspicious-pattern lockout" hint="Auto-lock after suspicious behavior pattern"><Toggle on={true}/></Row>
        <Row label="Allow personal device sign-in" hint="When off, only managed devices can sign in"><Toggle on={true}/></Row>
      </Card>
    </SettingsPage>
  );
}

// ─────────────────────────────────────────────────────────────
// SERVICE ACCOUNTS
// ─────────────────────────────────────────────────────────────
function ServiceAccounts() {
  return (
    <SettingsPage title="Service accounts"
      subtitle="Non-human identities for machine-to-machine integrations. Separate from user accounts and not subject to MFA."
      actions={<button className="k-btn k-btn-primary"><Icon name="plus" size={14}/> New service account</button>}>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
        {[
          { l: 'Active accounts', v: '8', c: '#2563eb', i: 'key' },
          { l: 'API calls (24h)', v: '184K', c: '#16a34a', i: 'code' },
          { l: 'Failed auth (24h)', v: '0', c: '#16a34a', i: 'shieldCheck' },
          { l: 'Keys expiring < 30d', v: '2', c: '#f59e0b', i: 'clock' },
        ].map(k => (
          <div key={k.l} className="k-surface" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: k.c + '18', color: k.c, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={k.i} size={16}/></div>
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{k.l}</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{k.v}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="k-surface" style={{ overflow: 'hidden' }}>
        <table className="k-table" style={{ width: '100%' }}>
          <thead><tr>
            <th>Account</th>
            <th>Scopes</th>
            <th>Keys</th>
            <th>Last used</th>
            <th>Calls (24h)</th>
            <th></th>
          </tr></thead>
          <tbody>
            {[
              { n: 'sap-erp-integration', d: 'SAP S/4HANA · production order sync', sc: ['inspections:read', 'inspections:write', 'ncr:read'], k: 2, l: '12 min ago', c: '47.2K', warn: false },
              { n: 'hexagon-cmm-bridge', d: 'CMM result auto-import', sc: ['inspections:write', 'documents:write'], k: 1, l: '38 min ago', c: '12.4K', warn: false },
              { n: 'mes-opcenter-events', d: 'Siemens Opcenter SPC alarms', sc: ['inspections:write'], k: 1, l: '2 min ago', c: '78.4K', warn: false },
              { n: 'snowflake-bi-pipeline', d: 'Nightly BI ETL', sc: ['reports:read', 'audit:read'], k: 1, l: '6 hours ago', c: '128', warn: false },
              { n: 'siem-audit-export', d: 'Splunk audit log forwarder', sc: ['audit:read'], k: 1, l: '4 min ago', c: '8.6K', warn: true, warnMsg: 'Key expires in 18 days' },
              { n: 'docusign-callback', d: 'Document e-signature webhook', sc: ['documents:write'], k: 1, l: 'Yesterday', c: '24', warn: false },
              { n: 'customer-volvo-portal', d: 'Customer NCR shared portal', sc: ['ncr:read', '8d:read'], k: 1, l: 'Yesterday', c: '8', warn: false },
              { n: 'legacy-cmm-mitutoyo', d: 'DEPRECATED — Mitutoyo CMM legacy bridge', sc: ['inspections:write'], k: 1, l: '3 weeks ago', c: '0', warn: true, warnMsg: 'Unused 21 days — consider revoking' },
            ].map(sa => (
              <tr key={sa.n}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--bg-subtle)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="bot" size={14}/>
                    </div>
                    <div>
                      <div className="mono" style={{ fontSize: 12.5, fontWeight: 600 }}>{sa.n}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sa.d}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {sa.sc.slice(0, 2).map(s => (
                      <span key={s} className="k-chip mono" style={{ background: 'var(--bg-subtle)', fontSize: 10 }}>{s}</span>
                    ))}
                    {sa.sc.length > 2 && <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>+{sa.sc.length - 2}</span>}
                  </div>
                </td>
                <td style={{ fontSize: 12 }}>{sa.k}</td>
                <td style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  {sa.l}
                  {sa.warn && <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Icon name="alert" size={10}/>{sa.warnMsg}
                  </div>}
                </td>
                <td className="mono" style={{ fontSize: 12 }}>{sa.c}</td>
                <td><button className="k-btn-plain" style={{ padding: 6 }}><Icon name="more" size={14}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 18, padding: 14, background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Icon name="shieldCheck" size={18}/>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>Key rotation policy</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Service account keys auto-expire after 365 days. Warning email at T-30 days. Long-lived alternatives: mTLS, AWS IAM Role assumption.</div>
        </div>
        <button className="k-btn k-btn-secondary k-btn-sm">Configure policy</button>
      </div>
    </SettingsPage>
  );
}

// ─────────────────────────────────────────────────────────────
// DELEGATED ADMINISTRATION
// ─────────────────────────────────────────────────────────────
function DelegatedAdmin() {
  return (
    <SettingsPage title="Delegated administration"
      subtitle="Grant scoped admin rights to plant directors, site QMs, and external auditors without giving full workspace admin"
      actions={<button className="k-btn k-btn-primary"><Icon name="plus" size={14}/> Delegate admin</button>}>

      <Card title="Active delegations">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { user: 'u1', name: 'Manjunath Kumar', role: 'Workspace Admin', scope: 'Global', scopeColor: '#dc2626', perms: ['All permissions'], rotation: 'No expiration · permanent' },
            { user: 'u2', name: 'Anna Schmidt', role: 'Site QM — Detroit Aluminum', scope: 'Detroit Aluminum plant only', scopeColor: '#7c3aed',
              perms: ['Invite members', 'Approve documents', 'Close NCRs', 'Manage inspection templates', 'View audit log (scoped)'],
              rotation: 'Reviewed quarterly · next review Jul 15' },
            { user: 'u4', name: 'Sarah Ahmed', role: 'Plant Director — Pune-1', scope: 'Pune-1 plant only', scopeColor: '#2563eb',
              perms: ['Approve documents', 'Close NCRs', 'View all reports (Pune-1)'],
              rotation: 'Reviewed quarterly · next review Jul 15' },
            { user: 'u3', name: 'Yuki Tanaka', role: 'External Auditor — IATF re-cert', scope: 'Audit AUD-2026-0021 evidence only', scopeColor: '#f59e0b',
              perms: ['View inspection records (audit period)', 'View documents (audit period)', 'Read audit findings'],
              rotation: 'Expires May 31, 2026 (after audit close)', expiring: true },
            { user: 'u5', name: 'Jorge Martinez', role: 'Helpdesk — Plant Support', scope: 'Pune-1 + Chennai-2', scopeColor: '#0d9488',
              perms: ['Reset user passwords', 'Resend invite emails', 'View login activity'],
              rotation: 'No expiration · permanent' },
          ].map((d, i) => (
            <div key={i} style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
                <Avatar user={d.user} size={40}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{d.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.role}</div>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 'var(--r-full)', fontSize: 11.5, fontWeight: 600, background: d.scopeColor + '18', color: d.scopeColor }}>
                  <Icon name="mapPin" size={11}/> {d.scope}
                </span>
                {d.expiring && <span className="k-chip" style={{ background: 'rgba(245,158,11,0.12)', color: '#92400e' }}><Icon name="clock" size={10}/> Expiring</span>}
                <button className="k-btn-plain" style={{ padding: 6 }}><Icon name="more" size={14}/></button>
              </div>
              <div style={{ paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: 6 }}>Granted permissions</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                  {d.perms.map(p => (
                    <span key={p} className="k-chip" style={{ background: 'var(--bg-subtle)', fontSize: 11 }}>
                      <Icon name="check" size={10} stroke={3} style={{ color: 'var(--success-600)' }}/>
                      {p}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Icon name="clock" size={11}/>{d.rotation}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Privileged Access Management (PAM)" desc="Time-bound elevation for break-glass scenarios">
        <Row label="Require approval for admin elevation" hint="A second admin must approve any temporary privilege grant"><Toggle on={true}/></Row>
        <Row label="Maximum elevation duration"><Segmented value="4h" onChange={() => {}} options={[
          { value: '1h', label: '1 hour' },
          { value: '4h', label: '4 hours' },
          { value: '8h', label: '8 hours' },
          { value: '24h', label: '24 hours' },
        ]}/></Row>
        <Row label="Record session video" hint="Capture screen for full audit trail during elevation"><Toggle on={false}/></Row>
        <Row label="Slack notification on elevation"><Toggle on={true}/></Row>
        <Row label="Notify all admins on grant" hint="Even ones not approving the elevation"><Toggle on={true}/></Row>
      </Card>

      <Card title="Recent admin actions" desc="Privileged operations audit feed">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { who: 'u1', t: '4 min ago', a: 'Granted "Site QM" delegation', target: 'to Anna Schmidt for Detroit Aluminum', sensitive: false },
            { who: 'u1', t: '2h ago', a: 'Rotated SCIM bearer token', target: 'Microsoft Entra ID connector', sensitive: true },
            { who: 'u2', t: 'Yesterday', a: 'Approved document', target: 'Welding Process Control Plan v4.3', sensitive: false },
            { who: 'u1', t: 'Yesterday', a: 'PAM elevation granted', target: 'to Jorge Martinez (helpdesk → tier-2) for 4h', sensitive: true },
            { who: 'u1', t: '3 days ago', a: 'Added IP range', target: '203.0.113.16/28 — Cloudflare WARP corporate VPN', sensitive: true },
          ].map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: a.sensitive ? 'rgba(245,158,11,0.06)' : 'var(--bg-subtle)', borderRadius: 6 }}>
              <Avatar user={a.who} size={22}/>
              <div style={{ flex: 1, fontSize: 12.5 }}>
                <strong>{userById(a.who)?.name?.split(' ')[0]}</strong> {a.a} <span style={{ color: 'var(--text-muted)' }}>— {a.target}</span>
              </div>
              {a.sensitive && <span className="k-chip" style={{ background: 'rgba(245,158,11,0.12)', color: '#92400e', fontSize: 10 }}>Sensitive</span>}
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.t}</span>
            </div>
          ))}
        </div>
      </Card>
    </SettingsPage>
  );
}

Object.assign(window, { SsoConfig, ScimConfig, NetworkPolicy, SessionPolicies, ServiceAccounts, DelegatedAdmin, TrustCenter: window.TrustCenter });
