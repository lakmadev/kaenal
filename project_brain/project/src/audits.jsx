// Kaenal — Audit Management module
// Full IATF/ISO/AS9100 audit lifecycle: plan → fieldwork → findings → closing

const AUDIT_TYPES = {
  internal: { label: 'Internal', color: '#2563eb', bg: 'rgba(37,99,235,0.10)', icon: 'audit' },
  supplier: { label: 'Supplier', color: '#0891b2', bg: 'rgba(8,145,178,0.10)', icon: 'truck' },
  customer: { label: 'Customer', color: '#9333ea', bg: 'rgba(147,51,234,0.10)', icon: 'building' },
  certification: { label: 'Certification', color: '#ea580c', bg: 'rgba(234,88,12,0.10)', icon: 'shieldCheck' },
  gap: { label: 'Gap Analysis', color: '#475569', bg: 'rgba(71,85,105,0.10)', icon: 'target' },
};

const PHASE_ORDER = ['planned', 'preparation', 'fieldwork', 'reporting', 'closed'];
const PHASE_LABELS = { planned: 'Planned', preparation: 'Preparation', fieldwork: 'Fieldwork', reporting: 'Reporting', closed: 'Closed' };

// Add audit icon to ICONS if missing
if (window.ICONS && !window.ICONS.audit) {
  window.ICONS.audit = '<path d="M9 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-4"/><path d="M9 11V7a3 3 0 0 1 6 0v4"/><path d="M9 17l2 2 4-4"/>';
  window.ICONS.capa = '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/><path d="M9 12l2 2 4-4" stroke-width="2.5"/>';
  window.ICONS.fileCheck = '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 15 11 17 15 13"/>';
  window.ICONS.logout = '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>';
}

function AuditList({ setRoute, setAudit, openCreate }) {
  const [tab, setTab] = React.useState('all');
  const [typeFilter, setTypeFilter] = React.useState('all');
  const [search, setSearch] = React.useState('');

  const filtered = AUDITS.filter(a => {
    if (tab === 'active' && a.status !== 'in_progress' && a.status !== 'planned') return false;
    if (tab === 'completed' && a.status !== 'completed') return false;
    if (tab === 'mine' && !a.auditTeam.includes('u1') && a.leadAuditorId !== 'u1') return false;
    if (typeFilter !== 'all' && a.type !== typeFilter) return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase()) && !a.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    active: AUDITS.filter(a => a.status === 'in_progress').length,
    planned: AUDITS.filter(a => a.status === 'planned').length,
    completedYTD: AUDITS.filter(a => a.status === 'completed').length,
    findingsOpen: AUDITS.reduce((acc, a) => acc + a.findings.major + a.findings.minor, 0),
  };

  return (
    <div>
      <PageHeader
        title="Audit Management"
        description="Internal audits, supplier audits, certification & customer audits"
        actions={
          <>
            <button className="k-btn k-btn-secondary" onClick={() => setRoute && setRoute('inspections-schedule')}><Icon name="calendar" size={14}/> Schedule view</button>
            <button className="k-btn k-btn-primary" onClick={() => openCreate && openCreate('audit')}>
              <Icon name="plus" size={14}/> New audit
            </button>
          </>
        }
      />

      {/* KPI strip */}
      <div style={{ padding: '20px 28px 0', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[
          { label: 'Active audits', value: stats.active, icon: 'audit', color: '#2563eb' },
          { label: 'Planned (next 90d)', value: stats.planned, icon: 'calendar', color: '#9333ea' },
          { label: 'Completed YTD', value: stats.completedYTD, icon: 'check', color: '#16a34a' },
          { label: 'Open findings', value: stats.findingsOpen, icon: 'alert', color: '#dc2626' },
        ].map(k => (
          <div key={k.label} className="k-surface" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: k.color + '18', color: k.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={k.icon} size={20}/>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{k.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.1 }}>{k.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ padding: '20px 28px 0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Segmented
          options={[
            { value: 'all', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'completed', label: 'Completed' },
            { value: 'mine', label: 'My audits' },
          ]}
          value={tab} onChange={setTab}
        />
        <select className="k-input" style={{ height: 32, fontSize: 12.5, width: 'auto', paddingRight: 28 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">All types</option>
          {Object.entries(AUDIT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div style={{ position: 'relative', width: 280 }}>
          <input className="k-input" placeholder="Search audits…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 32, height: 32, fontSize: 12.5 }}/>
          <span style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-muted)', pointerEvents: 'none' }}><Icon name="search" size={14}/></span>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>{filtered.length} of {AUDITS.length}</span>
      </div>

      {/* Audit cards */}
      <div style={{ padding: '14px 28px 28px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        {filtered.map(a => <AuditCard key={a.id} audit={a} onOpen={() => { setAudit(a.id); setRoute('audit-detail'); }}/>)}
      </div>

      {/* Schedule timeline */}
      <div style={{ padding: '0 28px 28px' }}>
        <div className="k-surface" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Audit frequency by type — last 6 months</h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Internal · Supplier · Customer · Certification</span>
          </div>
          <AuditFrequencyChart/>
        </div>
      </div>
    </div>
  );
}

function AuditCard({ audit, onOpen }) {
  const t = AUDIT_TYPES[audit.type];
  const lead = userById(audit.leadAuditorId);
  const phaseIdx = PHASE_ORDER.indexOf(audit.phase);

  return (
    <div className="k-surface k-hoverable" onClick={onOpen} style={{ padding: 18, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span className="k-chip" style={{ background: t.bg, color: t.color }}>
              <Icon name={t.icon} size={11}/> {t.label}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{audit.id}</span>
            <StatusBadge status={audit.status === 'in_progress' ? 'in_progress' : audit.status === 'planned' ? 'scheduled' : audit.status}/>
          </div>
          <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.35, marginBottom: 4 }}>{audit.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{audit.standard} · {audit.location}</div>
        </div>
      </div>

      {/* Phase progress */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
          <span style={{ fontWeight: 600, color: 'var(--text)' }}>{PHASE_LABELS[audit.phase]}</span>
          <span>{audit.progress}% complete</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {PHASE_ORDER.map((p, i) => (
            <div key={p} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= phaseIdx ? t.color : 'var(--border)', transition: 'background 200ms' }}/>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar user={lead} size={22}/>
          <div style={{ fontSize: 11.5, lineHeight: 1.2 }}>
            <div style={{ fontWeight: 500 }}>{lead.name}</div>
            <div style={{ color: 'var(--text-muted)' }}>Lead auditor</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 11.5 }}>
          {audit.findings.major > 0 && (
            <span style={{ color: '#dc2626', fontWeight: 600 }}>{audit.findings.major} major</span>
          )}
          {audit.findings.minor > 0 && (
            <span style={{ color: '#ea580c', fontWeight: 600 }}>{audit.findings.minor} minor</span>
          )}
          <span style={{ color: 'var(--text-muted)' }}>
            <Icon name="calendar" size={11}/> {audit.plannedStart.slice(5)}–{audit.plannedEnd.slice(5)}
          </span>
        </div>
      </div>
    </div>
  );
}

function AuditFrequencyChart() {
  const data = AUDIT_FREQUENCY;
  const maxStack = Math.max(...data.map(d => d.internal + d.supplier + d.customer + d.certification));
  const W = 720, H = 180, PAD_L = 30, PAD_B = 24, barW = (W - PAD_L - 16) / data.length - 8;
  const colors = { internal: '#2563eb', supplier: '#0891b2', customer: '#9333ea', certification: '#ea580c' };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 180 }}>
      {[0, 0.5, 1].map(t => (
        <line key={t} x1={PAD_L} x2={W - 8} y1={PAD_B + (H - PAD_B - 16) * t} y2={PAD_B + (H - PAD_B - 16) * t} stroke="var(--border)" strokeDasharray={t === 1 ? '0' : '2 4'}/>
      ))}
      {data.map((d, i) => {
        const x = PAD_L + i * (barW + 8) + 4;
        let y = H - PAD_B;
        const total = d.internal + d.supplier + d.customer + d.certification;
        const items = [['internal', d.internal], ['supplier', d.supplier], ['customer', d.customer], ['certification', d.certification]];
        return (
          <g key={d.month}>
            {items.map(([k, v]) => {
              const h = (v / maxStack) * (H - PAD_B - 20);
              y -= h;
              return v > 0 ? <rect key={k} x={x} y={y} width={barW} height={h} fill={colors[k]} opacity={0.9}/> : null;
            })}
            <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--text-muted)">{d.month}</text>
            <text x={x + barW / 2} y={H - PAD_B - total * (H - PAD_B - 20) / maxStack - 4} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--text)">{total}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// AUDIT DETAIL
// ─────────────────────────────────────────────────────────────
function AuditDetail({ id, setRoute, setNcr }) {
  const audit = AUDITS.find(a => a.id === id) || AUDITS[0];
  const [tab, setTab] = React.useState('checklist');
  const t = AUDIT_TYPES[audit.type];
  const lead = userById(audit.leadAuditorId);
  const findings = AUDIT_FINDINGS.filter(f => f.auditId === audit.id);

  return (
    <div>
      <div style={{ padding: '20px 28px 0' }}>
        <button onClick={() => setRoute('audits')} className="k-btn-plain" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
          <Icon name="arrowLeft" size={14}/> Back to audits
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span className="k-chip" style={{ background: t.bg, color: t.color }}>
                <Icon name={t.icon} size={11}/> {t.label}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>{audit.id}</span>
              <StatusBadge status={audit.status === 'in_progress' ? 'in_progress' : audit.status === 'planned' ? 'scheduled' : audit.status}/>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, marginBottom: 6, letterSpacing: '-0.02em' }}>{audit.title}</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>{audit.description}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="k-btn k-btn-secondary" onClick={() => kToast(`Export started — ${audit.id.toLowerCase()}-audit-report.pdf`)}><Icon name="download" size={14}/> Export</button>
            <button className="k-btn k-btn-primary" onClick={() => kToast(`Checklist resumed — ${PHASE_LABELS[audit.phase]} at ${audit.progress}%`)}><Icon name="check" size={14}/> Continue audit</button>
          </div>
        </div>
      </div>

      {/* Phase tracker */}
      <div style={{ padding: '20px 28px 0' }}>
        <div className="k-surface" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Current phase</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{PHASE_LABELS[audit.phase]} — {audit.progress}%</div>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              <Icon name="calendar" size={11}/> {audit.plannedStart} → {audit.plannedEnd} ({audit.durationDays} days)
            </div>
          </div>
          <div style={{ display: 'flex', gap: 0 }}>
            {PHASE_ORDER.map((p, i) => {
              const idx = PHASE_ORDER.indexOf(audit.phase);
              const done = i < idx, current = i === idx;
              return (
                <div key={p} style={{ flex: 1, position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: done ? t.color : current ? t.color : 'var(--bg-subtle)',
                      color: (done || current) ? 'white' : 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: `2px solid ${(done || current) ? t.color : 'var(--border)'}`,
                      flexShrink: 0, fontSize: 11, fontWeight: 700, position: 'relative', zIndex: 1,
                    }}>
                      {done ? <Icon name="check" size={14}/> : i + 1}
                    </div>
                    {i < PHASE_ORDER.length - 1 && (
                      <div style={{ flex: 1, height: 2, background: i < idx ? t.color : 'var(--border)' }}/>
                    )}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11.5, fontWeight: current ? 600 : 500, color: current ? 'var(--text)' : 'var(--text-muted)' }}>{PHASE_LABELS[p]}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabs + content */}
      <div style={{ padding: '20px 28px', display: 'grid', gridTemplateColumns: '1fr 320px', gap: 18 }}>
        <div>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 14 }}>
            {[
              { id: 'checklist', label: 'Checklist', count: AUDIT_CHECKLIST.length, icon: 'clipboard' },
              { id: 'findings', label: 'Findings', count: findings.length, icon: 'alert' },
              { id: 'team', label: 'Team & Plan', icon: 'users' },
              { id: 'evidence', label: 'Evidence', icon: 'paperclip' },
              { id: 'report', label: 'Report', icon: 'fileText' },
            ].map(tb => (
              <button key={tb.id} onClick={() => setTab(tb.id)}
                style={{
                  padding: '10px 16px', fontSize: 13, fontWeight: 500,
                  borderBottom: tab === tb.id ? `2px solid ${t.color}` : '2px solid transparent',
                  color: tab === tb.id ? 'var(--text)' : 'var(--text-muted)',
                  marginBottom: -1, display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                <Icon name={tb.icon} size={13}/> {tb.label}
                {tb.count !== undefined && (
                  <span style={{ background: 'var(--bg-subtle)', padding: '1px 6px', borderRadius: 8, fontSize: 11, fontWeight: 600 }}>{tb.count}</span>
                )}
              </button>
            ))}
          </div>

          {tab === 'checklist' && <AuditChecklist audit={audit} setRoute={setRoute} setNcr={setNcr}/>}
          {tab === 'findings' && <AuditFindingsTab findings={findings} setRoute={setRoute} setNcr={setNcr}/>}
          {tab === 'team' && <AuditTeamTab audit={audit}/>}
          {tab === 'evidence' && <AuditEvidenceTab/>}
          {tab === 'report' && <AuditReportTab audit={audit} findings={findings}/>}
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="k-surface" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 10 }}>Audit details</div>
            <DetailRow label="Standard" value={audit.standard}/>
            <DetailRow label="Location" value={audit.location}/>
            <DetailRow label="Duration" value={`${audit.durationDays} days`}/>
            <DetailRow label="Lead auditor" value={<><Avatar user={lead} size={18}/> <span style={{ fontSize: 12.5 }}>{lead.name}</span></>}/>
            <DetailRow label="Next activity" value={<span style={{ fontSize: 12, color: 'var(--accent)' }}>{audit.nextActivity}</span>}/>
          </div>

          <div className="k-surface" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 10 }}>Findings summary</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <SummaryStat label="Major" value={audit.findings.major} color="#dc2626"/>
              <SummaryStat label="Minor" value={audit.findings.minor} color="#ea580c"/>
              <SummaryStat label="Oppt." value={audit.findings.oppt} color="#2563eb"/>
            </div>
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
              <span style={{ color: '#dc2626', fontWeight: 600 }}>{audit.capasOpen}</span> of {audit.capasTotal} CAPAs open
            </div>
          </div>

          <div className="k-surface" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 10 }}>Audit team</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {audit.auditTeam.map(uid => {
                const u = userById(uid);
                return (
                  <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar user={u} size={22}/>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 12 }}>
                      <div style={{ fontWeight: 500 }}>{u.name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{uid === audit.leadAuditorId ? 'Lead auditor' : u.role}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="k-surface" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 10 }}>Scope</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {audit.scope.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <Icon name="check" size={11} className=""/> <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', gap: 8 }}>
      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 500, textAlign: 'right', display: 'flex', alignItems: 'center', gap: 6 }}>{value}</span>
    </div>
  );
}

function SummaryStat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 4px', background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', marginTop: 4 }}>{label}</div>
    </div>
  );
}

const CHECKLIST_STATUS = {
  pending: { label: 'Pending', bg: 'var(--bg-subtle)', fg: 'var(--text-muted)', dot: '#94a3b8' },
  conformant: { label: 'Conformant', bg: 'rgba(34,197,94,0.12)', fg: '#15803d', dot: '#22c55e' },
  minor_nc: { label: 'Minor NC', bg: 'rgba(234,88,12,0.12)', fg: '#c2410c', dot: '#ea580c' },
  major_nc: { label: 'Major NC', bg: 'rgba(220,38,38,0.12)', fg: '#b91c1c', dot: '#dc2626' },
  opportunity: { label: 'Opportunity', bg: 'rgba(99,102,241,0.12)', fg: '#4338ca', dot: '#6366f1' },
  na: { label: 'N/A', bg: 'var(--bg-subtle)', fg: 'var(--text-muted)', dot: '#cbd5e1' },
};

function AuditChecklist({ audit, setRoute, setNcr }) {
  const [items, setItems] = React.useState(AUDIT_CHECKLIST);
  const [expanded, setExpanded] = React.useState({});

  const setStatus = (id, status) => {
    setItems(it => it.map(i => i.id === id ? { ...i, status } : i));
  };

  const counts = {
    conformant: items.filter(i => i.status === 'conformant').length,
    minor_nc: items.filter(i => i.status === 'minor_nc').length,
    major_nc: items.filter(i => i.status === 'major_nc').length,
    opportunity: items.filter(i => i.status === 'opportunity').length,
    pending: items.filter(i => i.status === 'pending').length,
  };

  return (
    <div className="k-surface" style={{ padding: 0 }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Audit checklist</div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· IATF 16949:2016</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, fontSize: 11.5 }}>
          <span style={{ color: '#15803d', fontWeight: 600 }}>● {counts.conformant} conformant</span>
          <span style={{ color: '#dc2626', fontWeight: 600 }}>● {counts.major_nc + counts.minor_nc} NCs</span>
          <span style={{ color: 'var(--text-muted)' }}>● {counts.pending} pending</span>
        </div>
      </div>
      <div>
        {items.map(q => {
          const cs = CHECKLIST_STATUS[q.status];
          const isExp = expanded[q.id];
          return (
            <div key={q.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <div style={{ padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 60, flexShrink: 0 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>§{q.clause}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{q.section.split(' ').slice(0, 2).join(' ')}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, lineHeight: 1.4, marginBottom: 8, fontWeight: 500 }}>{q.text}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {['conformant', 'minor_nc', 'major_nc', 'opportunity', 'na'].map(s => {
                      const cs2 = CHECKLIST_STATUS[s];
                      const active = q.status === s;
                      return (
                        <button key={s} onClick={(e) => { e.stopPropagation(); setStatus(q.id, s); }}
                          style={{
                            padding: '4px 10px', fontSize: 11, fontWeight: 500,
                            border: `1px solid ${active ? cs2.dot : 'var(--border)'}`,
                            background: active ? cs2.bg : 'var(--surface)',
                            color: active ? cs2.fg : 'var(--text-muted)',
                            borderRadius: 'var(--r-sm)',
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: cs2.dot }}/>
                          {cs2.label}
                        </button>
                      );
                    })}
                  </div>
                  {q.notes && (
                    <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--bg-subtle)', borderRadius: 'var(--r-sm)', fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                      <Icon name="info" size={11}/> <em>{q.notes}</em>
                    </div>
                  )}
                  {q.linkedNcr && (
                    <div style={{ marginTop: 6, fontSize: 11.5 }}>
                      <Icon name="link" size={11}/> Linked NCR: <EntityLink id={q.linkedNcr} onClick={() => { setNcr(q.linkedNcr); setRoute('ncr-detail'); }}/>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                  <span className="k-chip" style={{ background: cs.bg, color: cs.fg }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: cs.dot }}/>
                    {cs.label}
                  </span>
                  {q.evidence > 0 && (
                    <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                      <Icon name="paperclip" size={10}/> {q.evidence}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AuditFindingsTab({ findings, setRoute, setNcr }) {
  if (findings.length === 0) {
    return <EmptyState icon="check" title="No findings yet" body="Findings raised during fieldwork will appear here."/>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {findings.map(f => (
        <div key={f.id} className="k-surface" style={{ padding: 16, display: 'flex', gap: 12 }}>
          <div style={{
            width: 4, alignSelf: 'stretch', borderRadius: 2,
            background: f.severity === 'major' ? '#dc2626' : f.severity === 'minor' ? '#ea580c' : '#6366f1',
          }}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>§{f.clause}</span>
              <PriorityBadge priority={f.severity === 'major' ? 'critical' : 'major'}/>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· Due {f.dueDate}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{f.title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 10 }}>{f.description}</div>
            <div style={{ display: 'flex', gap: 12, fontSize: 11.5 }}>
              {f.capaId && (
                <span><Icon name="capa" size={11}/> <strong>CAPA:</strong> <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{f.capaId}</span></span>
              )}
              {f.linkedNcr && (
                <span><Icon name="alert" size={11}/> <strong>NCR:</strong> <EntityLink id={f.linkedNcr} onClick={() => { setNcr(f.linkedNcr); setRoute('ncr-detail'); }}/></span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AuditTeamTab({ audit }) {
  return (
    <div className="k-surface" style={{ padding: 18 }}>
      <h4 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 12px' }}>Audit plan</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 8 }}>Schedule</div>
          <DetailRow label="Planned start" value={audit.plannedStart}/>
          <DetailRow label="Planned end" value={audit.plannedEnd}/>
          <DetailRow label="Duration" value={`${audit.durationDays} days`}/>
          <DetailRow label="Location" value={audit.location}/>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 8 }}>Standard & scope</div>
          <DetailRow label="Standard" value={audit.standard}/>
          <DetailRow label="Type" value={AUDIT_TYPES[audit.type].label}/>
          <DetailRow label="Scope" value={audit.scope.length + ' areas'}/>
        </div>
      </div>
      <h4 style={{ fontSize: 13, fontWeight: 600, margin: '20px 0 10px' }}>Audit team ({audit.auditTeam.length})</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        {audit.auditTeam.map(uid => {
          const u = userById(uid);
          const isLead = uid === audit.leadAuditorId;
          return (
            <div key={uid} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--r-md)', display: 'flex', gap: 10, alignItems: 'center' }}>
              <Avatar user={u} size={32}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{u.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{isLead ? 'Lead auditor · IATF certified' : u.role}</div>
              </div>
              {isLead && <span className="k-chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>Lead</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AuditEvidenceTab() {
  const items = [
    { name: 'Weld Cell 3 — parameter logs.xlsx', size: '2.4 MB', uploadedBy: 'u4', date: 'Apr 14', icon: 'fileXls', clause: '8.5.1' },
    { name: 'Process map v3.2.pdf', size: '890 KB', uploadedBy: 'u1', date: 'Apr 13', icon: 'filePdf', clause: '4.4.1' },
    { name: 'Risk register Q2.xlsx', size: '1.1 MB', uploadedBy: 'u4', date: 'Apr 13', icon: 'fileXls', clause: '6.1' },
    { name: 'Training records sample.pdf', size: '3.2 MB', uploadedBy: 'u1', date: 'Apr 13', icon: 'filePdf', clause: '7.2' },
    { name: 'Photo — fixture J-12.jpg', size: '1.8 MB', uploadedBy: 'u4', date: 'Apr 14', icon: 'fileImg', clause: '8.5.1' },
    { name: 'PPAP package — Door hinge.pdf', size: '8.4 MB', uploadedBy: 'u2', date: 'Apr 14', icon: 'filePdf', clause: '8.6' },
  ];
  return (
    <div className="k-surface" style={{ padding: 0 }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Evidence ({items.length} files)</div>
        <button className="k-btn k-btn-secondary" style={{ height: 28, fontSize: 12 }}><Icon name="upload" size={12}/> Upload</button>
      </div>
      <table className="k-table" style={{ width: '100%' }}>
        <thead><tr><th>File</th><th>Clause</th><th>Uploaded by</th><th>Date</th><th></th></tr></thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name={it.icon} size={18}/> <div><div style={{ fontWeight: 500, fontSize: 13 }}>{it.name}</div><div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{it.size}</div></div></div></td>
              <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>§{it.clause}</span></td>
              <td><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Avatar user={it.uploadedBy} size={18}/> <span style={{ fontSize: 12 }}>{userById(it.uploadedBy).name.split(' ')[0]}</span></div></td>
              <td><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{it.date}</span></td>
              <td><button className="k-btn-plain" style={{ padding: 6 }}><Icon name="download" size={14}/></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditReportTab({ audit, findings }) {
  return (
    <div className="k-surface" style={{ padding: 24 }}>
      <div style={{ textAlign: 'center', marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Audit Report</div>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{audit.title}</h3>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{audit.standard} · {audit.id}</div>
      </div>

      <ReportSection title="Executive Summary">
        Audit conducted from {audit.plannedStart} to {audit.plannedEnd} at {audit.location}. Overall the QMS is effectively implemented with one major nonconformity related to process parameter monitoring on Weld Cell 3. The major NC has been linked to NCR-2026-0089 and is being managed under 8D-2026-0015.
      </ReportSection>

      <ReportSection title="Audit objective">
        {audit.description}
      </ReportSection>

      <ReportSection title="Findings summary">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 8 }}>
          <SummaryStat label="Major NC" value={audit.findings.major} color="#dc2626"/>
          <SummaryStat label="Minor NC" value={audit.findings.minor} color="#ea580c"/>
          <SummaryStat label="Opportunities" value={audit.findings.oppt} color="#6366f1"/>
        </div>
      </ReportSection>

      <ReportSection title="Detailed findings">
        {findings.map(f => (
          <div key={f.id} style={{ paddingLeft: 12, borderLeft: `3px solid ${f.severity === 'major' ? '#dc2626' : '#ea580c'}`, marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>§{f.clause} · {f.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{f.description}</div>
          </div>
        ))}
      </ReportSection>

      <ReportSection title="Conclusions">
        Based on the evidence reviewed, the organization's QMS is generally compliant with {audit.standard}. The major NC requires CAPA closure within 60 days. Recommendation: <strong>Continue certification</strong> pending CAPA closure verification.
      </ReportSection>

      <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', gap: 14 }}>
        <button className="k-btn k-btn-primary" onClick={() => kToast('Export started — audit-findings.pdf')}><Icon name="download" size={13}/> Export PDF</button>
        <button className="k-btn k-btn-secondary" onClick={() => kToast('Findings report emailed to auditee')}><Icon name="mail" size={13}/> Send to auditee</button>
      </div>
    </div>
  );
}

function ReportSection({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h4 style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, margin: '0 0 8px' }}>{title}</h4>
      <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text)' }}>{children}</div>
    </div>
  );
}

Object.assign(window, { AuditList, AuditDetail, AUDIT_TYPES });
