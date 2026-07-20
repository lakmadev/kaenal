// Kaenal — Multi-tenancy at scale
// Parent/child organizations, White-label branding, Cross-tenant analytics,
// Workspace clone/migrate/export, Department/cost-center hierarchy + chargeback

function MultiTenancyHub({ initialTab }) {
  const [tab, setTab] = React.useState(initialTab || 'orgs');
  React.useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab]);
  const tabs = [
    { id: 'orgs', label: 'Org hierarchy', icon: 'building' },
    { id: 'whitelabel', label: 'White-label branding', icon: 'sparkles' },
    { id: 'analytics', label: 'Cross-tenant analytics', icon: 'reports' },
    { id: 'lifecycle', label: 'Clone / migrate / export', icon: 'refresh' },
    { id: 'chargeback', label: 'Cost centers & chargeback', icon: 'fileText' },
  ];

  return (
    <div>
      <PageHeader
        title="Multi-tenancy"
        description="Run a corporate parent over many plant tenants. Configure them, brand them, attribute costs, and see them all in one view."
        actions={<button className="k-btn k-btn-primary" onClick={() => kToast('New child workspace — pick a region & template to provision')}><Icon name="plus" size={13}/> Add child workspace</button>}
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
        {tab === 'orgs' && <OrgHierarchy/>}
        {tab === 'whitelabel' && <WhiteLabelEditor/>}
        {tab === 'analytics' && <CrossTenantAnalytics/>}
        {tab === 'lifecycle' && <WorkspaceLifecycle/>}
        {tab === 'chargeback' && <CostCenters/>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Parent/child workspace hierarchy
// ─────────────────────────────────────────────────────────────
const ORG_TREE = {
  name: 'Precision Auto Components Pvt. Ltd.',
  slug: 'precision-auto',
  role: 'parent',
  members: 412, ncrs: 142, inspections: 12420, region: 'Global',
  children: [
    { name: 'Pune-1 (HQ)', slug: 'precision-auto-pune-1', role: 'child', members: 187, ncrs: 42, inspections: 5240, region: 'AP-South', tier: 'Tier-1', logo: '#2563eb', status: 'healthy' },
    { name: 'Chennai-2', slug: 'precision-auto-chennai-2', role: 'child', members: 124, ncrs: 38, inspections: 3840, region: 'AP-South', tier: 'Tier-1', logo: '#0d9488', status: 'healthy' },
    { name: 'Detroit Aluminum', slug: 'precision-auto-detroit', role: 'child', members: 78, ncrs: 24, inspections: 1840, region: 'US-East', tier: 'Tier-2', logo: '#dc2626', status: 'warning' },
    { name: 'Bratislava', slug: 'precision-auto-brno', role: 'child', members: 23, ncrs: 18, inspections: 1280, region: 'EU-West', tier: 'Tier-2', logo: '#7c3aed', status: 'healthy' },
    { name: 'Cyprus JV', slug: 'precision-auto-cyprus', role: 'child', members: 0, ncrs: 0, inspections: 0, region: 'EU-West', tier: 'Tier-3', logo: '#f59e0b', status: 'provisioning' },
  ],
};

function OrgHierarchy() {
  const [selected, setSelected] = React.useState('precision-auto-pune-1');
  const child = ORG_TREE.children.find(c => c.slug === selected);

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card title="Hierarchy" desc="A corporate parent can administer, brand, and analyze child workspaces">
          <div style={{ padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 6, background: 'var(--accent-soft)', marginBottom: 6 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent)', color: 'white', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>P</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{ORG_TREE.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Parent · {ORG_TREE.children.length} children · {ORG_TREE.members} members</div>
              </div>
              <span className="k-chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>Corporate</span>
            </div>

            <div style={{ marginLeft: 14, borderLeft: '2px solid var(--border)', paddingLeft: 14 }}>
              {ORG_TREE.children.map((c, i) => (
                <button key={c.slug} onClick={() => setSelected(c.slug)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: 8, borderRadius: 6, marginBottom: 4, textAlign: 'left',
                  background: selected === c.slug ? 'var(--bg-subtle)' : 'transparent',
                  border: selected === c.slug ? '1px solid var(--border-strong)' : '1px solid transparent',
                }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: c.logo, color: 'white', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>{c.name.split(' ')[0].slice(0, 2).toUpperCase()}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{c.name}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{c.region} · {c.members} members · {c.ncrs} open NCRs</div>
                  </div>
                  {c.status === 'warning' && <Icon name="alert" size={13} style={{ color: '#f59e0b' }}/>}
                  {c.status === 'provisioning' && <span className="k-chip" style={{ background: 'rgba(245,158,11,0.12)', color: '#92400e' }}>Provisioning</span>}
                </button>
              ))}

              <button onClick={() => kToast('New child workspace — pick a region & template to provision')} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: 8, borderRadius: 6, marginTop: 2,
                background: 'transparent', border: '1px dashed var(--border-strong)',
                color: 'var(--text-muted)',
              }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, border: '1px dashed var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="plus" size={13}/>
                </div>
                <span style={{ fontSize: 12.5 }}>Add child workspace</span>
              </button>
            </div>
          </div>
        </Card>

        <Card title={child.name} desc={`${child.region} · ${child.tier} supplier · ${child.slug}.kaenal.app`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 14 }}>
            <Metric l="Members" v={child.members.toString()}/>
            <Metric l="Open NCRs" v={child.ncrs.toString()}/>
            <Metric l="Inspections / mo" v={child.inspections.toLocaleString()}/>
            <Metric l="Last sign-in" v="4 min ago"/>
          </div>

          <div className="k-overline" style={{ marginBottom: 8 }}>Inherited from parent</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {[
              { l: 'SSO connection (Microsoft Entra ID)', on: true, lock: true },
              { l: 'Branding (logo, colors)', on: false, lock: false },
              { l: 'Compliance frameworks (IATF 16949, ISO 9001)', on: true, lock: true },
              { l: 'Retention policy (7-year audit log)', on: true, lock: true },
              { l: 'AI governance policy', on: true, lock: true },
              { l: 'Inspection templates library', on: true, lock: false },
              { l: 'Email templates', on: false, lock: false },
            ].map(r => (
              <div key={r.l} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: 'var(--bg-subtle)', borderRadius: 4, fontSize: 12.5 }}>
                <Icon name={r.on ? 'check' : 'x'} size={12} style={{ color: r.on ? 'var(--success-600)' : 'var(--text-muted)' }} stroke={2.5}/>
                <span style={{ flex: 1 }}>{r.l}</span>
                {r.lock ? <Icon name="lock" size={11} style={{ color: 'var(--text-muted)' }}/> : <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Optional</span>}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button className="k-btn k-btn-secondary k-btn-sm" onClick={() => kToast(`Opening ${child.slug}.kaenal.app in a new tab`)}><Icon name="external" size={11}/> Open workspace</button>
            <button className="k-btn k-btn-secondary k-btn-sm" onClick={() => kToast(`Workspace settings opened — ${child.name}`)}><Icon name="settings" size={11}/> Configure</button>
            <button className="k-btn k-btn-secondary k-btn-sm" style={{ marginLeft: 'auto', color: '#dc2626' }} onClick={() => kToast('Detach requires owner confirmation — email sent')}>Detach</button>
          </div>
        </Card>
      </div>

      <Card title="Inheritance & overrides">
        <Row label="Default for new child workspaces"><Segmented value="inherit-all" onChange={() => {}} options={[
          { value: 'inherit-all', label: 'Inherit everything' },
          { value: 'inherit-required', label: 'Inherit required only' },
          { value: 'isolated', label: 'No inheritance' },
        ]}/></Row>
        <Row label="Permission to break inheritance" hint="Which roles in child workspaces can override parent settings">
          <Segmented value="admin-only" onChange={() => {}} options={[
            { value: 'admin-only', label: 'Child workspace admin only' },
            { value: 'corp-admin', label: 'Only corporate admin' },
            { value: 'never', label: 'Never (full lockdown)' },
          ]}/>
        </Row>
        <Row label="Cross-tenant identity" hint="A corporate admin can act as user in any child without separate accounts"><Toggle on={true}/></Row>
        <Row label="Cross-tenant data isolation" hint="Database-level row tenancy — guaranteed never cross"><Toggle on={true}/></Row>
      </Card>
    </>
  );
}

function Metric({ l, v }) {
  return (
    <div style={{ padding: 10, background: 'var(--bg-subtle)', borderRadius: 6 }}>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{l}</div>
      <div style={{ fontSize: 19, fontWeight: 700 }}>{v}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// White-label branding editor
// ─────────────────────────────────────────────────────────────
function WhiteLabelEditor() {
  const [brand, setBrand] = React.useState({
    name: 'Precision Auto',
    short: 'PA',
    primary: '#dc2626',
    bg: '#0f172a',
    domain: 'quality.precision-auto.com',
    loginCopy: 'Welcome back to PA-QMS. Sign in with your corporate account.',
    fontFamily: 'Inter',
  });
  const update = (k, v) => setBrand(s => ({ ...s, [k]: v }));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 16 }}>
      <div>
        <Card title="Brand">
          <Row label="Display name"><input className="k-input" value={brand.name} onChange={e => update('name', e.target.value)}/></Row>
          <Row label="Short / initials"><input className="k-input" value={brand.short} onChange={e => update('short', e.target.value)} style={{ width: 80 }} maxLength={3}/></Row>
          <Row label="Custom domain" hint="CNAME quality.precision-auto.com → kaenal.app">
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input className="k-input" value={brand.domain} onChange={e => update('domain', e.target.value)} style={{ flex: 1 }}/>
              <span className="k-chip" style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}>
                <Icon name="check" size={10} stroke={3}/> Verified
              </span>
            </div>
          </Row>
          <Row label="Logo (full)">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 56, height: 56, borderRadius: 8, background: brand.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18 }}>{brand.short}</div>
              <button className="k-btn k-btn-ghost"><Icon name="upload" size={12}/> Upload SVG</button>
            </div>
          </Row>
          <Row label="Favicon"><button className="k-btn k-btn-ghost"><Icon name="upload" size={12}/> Upload 32×32</button></Row>
        </Card>

        <Card title="Color">
          <Row label="Primary">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {['#dc2626', '#ea580c', '#f59e0b', '#16a34a', '#0d9488', '#2563eb', '#7c3aed', '#db2777'].map(c => (
                <button key={c} onClick={() => update('primary', c)} style={{
                  width: 26, height: 26, borderRadius: '50%', background: c, cursor: 'pointer',
                  border: brand.primary === c ? '2px solid var(--text)' : '2px solid transparent',
                  outline: '1px solid var(--border)',
                }}/>
              ))}
              <input type="color" value={brand.primary} onChange={e => update('primary', e.target.value)} style={{ width: 30, height: 26, padding: 0, border: 'none', cursor: 'pointer' }}/>
            </div>
          </Row>
          <Row label="Login background"><input type="color" value={brand.bg} onChange={e => update('bg', e.target.value)} style={{ width: 40, height: 30, padding: 0 }}/></Row>
          <Row label="Font"><select className="k-input" value={brand.fontFamily} onChange={e => update('fontFamily', e.target.value)}>
            <option>Inter</option><option>Source Sans</option><option>Roboto</option><option>System</option>
          </select></Row>
        </Card>

        <Card title="Login screen copy">
          <Row label="Tagline"><textarea className="k-input" value={brand.loginCopy} onChange={e => update('loginCopy', e.target.value)} rows={3} style={{ height: 70, padding: 8 }}/></Row>
          <Row label="Support email"><input className="k-input" defaultValue="quality-support@precision-auto.com"/></Row>
          <Row label="Footer text"><input className="k-input" defaultValue="© Precision Auto 2026. Powered by Kaenal."/></Row>
        </Card>

        <Card title="Email & exports">
          <Row label="Sender 'From' name"><input className="k-input" defaultValue="PA Quality"/></Row>
          <Row label="Sender 'From' email" hint="DKIM/SPF verified for precision-auto.com">
            <div style={{ display: 'flex', gap: 6 }}>
              <input className="k-input" defaultValue="quality-noreply@precision-auto.com" style={{ flex: 1 }}/>
              <span className="k-chip" style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}>SPF/DKIM ✓</span>
            </div>
          </Row>
          <Row label="PDF header logo"><Toggle on={true}/></Row>
          <Row label="Mobile inspector splash"><Toggle on={true}/></Row>
        </Card>
      </div>

      {/* Preview */}
      <div>
        <div className="k-overline" style={{ marginBottom: 8 }}>Live preview — login</div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden', background: brand.bg, height: 440, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', padding: 36, borderRadius: 12, width: 340, boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
              <div style={{ width: 56, height: 56, borderRadius: 12, background: brand.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22 }}>{brand.short}</div>
            </div>
            <div style={{ fontSize: 19, fontWeight: 700, textAlign: 'center', marginBottom: 4, color: '#0f172a' }}>Sign in to {brand.name}</div>
            <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>{brand.loginCopy}</div>
            <button style={{ width: '100%', padding: '10px 14px', background: brand.primary, color: 'white', borderRadius: 6, fontWeight: 600, fontSize: 13 }}>
              <Icon name="key" size={13}/> Continue with corporate SSO
            </button>
            <div style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center', marginTop: 24 }}>quality.precision-auto.com</div>
          </div>
          <div style={{ position: 'absolute', bottom: 14, left: 14, fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>© Precision Auto 2026. Powered by Kaenal.</div>
        </div>

        <div className="k-overline" style={{ marginBottom: 8, marginTop: 18 }}>Live preview — sidebar</div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden', display: 'grid', gridTemplateColumns: '240px 1fr' }}>
          <div style={{ background: '#070d1a', color: '#cbd5e1', padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
              <div style={{ width: 32, height: 32, borderRadius: 6, background: brand.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>{brand.short}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{brand.name}</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>{brand.fontFamily}</div>
              </div>
            </div>
            {['Dashboard', 'Inspections', 'Non-Conformities', 'Audits'].map((it, i) => (
              <div key={it} style={{
                padding: '8px 10px', borderRadius: 4, marginBottom: 2, fontSize: 13,
                background: i === 0 ? brand.primary + '24' : 'transparent',
                color: i === 0 ? 'white' : '#94a3b8',
                borderLeft: i === 0 ? `3px solid ${brand.primary}` : '3px solid transparent',
              }}>{it}</div>
            ))}
          </div>
          <div style={{ padding: 18, background: '#f8fafc' }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: '#0f172a' }}>Welcome back</div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>Here's your plant overview</div>
            <button style={{ background: brand.primary, color: 'white', padding: '8px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>Primary action</button>
            <button style={{ background: 'white', color: '#0f172a', padding: '8px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, marginLeft: 8, border: '1px solid #e2e8f0' }}>Secondary</button>
          </div>
        </div>

        <div style={{ marginTop: 18, display: 'flex', gap: 8 }}>
          <button className="k-btn k-btn-ghost"><Icon name="refresh" size={12}/> Reset to default</button>
          <button className="k-btn k-btn-secondary"><Icon name="external" size={12}/> Preview as user</button>
          <button className="k-btn k-btn-primary" style={{ marginLeft: 'auto' }}><Icon name="check" size={12}/> Publish branding</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Cross-tenant analytics
// ─────────────────────────────────────────────────────────────
function CrossTenantAnalytics() {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
        {[
          { l: 'Corporate-wide DPMO', v: '4,210', s: '−18% YoY', good: true, c: '#16a34a', i: 'trending' },
          { l: 'Open critical NCRs', v: '4', s: 'across 7 plants', good: true, c: '#16a34a', i: 'alert' },
          { l: 'OEE rolling 30d', v: '82.4%', s: '+0.8 vs target', good: true, c: '#16a34a', i: 'gauge' },
          { l: 'Audit findings open', v: '24', s: '4 plants in IATF prep', good: false, c: '#f59e0b', i: 'fileText' },
        ].map(k => (
          <div key={k.l} className="k-surface" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: k.c + '18', color: k.c, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={k.i} size={16}/></div>
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{k.l}</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{k.v}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{k.s}</div>
            </div>
          </div>
        ))}
      </div>

      <Card title="Plant scorecard" desc="Roll-up across all child workspaces. Click a plant to drill in.">
        <table className="k-table" style={{ width: '100%' }}>
          <thead><tr>
            <th>Plant</th><th>Members</th><th>NCRs (30d)</th><th>DPMO</th><th>OEE</th>
            <th>On-time CAPA</th><th>Audit ready</th><th>Trend</th>
          </tr></thead>
          <tbody>
            {[
              { p: 'Pune-1 (HQ)', m: 187, n: 142, dpmo: 3840, oee: 87.2, capa: 92, audit: 'ready', trend: [4200, 4100, 4000, 3950, 3920, 3880, 3840], color: '#2563eb' },
              { p: 'Chennai-2', m: 124, n: 124, dpmo: 4280, oee: 84.1, capa: 88, audit: 'ready', trend: [4500, 4400, 4380, 4320, 4280, 4280, 4280], color: '#0d9488' },
              { p: 'Detroit Aluminum', m: 78, n: 87, dpmo: 5840, oee: 78.4, capa: 64, audit: 'at-risk', trend: [5000, 5200, 5400, 5500, 5700, 5800, 5840], color: '#dc2626' },
              { p: 'Bratislava', m: 23, n: 18, dpmo: 4120, oee: 80.2, capa: 78, audit: 'ready', trend: [4500, 4400, 4300, 4200, 4180, 4140, 4120], color: '#7c3aed' },
            ].map(r => (
              <tr key={r.p}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 4, background: r.color, color: 'white', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>{r.p.split(' ')[0].slice(0, 2).toUpperCase()}</div>
                    <strong style={{ fontSize: 13 }}>{r.p}</strong>
                  </div>
                </td>
                <td className="mono">{r.m}</td>
                <td className="mono">{r.n}</td>
                <td className="mono"><span style={{ color: r.dpmo > 5000 ? '#dc2626' : r.dpmo > 4500 ? '#f59e0b' : '#16a34a', fontWeight: 600 }}>{r.dpmo.toLocaleString()}</span></td>
                <td className="mono">{r.oee}%</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 60, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${r.capa}%`, height: '100%', background: r.capa >= 90 ? '#22c55e' : r.capa >= 75 ? '#f59e0b' : '#dc2626' }}/>
                    </div>
                    <span className="mono" style={{ fontSize: 11 }}>{r.capa}%</span>
                  </div>
                </td>
                <td>
                  {r.audit === 'ready'
                    ? <span className="k-chip" style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}>Ready</span>
                    : <span className="k-chip" style={{ background: 'rgba(245,158,11,0.12)', color: '#92400e' }}>At risk</span>}
                </td>
                <td>
                  <Sparkline data={r.trend} color={r.color}/>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card title="Defect categories — corporate roll-up">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[
              { c: 'Weld porosity', count: 142, share: 28, color: '#dc2626' },
              { c: 'Surface finish', count: 84, share: 18, color: '#ea580c' },
              { c: 'Dimensional out-of-spec', count: 78, share: 16, color: '#f59e0b' },
              { c: 'Assembly torque', count: 47, share: 10, color: '#0d9488' },
              { c: 'Cosmetic / paint', count: 42, share: 9, color: '#7c3aed' },
              { c: 'Other', count: 96, share: 19, color: '#64748b' },
            ].map(d => (
              <div key={d.c} style={{ padding: '6px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span>{d.c}</span>
                  <span className="mono"><strong>{d.count}</strong> · {d.share}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-subtle)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${d.share * 3.4}%`, height: '100%', background: d.color }}/>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Customer-impacting incidents (90 days)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { customer: 'Volvo Trucks', plant: 'Pune-1', when: '12 days ago', kind: '8D escalation', status: 'open' },
              { customer: 'Robert Bosch', plant: 'Chennai-2', when: '24 days ago', kind: 'Customer NCR', status: 'closed' },
              { customer: 'BMW', plant: 'Detroit Aluminum', when: '38 days ago', kind: 'Customer audit finding', status: 'open' },
              { customer: 'Daimler', plant: 'Bratislava', when: '64 days ago', kind: 'Customer complaint', status: 'closed' },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'var(--bg-subtle)', borderRadius: 6 }}>
                <Icon name="alert" size={14} style={{ color: r.status === 'open' ? '#dc2626' : 'var(--text-muted)' }}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{r.customer}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.kind} · {r.plant} · {r.when}</div>
                </div>
                <span className="k-chip" style={{
                  background: r.status === 'open' ? 'rgba(220,38,38,0.10)' : 'var(--success-100)',
                  color: r.status === 'open' ? '#b91c1c' : 'var(--success-700)',
                }}>{r.status}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Workspace lifecycle (clone/migrate/export)
// ─────────────────────────────────────────────────────────────
function WorkspaceLifecycle() {
  return (
    <>
      <Card title="Clone a workspace" desc="Duplicate a configured workspace to use as the starting point for a new site">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div className="k-overline" style={{ marginBottom: 6 }}>Source workspace</div>
            <select className="k-input" defaultValue="precision-auto-pune-1">
              <option value="precision-auto-pune-1">Pune-1 (HQ) — 187 members</option>
              <option>Chennai-2 — 124 members</option>
              <option>Detroit Aluminum — 78 members</option>
            </select>

            <div className="k-overline" style={{ marginTop: 14, marginBottom: 6 }}>What to clone</div>
            {[
              { l: 'Inspection templates', n: 47, on: true },
              { l: '8D templates', n: 12, on: true },
              { l: 'PDF report templates', n: 8, on: true },
              { l: 'Email templates', n: 12, on: true },
              { l: 'Categories & severity scales', n: 1, on: true },
              { l: 'Roles & permissions', n: 1, on: true },
              { l: 'Integration configuration', n: 12, on: false, hint: 'Re-auth required' },
              { l: 'Members & teams', n: 187, on: false, hint: 'Users are seat-billed; cloning costs' },
              { l: 'Historical data (NCRs, inspections)', n: 0, on: false, hint: 'Never — keep fresh' },
            ].map(r => (
              <div key={r.l} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderBottom: '1px solid var(--border)' }}>
                <input type="checkbox" defaultChecked={r.on} style={{ accentColor: 'var(--accent)' }}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500 }}>{r.l}</div>
                  {r.hint && <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{r.hint}</div>}
                </div>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.n}</span>
              </div>
            ))}
          </div>

          <div>
            <div className="k-overline" style={{ marginBottom: 6 }}>New workspace</div>
            <Row label="Name"><input className="k-input" defaultValue="Hosur (new site)"/></Row>
            <Row label="Slug">
              <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
                <input style={{ flex: 1, border: 'none', padding: '0 10px', height: 34, outline: 'none' }} defaultValue="precision-auto-hosur"/>
                <div style={{ padding: '0 10px', display: 'flex', alignItems: 'center', background: 'var(--bg-subtle)', color: 'var(--text-muted)', fontSize: 12, borderLeft: '1px solid var(--border)' }}>.kaenal.app</div>
              </div>
            </Row>
            <Row label="Region"><select className="k-input"><option>AP-South (Mumbai)</option><option>EU-West (Frankfurt)</option></select></Row>
            <Row label="Parent"><select className="k-input"><option>Precision Auto (corporate)</option></select></Row>

            <div style={{ marginTop: 20, padding: 14, background: 'var(--accent-soft)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
              <div className="k-overline" style={{ marginBottom: 6 }}>Estimated time</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>~ 4 minutes</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>Configuration only · 47 templates · 12 integrations to re-auth post-clone</div>
            </div>

            <button className="k-btn k-btn-primary" style={{ width: '100%', marginTop: 14 }}><Icon name="refresh" size={13}/> Start clone</button>
          </div>
        </div>
      </Card>

      <Card title="Migrate from legacy">
        <Row label="Source system"><Segmented value="qad" onChange={() => {}} options={[
          { value: 'qad', label: 'QAD' }, { value: 'sap', label: 'SAP QM' }, { value: 'tw', label: 'Trackwise' }, { value: 'mqr', label: 'MasterControl' }, { value: 'csv', label: 'CSV' },
        ]}/></Row>
        <Row label="Records to migrate" hint="Run discovery first to count">
          <div style={{ padding: 12, background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)', fontSize: 12.5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>Inspections (24 mo)</span><span className="mono">142,420</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>NCRs (24 mo)</span><span className="mono">4,820</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>Documents</span><span className="mono">1,247</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>Suppliers</span><span className="mono">184</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 0', fontWeight: 700, borderTop: '1px solid var(--border)' }}><span>Estimated time</span><span>~ 18 hours</span></div>
          </div>
        </Row>
        <Row label="Field mapping" hint="46 fields mapped automatically, 4 need manual review"><button className="k-btn k-btn-secondary"><Icon name="edit" size={12}/> Review mapping</button></Row>
        <Row label="Dry-run validation"><button className="k-btn k-btn-secondary"><Icon name="play" size={12}/> Validate without writing</button></Row>
      </Card>

      <Card title="Export workspace">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { l: 'Full snapshot', f: 'JSON-Lines + assets', s: '~ 4.2 GB', when: 'Manual or scheduled', i: 'package' },
            { l: 'Config only', f: 'JSON', s: '~ 184 KB', when: 'Templates, roles, integrations', i: 'fileText' },
            { l: 'Records only (CSV)', f: 'CSV bundle', s: '~ 280 MB', when: 'For BI / data warehouse', i: 'download' },
          ].map(e => (
            <div key={e.l} style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Icon name={e.i} size={18}/>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{e.l}</div>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 8 }}>{e.f} · {e.s}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>{e.when}</div>
              <button className="k-btn k-btn-secondary k-btn-sm" style={{ width: '100%' }}>Export now</button>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Cost centers + chargeback
// ─────────────────────────────────────────────────────────────
function CostCenters() {
  return (
    <>
      <Card title="Department & cost-center hierarchy" desc="Used for chargeback, reporting, and access scoping">
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16 }}>
          <div className="k-surface" style={{ padding: 8 }}>
            {[
              { l: 'Manufacturing', cc: 'CC-4000', children: [
                { l: 'Quality — Pune-1', cc: 'CC-4101', members: 38 },
                { l: 'Quality — Chennai-2', cc: 'CC-4102', members: 32 },
                { l: 'Quality — Detroit', cc: 'CC-4201', members: 24 },
              ]},
              { l: 'Engineering', cc: 'CC-5000', children: [
                { l: 'Process Engineering', cc: 'CC-5101', members: 18 },
                { l: 'Design', cc: 'CC-5102', members: 12 },
              ]},
              { l: 'Supply Chain', cc: 'CC-3000', children: [
                { l: 'Supplier Quality', cc: 'CC-3101', members: 14 },
                { l: 'Logistics', cc: 'CC-3102', members: 8 },
              ]},
              { l: 'Compliance & QM', cc: 'CC-2000', children: [
                { l: 'Internal Audit', cc: 'CC-2101', members: 6 },
                { l: 'Regulatory', cc: 'CC-2102', members: 4 },
              ]},
            ].map(g => (
              <div key={g.cc}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', fontSize: 12.5, fontWeight: 700 }}>
                  <Icon name="arrowDown" size={11}/>
                  <span>{g.l}</span>
                  <span className="mono" style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--text-muted)' }}>{g.cc}</span>
                </div>
                {g.children.map(c => (
                  <div key={c.cc} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px 5px 24px', fontSize: 12 }}>
                    <span>{c.l}</span>
                    <span className="mono" style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--text-muted)' }}>{c.cc} · {c.members}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div>
            <div className="k-overline" style={{ marginBottom: 8 }}>Monthly chargeback — May 2026</div>
            <table className="k-table" style={{ width: '100%' }}>
              <thead><tr><th>Cost center</th><th>Seats</th><th>Seats $</th><th>AI $</th><th>Storage $</th><th>Total</th></tr></thead>
              <tbody>
                {[
                  { cc: 'CC-4101', l: 'Quality — Pune-1', seats: 38, sd: 1140, ai: 684, st: 78, t: 1902 },
                  { cc: 'CC-4102', l: 'Quality — Chennai-2', seats: 32, sd: 960, ai: 487, st: 64, t: 1511 },
                  { cc: 'CC-4201', l: 'Quality — Detroit', seats: 24, sd: 720, ai: 324, st: 48, t: 1092 },
                  { cc: 'CC-5101', l: 'Process Engineering', seats: 18, sd: 540, ai: 142, st: 28, t: 710 },
                  { cc: 'CC-3101', l: 'Supplier Quality', seats: 14, sd: 420, ai: 104, st: 18, t: 542 },
                  { cc: 'CC-2101', l: 'Internal Audit', seats: 6, sd: 180, ai: 184, st: 12, t: 376 },
                ].map(r => (
                  <tr key={r.cc}>
                    <td>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{r.l}</div>
                      <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{r.cc}</div>
                    </td>
                    <td className="mono">{r.seats}</td>
                    <td className="mono">${r.sd}</td>
                    <td className="mono">${r.ai}</td>
                    <td className="mono">${r.st}</td>
                    <td className="mono" style={{ fontWeight: 700 }}>${r.t.toLocaleString()}</td>
                  </tr>
                ))}
                <tr style={{ background: 'var(--bg-subtle)' }}>
                  <td colSpan={5} style={{ fontWeight: 700, textAlign: 'right' }}>Total May 2026</td>
                  <td className="mono" style={{ fontWeight: 800, fontSize: 14 }}>$6,133</td>
                </tr>
              </tbody>
            </table>
            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <button className="k-btn k-btn-secondary"><Icon name="download" size={12}/> Export GL journal</button>
              <button className="k-btn k-btn-secondary"><Icon name="send" size={12}/> Send to NetSuite</button>
              <button className="k-btn k-btn-primary" style={{ marginLeft: 'auto' }}>Finalize for billing</button>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Allocation rules" desc="How shared platform costs are split across cost centers">
        <Row label="Seat license allocation"><Segmented value="user-cc" onChange={() => {}} options={[
          { value: 'user-cc', label: "User's cost center" },
          { value: 'usage', label: 'Pro-rated by usage' },
          { value: 'corp', label: 'Corporate (single bill)' },
        ]}/></Row>
        <Row label="AI cost allocation"><Segmented value="user-cc" onChange={() => {}} options={[
          { value: 'user-cc', label: "Caller's CC" }, { value: 'record-cc', label: "Record owner's CC" }, { value: 'split', label: 'Split 50/50' },
        ]}/></Row>
        <Row label="Storage allocation"><Segmented value="record-cc" onChange={() => {}} options={[
          { value: 'record-cc', label: "Record owner's CC" }, { value: 'corp', label: 'Corporate' },
        ]}/></Row>
        <Row label="Show CC budget vs actual to managers"><Toggle on={true}/></Row>
      </Card>
    </>
  );
}

Object.assign(window, { MultiTenancyHub });
