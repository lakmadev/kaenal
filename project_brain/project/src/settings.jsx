// Kaenal — Settings: profile, org, notifications, integrations, roles & permissions

const SETTINGS_NAV = [
  { group: 'Personal', items: [
    { id: 'profile', label: 'Profile', icon: 'user' },
    { id: 'notifications', label: 'Notifications', icon: 'bell' },
    { id: 'security', label: 'Security & devices', icon: 'shield' },
    { id: 'preferences', label: 'Preferences', icon: 'settings' },
  ]},
  { group: 'Workspace', items: [
    { id: 'organization', label: 'Organization', icon: 'building' },
    { id: 'members', label: 'Members & teams', icon: 'users', count: 412 },
    { id: 'roles', label: 'Roles & permissions', icon: 'key' },
    { id: 'sites', label: 'Sites & areas', icon: 'mapPin', count: 7 },
  ]},
  { group: 'Security & Identity', items: [
    { id: 'trust', label: 'Trust Center', icon: 'shieldCheck' },
    { id: 'sso', label: 'Single Sign-On', icon: 'key' },
    { id: 'scim', label: 'SCIM provisioning', icon: 'users' },
    { id: 'network', label: 'Network policy', icon: 'shield' },
    { id: 'sessions', label: 'Session policies', icon: 'clock' },
    { id: 'service-accounts', label: 'Service accounts', icon: 'bot' },
    { id: 'delegated', label: 'Delegated admin', icon: 'key' },
  ]},
  { group: 'Compliance & Privacy', items: [
    { id: 'dsar', label: 'Data subject requests', icon: 'user' },
    { id: 'legal-hold', label: 'Legal hold', icon: 'lock' },
    { id: 'dlp', label: 'DLP policies', icon: 'shield' },
    { id: 'byok', label: 'Customer-managed keys', icon: 'key' },
  ]},
  { group: 'AI', items: [
    { id: 'ai-governance', label: 'AI Governance', icon: 'sparkles' },
  ]},
  { group: 'Multi-tenancy', items: [
    { id: 'org-hierarchy', label: 'Org hierarchy', icon: 'building' },
    { id: 'white-label', label: 'White-label branding', icon: 'palette' },
    { id: 'cross-tenant', label: 'Cross-tenant analytics', icon: 'reports' },
    { id: 'lifecycle', label: 'Clone / migrate / export', icon: 'refresh' },
    { id: 'cost-centers', label: 'Cost centers & chargeback', icon: 'fileText' },
  ]},
  { group: 'Process', items: [
    { id: 'sla', label: 'SLA configuration', icon: 'clock' },
    { id: 'categories', label: 'Categories', icon: 'list' },
    { id: 'validation', label: 'Validation rules', icon: 'shield' },
    { id: 'email-templates', label: 'Email templates', icon: 'mail', count: 12 },
    { id: 'pdf-templates', label: 'PDF templates', icon: 'fileText', count: 8 },
    { id: 'insp-templates', label: 'Inspection templates', icon: 'clipboard' },
    { id: '8d-templates', label: '8D templates', icon: 'brain' },
  ]},
  { group: 'Developer', items: [
    { id: 'dev-platform', label: 'Developer Platform', icon: 'code' },
    { id: 'integrations', label: 'Integrations', icon: 'plug', count: 12 },
    { id: 'api', label: 'API & webhooks', icon: 'code' },
  ]},
  { group: 'Operations', items: [
    { id: 'status-page', label: 'System status', icon: 'sparkles' },
    { id: 'backup-restore', label: 'Backup & restore', icon: 'refresh' },
    { id: 'warehouse', label: 'Data warehouse sync', icon: 'package' },
    { id: 'bulk-import', label: 'Bulk import', icon: 'upload' },
  ]},
  { group: 'Adoption', items: [
    { id: 'onboarding', label: 'Onboarding wizard', icon: 'sparkles' },
    { id: 'tours', label: 'Product tours', icon: 'play' },
    { id: 'knowledge', label: 'Knowledge base', icon: 'doc' },
    { id: 'nps', label: 'NPS & satisfaction', icon: 'star' },
    { id: 'adoption', label: 'Adoption analytics', icon: 'reports' },
    { id: 'release-notes', label: 'Release notes', icon: 'history' },
  ]},
  { group: 'System', items: [
    { id: 'audit', label: 'Audit log', icon: 'history' },
    { id: 'billing', label: 'Billing & plan', icon: 'fileText' },
  ]},
];

const Settings = ({ setRoute }) => {
  const [section, setSection] = React.useState('profile');

  return (
    <div className="fade-in" style={{ display: 'flex', height: 'calc(100vh - 56px)' }}>
      {/* Sidebar */}
      <div style={{ width: 240, borderRight: '1px solid var(--border)', background: 'var(--surface)', overflowY: 'auto', padding: '20px 12px', flexShrink: 0 }}>
        <div style={{ padding: '0 8px 14px', fontSize: 17, fontWeight: 700 }}>Settings</div>
        {SETTINGS_NAV.map(grp => (
          <div key={grp.group} style={{ marginBottom: 18 }}>
            <div className="k-overline" style={{ padding: '0 8px 6px' }}>{grp.group}</div>
            {grp.items.map(it => (
              <button key={it.id} onClick={() => setSection(it.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '8px 10px', borderRadius: 'var(--r-md)',
                background: section === it.id ? 'var(--accent-soft)' : 'transparent',
                color: section === it.id ? 'var(--accent)' : 'var(--text)',
                fontSize: 13, fontWeight: 500, marginBottom: 1,
              }}>
                <Icon name={it.icon} size={14} stroke={1.75}/>
                <span style={{ flex: 1, textAlign: 'left' }}>{it.label}</span>
                {it.count && <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>{it.count}</span>}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        {section === 'profile' && <Profile/>}
        {section === 'notifications' && <Notifications/>}
        {section === 'security' && <Security/>}
        {section === 'preferences' && <Preferences/>}
        {section === 'organization' && <Organization/>}
        {section === 'members' && <Members/>}
        {section === 'roles' && <Roles/>}
        {section === 'sites' && <Sites/>}
        {section === 'integrations' && <Integrations/>}
        {section === 'api' && <ApiWebhooks/>}
        {section === 'audit' && <AuditLog/>}
        {section === 'billing' && <Billing/>}
        {section === 'sla' && <SLAConfig/>}
        {section === 'categories' && <Categories/>}
        {section === 'email-templates' && <EmailTemplates setRoute={setRoute}/>}
        {section === 'pdf-templates' && <PdfTemplatesList setRoute={setRoute}/>}
        {section === 'insp-templates' && <SettingsInspectionTemplatesShortcut setRoute={setRoute}/>}
        {section === '8d-templates' && <SettingsEightDTemplatesShortcut setRoute={setRoute}/>}
        {section === 'trust' && <TrustCenter/>}
        {section === 'sso' && <SsoConfig/>}
        {section === 'scim' && <ScimConfig/>}
        {section === 'network' && <NetworkPolicy/>}
        {section === 'sessions' && <SessionPolicies/>}
        {section === 'service-accounts' && <ServiceAccounts/>}
        {section === 'delegated' && <DelegatedAdmin/>}
        {section === 'ai-governance' && <AIGovernanceHub/>}
        {section === 'dev-platform' && <DevPlatformHub/>}
        {section === 'org-hierarchy' && <MultiTenancyHub initialTab="orgs"/>}
        {section === 'white-label' && <MultiTenancyHub initialTab="whitelabel"/>}
        {section === 'cross-tenant' && <MultiTenancyHub initialTab="analytics"/>}
        {section === 'lifecycle' && <MultiTenancyHub initialTab="lifecycle"/>}
        {section === 'cost-centers' && <MultiTenancyHub initialTab="chargeback"/>}
        {section === 'dsar' && <DSARWorkflow/>}
        {section === 'legal-hold' && <LegalHold/>}
        {section === 'dlp' && <DLPPolicies/>}
        {section === 'byok' && <BYOKKeys/>}
        {section === 'status-page' && <StatusPage/>}
        {section === 'backup-restore' && <BackupRestore/>}
        {section === 'warehouse' && <DataWarehouseSync/>}
        {section === 'bulk-import' && <BulkImport/>}
        {section === 'validation' && <ValidationRules/>}
        {section === 'onboarding' && <OnboardingWizard/>}
        {section === 'tours' && <ProductTours/>}
        {section === 'knowledge' && <KnowledgeBase/>}
        {section === 'nps' && <NPSDashboard/>}
        {section === 'adoption' && <AdoptionAnalytics/>}
        {section === 'release-notes' && <ReleaseNotes/>}
      </div>
    </div>
  );
};

const SettingsPage = ({ title, subtitle, children, actions }) => (
  <div>
    <PageHeader title={title} subtitle={subtitle} actions={actions}/>
    <div style={{ padding: 24, maxWidth: 920 }}>{children}</div>
  </div>
);

const Card = ({ title, desc, children, footer }) => (
  <div className="k-surface" style={{ marginBottom: 16 }}>
    {(title || desc) && (
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        {title && <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>}
        {desc && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>}
      </div>
    )}
    <div style={{ padding: 20 }}>{children}</div>
    {footer && <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>{footer}</div>}
  </div>
);

const Row = ({ label, hint, children, align = 'center' }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24, padding: '14px 0', borderBottom: '1px solid var(--border)', alignItems: align }}>
    <div>
      <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{hint}</div>}
    </div>
    <div>{children}</div>
  </div>
);

const Toggle = ({ on, onChange }) => (
  <button onClick={() => onChange?.(!on)} style={{
    width: 36, height: 20, borderRadius: 'var(--r-full)',
    background: on ? 'var(--accent)' : 'var(--border)',
    position: 'relative', transition: 'all 160ms', flexShrink: 0,
  }}>
    <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'white', position: 'absolute', top: 2, left: on ? 18 : 2, transition: 'all 160ms', boxShadow: 'var(--shadow-sm)' }}/>
  </button>
);

// === Profile ===
const Profile = () => {
  const [tone, setTone] = React.useState('professional');
  return (
    <SettingsPage title="Profile" subtitle="How you appear across the workspace" actions={<button className="k-btn k-btn-primary"><Icon name="check" size={14}/>Save changes</button>}>
      <Card title="Public profile" desc="Visible to other members of your workspace">
        <Row label="Photo" hint="JPG, PNG, GIF up to 5MB. Square images recommended.">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Avatar user="u-priya" size={64}/>
            <button className="k-btn k-btn-ghost"><Icon name="camera" size={13}/>Change</button>
            <button className="k-btn k-btn-plain" style={{ color: 'var(--danger-600)' }}>Remove</button>
          </div>
        </Row>
        <Row label="Full name"><input className="k-input" defaultValue="Priya Iyer"/></Row>
        <Row label="Display name" hint="Shown in comments and notifications"><input className="k-input" defaultValue="Priya"/></Row>
        <Row label="Job title"><input className="k-input" defaultValue="Quality Manager"/></Row>
        <Row label="Department"><input className="k-input" defaultValue="Quality Assurance · Pune-1"/></Row>
        <Row label="Pronouns" hint="Optional"><input className="k-input" defaultValue="she/her" style={{ width: 200 }}/></Row>
        <Row label="Bio" hint="A short description shown on your profile"><textarea className="k-input" rows="3" defaultValue="ASQ-CQE certified. 12 years across Tier-1 automotive & aerospace QMS."/></Row>
      </Card>

      <Card title="Contact" desc="Used for sign-in and notifications">
        <Row label="Work email">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input className="k-input" defaultValue="priya.iyer@precision-auto.com" style={{ flex: 1 }}/>
            <span className="k-chip" style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}><Icon name="check" size={11} stroke={2.5}/>Verified</span>
          </div>
        </Row>
        <Row label="Phone" hint="For SMS alerts on critical NCRs"><input className="k-input" defaultValue="+91 98765 43210"/></Row>
        <Row label="Time zone"><select className="k-input"><option>(GMT+5:30) Asia/Kolkata</option><option>(GMT-5) America/New_York</option></select></Row>
        <Row label="Date format">
          <Segmented value="dmy" onChange={() => {}} options={[{value:'dmy',label:'DD/MM/YYYY'},{value:'mdy',label:'MM/DD/YYYY'},{value:'iso',label:'YYYY-MM-DD'}]}/>
        </Row>
      </Card>

      <Card title="AI assistant tone" desc="How the in-app AI writes messages and summaries on your behalf">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { id: 'professional', label: 'Professional', sample: '"Confirming the rework batch passed CMM verification at 14:22."' },
            { id: 'concise', label: 'Concise', sample: '"Rework batch — CMM passed @ 14:22."' },
            { id: 'friendly', label: 'Friendly', sample: '"Good news — the rework batch cleared CMM, all green!"' },
          ].map(t => (
            <button key={t.id} onClick={() => setTone(t.id)} style={{
              padding: 14, border: tone === t.id ? '2px solid var(--accent)' : '1px solid var(--border)',
              borderRadius: 'var(--r-md)', textAlign: 'left',
              background: tone === t.id ? 'var(--accent-soft)' : 'var(--surface)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.5 }}>{t.sample}</div>
            </button>
          ))}
        </div>
      </Card>
    </SettingsPage>
  );
};

// === Notifications ===
const Notifications = () => {
  const channels = ['Email', 'Push', 'SMS', 'Slack'];
  const events = [
    { cat: 'NCRs & 8D', items: [
      { l: 'NCR assigned to me', def: [1,1,0,1] },
      { l: 'Critical-severity NCR opened in my area', def: [1,1,1,1] },
      { l: '8D phase ready for my review', def: [1,1,0,1] },
      { l: 'NCR overdue', def: [1,1,1,0] },
    ]},
    { cat: 'Inspections', items: [
      { l: 'Inspection assigned to me', def: [1,1,0,0] },
      { l: 'SPC out-of-control signal', def: [1,1,1,1] },
      { l: 'Inspection failed criteria', def: [1,1,0,1] },
    ]},
    { cat: 'Documents', items: [
      { l: 'Approval requested', def: [1,1,0,1] },
      { l: 'Document expiring in 30 days', def: [1,0,0,0] },
      { l: 'Comment on doc I follow', def: [1,1,0,0] },
    ]},
    { cat: 'Audits & training', items: [
      { l: 'Upcoming audit', def: [1,0,0,0] },
      { l: 'Training certification expiring', def: [1,0,0,0] },
    ]},
  ];

  return (
    <SettingsPage title="Notifications" subtitle="Pick how and when Kaenal pings you. Critical safety alerts always go through.">
      <Card title="Quiet hours" desc="Non-critical notifications are batched during these times">
        <Row label="Enable quiet hours"><Toggle on={true}/></Row>
        <Row label="Schedule">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
            <input className="k-input" type="time" defaultValue="20:00" style={{ width: 110 }}/>
            <span style={{ color: 'var(--text-muted)' }}>to</span>
            <input className="k-input" type="time" defaultValue="07:00" style={{ width: 110 }}/>
            <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>weekdays</span>
          </div>
        </Row>
        <Row label="Override for critical">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input type="checkbox" defaultChecked style={{ accentColor: 'var(--accent)' }}/>
            Always notify for critical-severity NCRs and SPC out-of-control
          </label>
        </Row>
      </Card>

      <Card title="Event preferences" desc="Choose which channels deliver each event">
        <table style={{ width: '100%' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '10px 4px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Event</th>
              {channels.map(c => <th key={c} style={{ width: 70, textAlign: 'center', padding: '10px 4px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {events.map(grp => (
              <React.Fragment key={grp.cat}>
                <tr><td colSpan={5} style={{ padding: '14px 4px 6px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{grp.cat}</td></tr>
                {grp.items.map((e, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 4px', fontSize: 13 }}>{e.l}</td>
                    {channels.map((c, ci) => (
                      <td key={c} style={{ textAlign: 'center', padding: '10px 4px' }}>
                        <input type="checkbox" defaultChecked={e.def[ci] === 1} style={{ accentColor: 'var(--accent)', transform: 'scale(1.1)' }}/>
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Digest" desc="A daily summary, instead of per-event notifications, for non-critical events">
        <Row label="Daily digest"><Toggle on={true}/></Row>
        <Row label="Delivery time"><input className="k-input" type="time" defaultValue="08:00" style={{ width: 110 }}/></Row>
      </Card>
    </SettingsPage>
  );
};

// === Security ===
const Security = () => (
  <SettingsPage title="Security & devices" subtitle="Multi-factor auth, sessions, and security keys">
    <Card title="Sign-in method">
      <Row label="Primary method" hint="Single sign-on through Microsoft Entra ID is required by your workspace">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'var(--success-50)', borderRadius: 'var(--r-md)' }}>
          <Icon name="shieldCheck" size={20}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Microsoft Entra ID (SSO)</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Enforced by workspace admin · Last sign-in 4 hours ago</div>
          </div>
          <span className="k-chip" style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}>Active</span>
        </div>
      </Row>
      <Row label="Backup password" hint="Optional — used only when SSO is unavailable">
        <button className="k-btn k-btn-ghost"><Icon name="key" size={13}/>Set backup password</button>
      </Row>
    </Card>

    <Card title="Multi-factor authentication" desc="Required by workspace policy. Add at least 2 methods for resilience.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { i: 'smartphone', l: 'Authenticator app', sub: 'Microsoft Authenticator · Added 4 months ago', on: true, primary: true },
          { i: 'key', l: 'Security key (YubiKey)', sub: 'YubiKey 5C NFC · Last used yesterday', on: true },
          { i: 'phone', l: 'SMS to +91 ••• 43210', sub: 'Backup only — not recommended as primary', on: false },
          { i: 'mail', l: 'Email codes', sub: 'priya.iyer@precision-auto.com', on: false },
        ].map((m, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={m.i} size={16}/></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>{m.l} {m.primary && <span className="k-chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>Primary</span>}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.sub}</div>
            </div>
            <Toggle on={m.on}/>
          </div>
        ))}
      </div>
    </Card>

    <Card title="Active sessions" desc="Devices currently signed in to your account" footer={<button className="k-btn k-btn-ghost" style={{ color: 'var(--danger-600)' }}><Icon name="x" size={13}/>Sign out all other sessions</button>}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {[
          { i: 'panelLeft', l: 'MacBook Pro · Chrome 124', loc: 'Pune, IN · 192.168.4.18', when: 'Active now', current: true },
          { i: 'smartphone', l: 'iPad Pro · Safari', loc: 'Pune Plant Floor · 192.168.5.42', when: '2 hours ago' },
          { i: 'smartphone', l: 'iPhone 15 · Kaenal Inspector', loc: 'Pune, IN · LTE', when: 'Yesterday' },
        ].map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
            <Icon name={s.i} size={18}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>{s.l} {s.current && <span className="k-chip" style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}>This device</span>}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.loc} · {s.when}</div>
            </div>
            {!s.current && <button className="k-btn k-btn-sm k-btn-ghost">Sign out</button>}
          </div>
        ))}
      </div>
    </Card>
  </SettingsPage>
);

const Preferences = () => {
  const [theme, setTheme] = React.useState('system');
  const [density, setDensity] = React.useState('comfortable');
  return (
    <SettingsPage title="Preferences" subtitle="Personal display and behavior">
      <Card title="Appearance">
        <Row label="Theme">
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { id: 'light', label: 'Light', bg: '#ffffff' },
              { id: 'dark', label: 'Dark', bg: '#0f172a' },
              { id: 'system', label: 'System', bg: 'linear-gradient(135deg, #fff 50%, #0f172a 50%)' },
            ].map(t => (
              <button key={t.id} onClick={() => setTheme(t.id)} style={{ padding: 10, border: theme === t.id ? '2px solid var(--accent)' : '1px solid var(--border)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)' }}>
                <div style={{ width: 32, height: 22, borderRadius: 4, background: t.bg, border: '1px solid var(--border)' }}/>
                <span style={{ fontSize: 13 }}>{t.label}</span>
              </button>
            ))}
          </div>
        </Row>
        <Row label="Density">
          <Segmented value={density} onChange={setDensity} options={[{value:'compact',label:'Compact'},{value:'comfortable',label:'Comfortable'},{value:'spacious',label:'Spacious'}]}/>
        </Row>
        <Row label="Accent color">
          <div style={{ display: 'flex', gap: 6 }}>
            {['#2563eb','#7c3aed','#0d9488','#dc2626','#ea580c','#16a34a'].map((c, i) => (
              <button key={c} style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: i === 0 ? '2px solid var(--text)' : '2px solid transparent', outline: '1px solid var(--border)' }}/>
            ))}
          </div>
        </Row>
        <Row label="Reduce motion" hint="Minimizes animations across the app"><Toggle on={false}/></Row>
      </Card>
      <Card title="Behavior">
        <Row label="Default landing page"><select className="k-input"><option>Home dashboard</option><option>My queue</option><option>Floor view</option><option>Last visited</option></select></Row>
        <Row label="Open documents in" ><Segmented value="modal" onChange={() => {}} options={[{value:'modal',label:'Side panel'},{value:'tab',label:'New tab'},{value:'page',label:'Full page'}]}/></Row>
        <Row label="Keyboard shortcuts"><Toggle on={true}/></Row>
        <Row label="Show keyboard hints"><Toggle on={true}/></Row>
      </Card>
    </SettingsPage>
  );
};

// === Organization ===
const Organization = () => (
  <SettingsPage title="Organization" subtitle="Workspace identity and high-level configuration">
    <Card title="Identity">
      <Row label="Company name"><input className="k-input" defaultValue="Precision Auto Components Pvt. Ltd."/></Row>
      <Row label="Workspace URL">
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden', maxWidth: 380 }}>
          <input style={{ flex: 1, border: 'none', padding: '0 12px', height: 38, outline: 'none', background: 'transparent' }} defaultValue="precision-auto"/>
          <div style={{ padding: '0 12px', display: 'flex', alignItems: 'center', background: 'var(--bg-subtle)', color: 'var(--text-muted)', fontSize: 13, borderLeft: '1px solid var(--border)' }}>.kaenal.app</div>
        </div>
      </Row>
      <Row label="Company logo">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 'var(--r-md)', background: '#2563eb', color: 'white', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>P</div>
          <button className="k-btn k-btn-ghost"><Icon name="upload" size={13}/>Upload logo</button>
        </div>
      </Row>
      <Row label="Industry"><select className="k-input"><option>Automotive — Tier-1</option><option>Aerospace</option><option>Pharmaceutical</option></select></Row>
      <Row label="Compliance frameworks">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[
            { l: 'IATF 16949', on: true },
            { l: 'ISO 9001', on: true },
            { l: 'ISO 14001', on: true },
            { l: 'ISO 45001', on: true },
            { l: 'AS9100', on: false },
            { l: 'FDA 21 CFR Part 11', on: false },
          ].map(f => (
            <label key={f.l} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', border: f.on ? '1px solid var(--accent)' : '1px solid var(--border)', background: f.on ? 'var(--accent-soft)' : 'var(--surface)', color: f.on ? 'var(--accent)' : 'var(--text)', borderRadius: 'var(--r-full)', fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" defaultChecked={f.on} style={{ accentColor: 'var(--accent)' }}/>{f.l}
            </label>
          ))}
        </div>
      </Row>
    </Card>

    <Card title="Plan & usage" desc="Enterprise · Renews Apr 1, 2027">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {[
          { l: 'Active members', v: '412', max: '500', pct: 82 },
          { l: 'Plants connected', v: '7', max: '10', pct: 70 },
          { l: 'API calls / mo', v: '847K', max: '2M', pct: 42 },
        ].map(s => (
          <div key={s.l} style={{ padding: 14, background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{s.l}</div>
            <div style={{ display: 'baseline', display: 'flex', gap: 6, alignItems: 'baseline', marginTop: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 700 }}>{s.v}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/ {s.max}</span>
            </div>
            <div style={{ height: 4, background: 'var(--border)', borderRadius: 'var(--r-full)', marginTop: 8, overflow: 'hidden' }}>
              <div style={{ width: `${s.pct}%`, height: '100%', background: s.pct > 80 ? 'var(--warning-500)' : 'var(--accent)' }}/>
            </div>
          </div>
        ))}
      </div>
    </Card>

    <Card title="Data residency & retention">
      <Row label="Region" hint="Where your tenant data is stored"><select className="k-input" defaultValue="ap-south-1"><option value="ap-south-1">Asia Pacific (Mumbai) — ap-south-1</option><option>EU West (Frankfurt)</option><option>US East (N. Virginia)</option></select></Row>
      <Row label="Audit log retention"><Segmented value="7y" onChange={() => {}} options={[{value:'1y',label:'1 yr'},{value:'3y',label:'3 yr'},{value:'7y',label:'7 yr'},{value:'forever',label:'Forever'}]}/></Row>
      <Row label="Right to be forgotten" hint="Anonymize personal data of departed members"><Toggle on={true}/></Row>
    </Card>
  </SettingsPage>
);

// === Members ===
const Members = () => {
  const members = [
    { user: 'u-david', role: 'Plant Director', status: 'active', mfa: true, last: 'Now' },
    { user: 'u-priya', role: 'Quality Manager', status: 'active', mfa: true, last: '4h' },
    { user: 'u-marcus', role: 'CMM Specialist', status: 'active', mfa: true, last: '1h' },
    { user: 'u-sarah', role: 'QA Engineer', status: 'active', mfa: true, last: '20m' },
    { user: 'u-jorge', role: 'Line Supervisor', status: 'active', mfa: false, last: '6m' },
    { user: 'u-anita', role: 'Inspector', status: 'invited', mfa: false, last: '—' },
    { user: 'u-ryan', role: 'Lab Technician', status: 'active', mfa: true, last: '2d' },
    { user: 'u-yuki', role: 'Quality Engineer', status: 'active', mfa: true, last: '12m' },
    { user: 'u-carlos', role: 'Process Engineer', status: 'suspended', mfa: false, last: '3w' },
  ];

  return (
    <SettingsPage title="Members & teams" subtitle={`412 active members · 23 pending invites`} actions={
      <>
        <button className="k-btn k-btn-ghost"><Icon name="upload" size={14}/>Bulk import (CSV)</button>
        <button className="k-btn k-btn-primary"><Icon name="plus" size={14}/>Invite</button>
      </>
    }>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <input className="k-input" placeholder="Search by name, email, role…" style={{ paddingLeft: 34 }}/>
          <div style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-subtle)', pointerEvents: 'none' }}><Icon name="search" size={14}/></div>
        </div>
        <Segmented size="sm" value="all" onChange={() => {}} options={[{value:'all',label:'All'},{value:'active',label:'Active'},{value:'invited',label:'Invited'},{value:'suspended',label:'Suspended'}]}/>
      </div>
      <div className="k-surface" style={{ overflow: 'hidden' }}>
        <table className="k-table">
          <thead><tr><th>Person</th><th>Role</th><th>Teams</th><th>MFA</th><th>Status</th><th>Last active</th><th></th></tr></thead>
          <tbody>
            {members.map(m => {
              const u = userById(m.user);
              return (
                <tr key={m.user}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar user={m.user} size={30}/>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{u?.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u?.name?.toLowerCase().replace(' ', '.')}@precision-auto.com</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="k-chip" style={{ background: 'var(--bg-subtle)', color: 'var(--text)' }}>{m.role}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>Quality · Pune-1</td>
                  <td>{m.mfa ? <Icon name="shieldCheck" size={14} className="k-text-success"/> : <span style={{ color: 'var(--warning-600)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="alert" size={11}/>Off</span>}</td>
                  <td>
                    {m.status === 'active' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success-500)' }}/>Active</span>}
                    {m.status === 'invited' && <span className="k-chip" style={{ background: 'var(--info-50)', color: 'var(--info-600)' }}>Invited</span>}
                    {m.status === 'suspended' && <span className="k-chip" style={{ background: 'var(--danger-100)', color: 'var(--danger-700)' }}>Suspended</span>}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.last}</td>
                  <td><button className="k-btn-icon k-btn-plain"><Icon name="more" size={14}/></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SettingsPage>
  );
};

// === Roles ===
const Roles = () => {
  const roles = [
    { id: 'admin', name: 'Workspace Admin', members: 4, color: '#dc2626', desc: 'Full access to everything', sys: true },
    { id: 'qm', name: 'Quality Manager', members: 12, color: '#2563eb', desc: 'Owns NCRs, 8D, audits, document approvals' },
    { id: 'qe', name: 'Quality Engineer', members: 38, color: '#0d9488', desc: 'Runs inspections, files NCRs, drafts SOPs' },
    { id: 'inspector', name: 'Inspector', members: 142, color: '#7c3aed', desc: 'Mobile inspector role — read inspections, write findings' },
    { id: 'sup', name: 'Line Supervisor', members: 34, color: '#ea580c', desc: 'Approves rework, escalates issues, reads area data' },
    { id: 'auditor', name: 'External Auditor', members: 8, color: '#f59e0b', desc: 'Read-only access scoped to audit period', sys: true },
    { id: 'guest', name: 'Supplier Guest', members: 24, color: '#64748b', desc: 'Read-only on shared NCRs and 8D — no internal data', sys: true },
  ];
  const [selected, setSelected] = React.useState('qe');
  const role = roles.find(r => r.id === selected);

  const permGroups = [
    { cat: 'Inspections', perms: [
      { l: 'View inspections', v: 'all' },
      { l: 'Create / edit inspections', v: 'own' },
      { l: 'Override SPC limits', v: 'none' },
    ]},
    { cat: 'NCRs & 8D', perms: [
      { l: 'View NCRs', v: 'all' },
      { l: 'Create NCR', v: 'all' },
      { l: 'Disposition (use-as-is, scrap, rework)', v: 'own' },
      { l: 'Close NCR', v: 'none' },
      { l: 'Approve 8D phases', v: 'none' },
    ]},
    { cat: 'Documents', perms: [
      { l: 'View documents', v: 'all' },
      { l: 'Edit / draft documents', v: 'own' },
      { l: 'Approve documents', v: 'none' },
      { l: 'Manage document folders', v: 'none' },
    ]},
    { cat: 'Reports', perms: [
      { l: 'View reports', v: 'all' },
      { l: 'Build & schedule reports', v: 'all' },
      { l: 'Share externally', v: 'none' },
    ]},
    { cat: 'Admin', perms: [
      { l: 'Invite members', v: 'none' },
      { l: 'Manage integrations', v: 'none' },
      { l: 'View audit log', v: 'none' },
    ]},
  ];

  const PermBadge = ({ v }) => {
    const map = { all: ['All', 'var(--success-100)', 'var(--success-700)'], own: ['Own/team', 'var(--info-50)', 'var(--info-600)'], none: ['—', 'var(--bg-subtle)', 'var(--text-muted)'] };
    const [l, bg, fg] = map[v];
    return <span className="k-chip" style={{ background: bg, color: fg }}>{l}</span>;
  };

  return (
    <SettingsPage title="Roles & permissions" subtitle="Role-based access control with row-level scoping" actions={<button className="k-btn k-btn-primary"><Icon name="plus" size={14}/>New role</button>}>
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
        <div className="k-surface" style={{ padding: 8 }}>
          {roles.map(r => (
            <button key={r.id} onClick={() => setSelected(r.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '10px 12px', borderRadius: 'var(--r-md)',
              background: selected === r.id ? 'var(--accent-soft)' : 'transparent',
              textAlign: 'left',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, flexShrink: 0 }}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {r.name} {r.sys && <Icon name="lock" size={10}/>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.members} members</div>
              </div>
            </button>
          ))}
        </div>

        <div className="k-surface">
          <div style={{ padding: 18, borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: role.color }}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{role.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{role.desc}</div>
              </div>
              {!role.sys && <button className="k-btn k-btn-sm k-btn-ghost"><Icon name="edit" size={12}/>Edit</button>}
            </div>
          </div>
          <div style={{ padding: 18 }}>
            <div className="k-overline" style={{ marginBottom: 12 }}>Permissions</div>
            <table style={{ width: '100%' }}>
              <tbody>
                {permGroups.map(g => (
                  <React.Fragment key={g.cat}>
                    <tr><td colSpan={2} style={{ padding: '14px 0 6px', fontSize: 12, fontWeight: 600 }}>{g.cat}</td></tr>
                    {g.perms.map((p, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 0', fontSize: 13 }}>{p.l}</td>
                        <td style={{ textAlign: 'right', padding: '8px 0', width: 110 }}><PermBadge v={p.v}/></td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SettingsPage>
  );
};

const Sites = () => (
  <SettingsPage title="Sites & areas" subtitle="Plants, lines, cells, and zones" actions={<button className="k-btn k-btn-primary"><Icon name="plus" size={14}/>Add site</button>}>
    <Card title="Active sites">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { name: 'Pune-1 (HQ)', loc: 'Pune, India', tz: 'GMT+5:30', shifts: 3, areas: 8, members: 187 },
          { name: 'Chennai-2', loc: 'Chennai, India', tz: 'GMT+5:30', shifts: 2, areas: 6, members: 124 },
          { name: 'Detroit Aluminum', loc: 'Detroit, USA', tz: 'GMT-5', shifts: 3, areas: 5, members: 78 },
          { name: 'Bratislava', loc: 'Bratislava, SK', tz: 'GMT+1', shifts: 2, areas: 4, members: 23 },
        ].map(s => (
          <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--r-md)', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="building" size={18}/></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.loc} · {s.tz}</div>
            </div>
            <div style={{ display: 'flex', gap: 24, fontSize: 12 }}>
              <div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Shifts</div><div style={{ fontWeight: 600 }}>{s.shifts}</div></div>
              <div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Areas</div><div style={{ fontWeight: 600 }}>{s.areas}</div></div>
              <div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Members</div><div style={{ fontWeight: 600 }}>{s.members}</div></div>
            </div>
            <button className="k-btn k-btn-sm k-btn-ghost">Configure</button>
          </div>
        ))}
      </div>
    </Card>
  </SettingsPage>
);

// === Integrations ===
const Integrations = () => {
  const cats = [
    { cat: 'Data sources', items: [
      { l: 'SAP S/4HANA', sub: 'Production orders & material master', status: 'connected', color: '#0070b5', logo: 'SAP' },
      { l: 'Microsoft Dynamics 365', sub: 'CRM customer complaints', status: 'connected', color: '#005a9e', logo: 'D365' },
      { l: 'Siemens Opcenter MES', sub: 'Real-time line + machine data', status: 'connected', color: '#009999', logo: 'OPC' },
      { l: 'Hexagon CMM', sub: 'Auto-import inspection results', status: 'connected', color: '#005bbb', logo: 'HXM' },
      { l: 'Zeiss CALYPSO', sub: 'CMM data via OPC UA', status: 'available', color: '#0072c6', logo: 'ZEI' },
    ]},
    { cat: 'Notifications', items: [
      { l: 'Slack', sub: '#quality-ops, #plant-pune-1', status: 'connected', color: '#4a154b', logo: 'Slk' },
      { l: 'Microsoft Teams', sub: 'Quality team channel', status: 'connected', color: '#5059c9', logo: 'MS' },
      { l: 'PagerDuty', sub: 'Critical NCR escalation', status: 'available', color: '#06ac38', logo: 'PD' },
    ]},
    { cat: 'Identity & SSO', items: [
      { l: 'Microsoft Entra ID', sub: 'SSO + SCIM provisioning', status: 'connected', color: '#0078d4', logo: 'AD' },
      { l: 'Okta', sub: 'Alternative SSO', status: 'available', color: '#007dc1', logo: 'Okt' },
    ]},
    { cat: 'Storage', items: [
      { l: 'SharePoint', sub: 'Sync controlled documents', status: 'connected', color: '#0364b8', logo: 'SP' },
      { l: 'Box', sub: 'Backup of audit packs', status: 'available', color: '#0061d5', logo: 'Box' },
    ]},
  ];

  return (
    <SettingsPage title="Integrations" subtitle="Connect Kaenal to your manufacturing stack" actions={<button className="k-btn k-btn-ghost"><Icon name="search" size={14}/>Browse marketplace</button>}>
      {cats.map(c => (
        <div key={c.cat} style={{ marginBottom: 24 }}>
          <div className="k-overline" style={{ marginBottom: 10 }}>{c.cat}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {c.items.map(it => (
              <div key={it.l} className="k-surface" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 'var(--r-md)', background: it.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, letterSpacing: '0.04em', flexShrink: 0 }}>{it.logo}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{it.l}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.sub}</div>
                </div>
                {it.status === 'connected' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="k-chip" style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--success-500)' }}/>Connected</span>
                    <button className="k-btn-icon k-btn-plain"><Icon name="settings" size={14}/></button>
                  </div>
                ) : (
                  <button className="k-btn k-btn-sm k-btn-ghost">Connect</button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </SettingsPage>
  );
};

// === API ===
const ApiWebhooks = () => (
  <SettingsPage title="API & webhooks" subtitle="Programmatic access to your workspace">
    <Card title="API tokens" desc="Use these to authenticate from external systems and scripts" actions footer={<button className="k-btn k-btn-primary"><Icon name="plus" size={13}/>Create token</button>}>
      <table style={{ width: '100%' }}>
        <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
          <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 11, color: 'var(--text-muted)' }}>NAME</th>
          <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 11, color: 'var(--text-muted)' }}>TOKEN</th>
          <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 11, color: 'var(--text-muted)' }}>SCOPE</th>
          <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 11, color: 'var(--text-muted)' }}>LAST USED</th>
          <th></th>
        </tr></thead>
        <tbody>
          {[
            { n: 'SAP Integration', t: 'kn_sk_••••••a3f9', scope: 'inspections:read, ncr:write', last: '12 minutes ago' },
            { n: 'BI Pipeline (Snowflake)', t: 'kn_sk_••••••72c1', scope: 'reports:read', last: '4 hours ago' },
            { n: 'Lab POSTMORTEM script', t: 'kn_sk_••••••0e88', scope: 'inspections:read', last: '3 days ago' },
          ].map((t, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '12px 0', fontWeight: 600, fontSize: 13 }}>{t.n}</td>
              <td className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.t}</td>
              <td style={{ fontSize: 12 }}>{t.scope}</td>
              <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.last}</td>
              <td style={{ textAlign: 'right' }}><button className="k-btn-icon k-btn-plain"><Icon name="more" size={14}/></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>

    <Card title="Webhooks" desc="Push events to your endpoints in real-time">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { url: 'https://hooks.precision-auto.com/kaenal/ncr', events: 'ncr.created, ncr.closed', status: 'healthy', lastDelivery: '8 min ago' },
          { url: 'https://internal.precision-auto.com/api/spc-alerts', events: 'inspection.failed, spc.out_of_control', status: 'healthy', lastDelivery: '2h ago' },
          { url: 'https://siem.precision-auto.com/kaenal-audit', events: 'audit.* (12 events)', status: 'failing', lastDelivery: '6 retries · 12h ago' },
        ].map((w, i) => (
          <div key={i} style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="mono" style={{ fontSize: 12, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.url}</div>
              {w.status === 'healthy' ? <span className="k-chip" style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--success-500)' }}/>Healthy</span> : <span className="k-chip" style={{ background: 'var(--danger-100)', color: 'var(--danger-700)' }}><Icon name="alert" size={10}/>Failing</span>}
              <button className="k-btn-icon k-btn-plain"><Icon name="more" size={14}/></button>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
              <span>Events: <strong style={{ color: 'var(--text)' }}>{w.events}</strong></span>
              <span>·</span>
              <span>Last delivery: {w.lastDelivery}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  </SettingsPage>
);

// === Audit ===
const AuditLog = () => {
  const events = [
    { t: '14:22', who: 'u-priya', action: 'approved.document', target: 'Welding Process Control Plan v4.2', ip: '192.168.4.18' },
    { t: '13:08', who: 'u-system', action: 'imported.inspections', target: '47 records from Hexagon CMM', ip: 'integration', ai: true },
    { t: '12:50', who: 'u-marcus', action: 'closed.ncr', target: 'NCR-2026-0140', ip: '192.168.4.31' },
    { t: '11:14', who: 'u-david', action: 'changed.permission', target: 'Inspector role: scrap_dispose=false → true', ip: '192.168.4.5', sensitive: true },
    { t: '10:00', who: 'u-sarah', action: 'created.ncr', target: 'NCR-2026-0142', ip: '192.168.5.42' },
    { t: '09:42', who: 'u-jorge', action: 'completed.inspection', target: 'INS-2026-0341', ip: '192.168.5.18' },
    { t: '09:12', who: 'u-system', action: 'spc.out_of_control', target: 'Line 3 / weld penetration', ip: 'machine', sensitive: true },
    { t: 'Yest 18:04', who: 'u-priya', action: 'shared.report', target: 'Weekly Plant Manager Brief → 4 recipients', ip: '192.168.4.18' },
  ];
  return (
    <SettingsPage title="Audit log" subtitle="7-year retention · IATF 16949 §7.5.3.2 compliant" actions={<><button className="k-btn k-btn-ghost"><Icon name="filter" size={14}/>Filter</button><button className="k-btn k-btn-ghost"><Icon name="download" size={14}/>Export</button></>}>
      <div className="k-surface" style={{ overflow: 'hidden' }}>
        <table className="k-table">
          <thead><tr><th style={{ width: 110 }}>When</th><th>Who</th><th>Action</th><th>Target</th><th>IP / Source</th></tr></thead>
          <tbody>
            {events.map((e, i) => (
              <tr key={i} style={{ background: e.sensitive ? 'var(--warning-50)' : '' }}>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }} className="mono">{e.t}</td>
                <td>{e.who === 'u-system' ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}><Icon name="bot" size={14}/>System</span> : <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Avatar user={e.who} size={20}/><span style={{ fontSize: 12 }}>{userById(e.who)?.name?.split(' ')[0]}</span></div>}</td>
                <td className="mono" style={{ fontSize: 11, color: e.sensitive ? 'var(--warning-700)' : 'var(--text-muted)', fontWeight: e.sensitive ? 600 : 400 }}>{e.action}</td>
                <td style={{ fontSize: 12 }}>{e.target} {e.ai && <span className="k-chip" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', fontSize: 9, padding: '1px 5px', height: 16, marginLeft: 4 }}>AI</span>}</td>
                <td className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SettingsPage>
  );
};

// === Billing ===
const Billing = () => (
  <SettingsPage title="Billing & plan" subtitle="Enterprise · Annual contract">
    <Card title="Current plan">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, padding: 16, background: 'linear-gradient(135deg, #1e3a8a, #312e81)', color: 'white', borderRadius: 'var(--r-lg)', margin: -20, marginBottom: 20 }}>
        <div style={{ width: 48, height: 48, borderRadius: 'var(--r-md)', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="award" size={22}/></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Enterprise</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>Up to 500 members · 10 plants · Unlimited reports · 24/7 support · Dedicated CSM</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 11, padding: '3px 8px', background: 'rgba(255,255,255,0.15)', borderRadius: 'var(--r-full)' }}>Renews Apr 1, 2027</span>
            <span style={{ fontSize: 11, padding: '3px 8px', background: 'rgba(255,255,255,0.15)', borderRadius: 'var(--r-full)' }}>Annual billing</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 26, fontWeight: 700 }}>$184,000</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>per year</div>
        </div>
      </div>
      <Row label="Billing email"><input className="k-input" defaultValue="finance@precision-auto.com"/></Row>
      <Row label="Tax ID (GSTIN)"><input className="k-input" defaultValue="27AAACP1234A1Z5" className="mono"/></Row>
      <Row label="Payment method">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--r-md)', maxWidth: 360 }}>
          <Icon name="fileText" size={16}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Bank wire (NET 30)</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>HDFC Bank · ••••3892</div>
          </div>
          <button className="k-btn k-btn-sm k-btn-ghost">Change</button>
        </div>
      </Row>
    </Card>
    <Card title="Invoices">
      <table className="k-table">
        <thead><tr><th>Invoice</th><th>Period</th><th>Amount</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {[
            { id: 'INV-2026-001', period: 'Apr 2026 – Mar 2027', amt: '$184,000', status: 'Paid' },
            { id: 'INV-2025-001', period: 'Apr 2025 – Mar 2026', amt: '$162,000', status: 'Paid' },
            { id: 'INV-2024-001', period: 'Apr 2024 – Mar 2025', amt: '$148,000', status: 'Paid' },
          ].map(i => (
            <tr key={i.id}>
              <td className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{i.id}</td>
              <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{i.period}</td>
              <td style={{ fontSize: 13, fontWeight: 600 }}>{i.amt}</td>
              <td><span className="k-chip" style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}>{i.status}</span></td>
              <td><button className="k-btn k-btn-sm k-btn-ghost"><Icon name="download" size={12}/>PDF</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  </SettingsPage>
);

Object.assign(window, { Settings, Card, Row, Toggle, SettingsPage });
