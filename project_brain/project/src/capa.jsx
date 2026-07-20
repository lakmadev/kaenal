// Kaenal — CAPA module
// Corrective & Preventive Action: rca → action plan → implementation → verification → effectiveness

const CAPA_PHASES = [
  { id: 'initiation', label: 'Initiation', icon: 'plus' },
  { id: 'rca', label: 'Root Cause', icon: 'brain' },
  { id: 'action_plan', label: 'Action Plan', icon: 'clipboard' },
  { id: 'implementation', label: 'Implementation', icon: 'tool' },
  { id: 'verification', label: 'Verification', icon: 'check' },
  { id: 'effectiveness', label: 'Effectiveness', icon: 'shieldCheck' },
  { id: 'closed', label: 'Closed', icon: 'lock' },
];

function CapaList({ setRoute, setCapa, openCreate }) {
  const [tab, setTab] = React.useState('all');
  const [typeFilter, setTypeFilter] = React.useState('all');
  const [search, setSearch] = React.useState('');

  const filtered = CAPAS.filter(c => {
    if (tab === 'open' && (c.status === 'completed' || c.status === 'closed')) return false;
    if (tab === 'closed' && c.status !== 'completed' && c.status !== 'closed') return false;
    if (tab === 'mine' && c.ownerId !== 'u1') return false;
    if (tab === 'overdue' && c.slaStatus !== 'breached' && c.slaStatus !== 'at_risk') return false;
    if (typeFilter !== 'all' && c.type !== typeFilter) return false;
    if (search && !c.title.toLowerCase().includes(search.toLowerCase()) && !c.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    open: CAPAS.filter(c => c.status !== 'completed' && c.status !== 'closed').length,
    overdue: CAPAS.filter(c => c.slaStatus === 'at_risk' || c.slaStatus === 'breached').length,
    inEff: CAPAS.filter(c => c.phase === 'effectiveness').length,
    avgClosure: 38,
  };

  return (
    <div>
      <PageHeader
        title="CAPA"
        description="Corrective & Preventive Actions — root cause to effectiveness verification"
        actions={
          <>
            <button className="k-btn k-btn-secondary" onClick={() => kToast('Export started — capa-effectiveness-report.pdf')}><Icon name="reports" size={14}/> Effectiveness report</button>
            <button className="k-btn k-btn-primary" onClick={() => openCreate && openCreate('capa')}>
              <Icon name="plus" size={14}/> New CAPA
            </button>
          </>
        }
      />

      <div style={{ padding: '20px 28px 0', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[
          { label: 'Open CAPAs', value: stats.open, icon: 'capa', color: '#2563eb' },
          { label: 'At risk / overdue', value: stats.overdue, icon: 'alert', color: '#dc2626' },
          { label: 'In effectiveness check', value: stats.inEff, icon: 'shieldCheck', color: '#9333ea' },
          { label: 'Avg closure (days)', value: stats.avgClosure, icon: 'clock', color: '#ea580c' },
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

      {/* Trend */}
      <div style={{ padding: '20px 28px 0' }}>
        <div className="k-surface" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>CAPA opened vs closed — last 6 months</h3>
            <div style={{ fontSize: 11, display: 'flex', gap: 14 }}>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, background: '#2563eb', borderRadius: 2, marginRight: 6 }}/>Opened</span>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, background: '#22c55e', borderRadius: 2, marginRight: 6 }}/>Closed</span>
            </div>
          </div>
          <CapaTrendChart/>
        </div>
      </div>

      {/* Filters */}
      <div style={{ padding: '20px 28px 0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Segmented
          options={[
            { value: 'all', label: 'All' },
            { value: 'open', label: 'Open' },
            { value: 'overdue', label: 'At risk' },
            { value: 'closed', label: 'Closed' },
            { value: 'mine', label: 'My CAPAs' },
          ]}
          value={tab} onChange={setTab}
        />
        <select className="k-input" style={{ height: 32, fontSize: 12.5, width: 'auto', paddingRight: 28 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">All types</option>
          <option value="corrective">Corrective</option>
          <option value="preventive">Preventive</option>
        </select>
        <div style={{ position: 'relative', width: 280 }}>
          <input className="k-input" placeholder="Search CAPAs…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 32, height: 32, fontSize: 12.5 }}/>
          <span style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-muted)', pointerEvents: 'none' }}><Icon name="search" size={14}/></span>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>{filtered.length} of {CAPAS.length}</span>
      </div>

      {/* CAPA table */}
      <div style={{ padding: '14px 28px 28px' }}>
        <div className="k-surface" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="k-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: 130 }}>ID / Type</th>
                <th>Title</th>
                <th>Phase</th>
                <th>Owner</th>
                <th>Source</th>
                <th>Due</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => <CapaRow key={c.id} capa={c} onOpen={() => { setCapa(c.id); setRoute('capa-detail'); }}/>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CapaRow({ capa, onOpen }) {
  const owner = userById(capa.ownerId);
  const phaseIdx = CAPA_PHASES.findIndex(p => p.id === capa.phase);
  const phase = CAPA_PHASES[phaseIdx];

  return (
    <tr onClick={onOpen} style={{ cursor: 'pointer' }}>
      <td>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 600 }}>{capa.id}</div>
        <span className="k-chip" style={{
          background: capa.type === 'corrective' ? 'rgba(220,38,38,0.10)' : 'rgba(37,99,235,0.10)',
          color: capa.type === 'corrective' ? '#b91c1c' : '#1d4ed8',
          fontSize: 10, marginTop: 4,
        }}>
          {capa.type === 'corrective' ? 'Corrective' : 'Preventive'}
        </span>
      </td>
      <td>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{capa.title}</div>
        {(capa.linkedNcr || capa.linked8d || capa.findingId) && (
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
            {capa.linkedNcr && <span><Icon name="link" size={9}/> {capa.linkedNcr}</span>}
            {capa.linked8d && <span><Icon name="link" size={9}/> {capa.linked8d}</span>}
          </div>
        )}
      </td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name={phase?.icon || 'clock'} size={12}/>
          <span style={{ fontSize: 12 }}>{phase?.label || capa.phase}</span>
        </div>
        <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
          {CAPA_PHASES.slice(0, -1).map((p, i) => (
            <div key={p.id} style={{
              flex: 1, height: 3, borderRadius: 1.5,
              background: i <= phaseIdx ? 'var(--accent)' : 'var(--border)',
            }}/>
          ))}
        </div>
      </td>
      <td><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Avatar user={owner} size={20}/><span style={{ fontSize: 12 }}>{owner.name.split(' ')[0]}</span></div></td>
      <td>
        <span className="k-chip" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', fontSize: 10.5, textTransform: 'uppercase' }}>
          {capa.source === '8d' ? '8D' : capa.source}
        </span>
        {capa.sourceRef && <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 3 }}>{capa.sourceRef}</div>}
      </td>
      <td>
        <div style={{ fontSize: 12 }}>{capa.dueDate}</div>
        <div style={{ fontSize: 10.5, color: capa.slaStatus === 'at_risk' ? '#c2410c' : capa.slaStatus === 'breached' ? '#dc2626' : 'var(--text-muted)' }}>
          {capa.slaStatus === 'at_risk' ? '⚠ at risk' : capa.slaStatus === 'breached' ? '⚠ overdue' : `${capa.daysOpen}d open`}
        </div>
      </td>
      <td><RiskBadge risk={capa.risk}/></td>
    </tr>
  );
}

function CapaTrendChart() {
  const data = CAPA_TREND;
  const max = Math.max(...data.map(d => Math.max(d.opened, d.closed)));
  const W = 720, H = 160, PAD = 24;
  const xStep = (W - PAD * 2) / (data.length - 1);
  const y = v => H - PAD - (v / max) * (H - PAD * 2);
  const linePts = (key) => data.map((d, i) => `${PAD + i * xStep},${y(d[key])}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 160 }}>
      {[0.25, 0.5, 0.75, 1].map(t => (
        <line key={t} x1={PAD} x2={W - PAD} y1={H - PAD - t * (H - PAD * 2)} y2={H - PAD - t * (H - PAD * 2)} stroke="var(--border)" strokeDasharray="2 4"/>
      ))}
      <polyline fill="none" stroke="#2563eb" strokeWidth={2} points={linePts('opened')}/>
      <polyline fill="none" stroke="#22c55e" strokeWidth={2} points={linePts('closed')}/>
      {data.map((d, i) => (
        <g key={d.month}>
          <circle cx={PAD + i * xStep} cy={y(d.opened)} r={3} fill="#2563eb"/>
          <circle cx={PAD + i * xStep} cy={y(d.closed)} r={3} fill="#22c55e"/>
          <text x={PAD + i * xStep} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--text-muted)">{d.month}</text>
        </g>
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// CAPA DETAIL — phase-driven workflow
// ─────────────────────────────────────────────────────────────
function CapaDetail({ id, setRoute, setNcr, set8d }) {
  const capa = CAPAS.find(c => c.id === id) || CAPAS[0];
  const [tab, setTab] = React.useState('plan');
  const [phase, setPhase] = React.useState(capa.phase);
  const [toast, setToast] = React.useState(null);
  const owner = userById(capa.ownerId);
  const phaseIdx = CAPA_PHASES.findIndex(p => p.id === phase);
  const atEnd = phaseIdx >= CAPA_PHASES.length - 1;
  const nextPhase = atEnd ? null : CAPA_PHASES[phaseIdx + 1];
  const displayStatus = phase === 'closed'
    ? 'closed'
    : (capa.status === 'in_progress' ? 'in_progress' : capa.status === 'verification' ? 'verified' : capa.status);

  // Resync when navigating to a different CAPA (instance can be reused by React)
  React.useEffect(() => { setPhase(capa.phase); }, [capa.id]);

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => setToast(null), 2600);
  };

  const advancePhase = () => {
    if (atEnd) return;
    const np = CAPA_PHASES[phaseIdx + 1];
    setPhase(np.id);
    showToast(np.id === 'closed' ? `${capa.id} closed — workflow complete` : `Advanced to ${np.label}`);
  };

  return (
    <div>
      <div style={{ padding: '20px 28px 0' }}>
        <button onClick={() => setRoute('capa')} className="k-btn-plain" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
          <Icon name="arrowLeft" size={14}/> Back to CAPAs
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span className="k-chip" style={{
                background: capa.type === 'corrective' ? 'rgba(220,38,38,0.10)' : 'rgba(37,99,235,0.10)',
                color: capa.type === 'corrective' ? '#b91c1c' : '#1d4ed8',
              }}>{capa.type === 'corrective' ? 'Corrective' : 'Preventive'}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>{capa.id}</span>
              <StatusBadge status={displayStatus}/>
              <PriorityBadge priority={capa.priority === 'critical' ? 'critical' : capa.priority === 'high' ? 'major' : 'minor'}/>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, marginBottom: 6, letterSpacing: '-0.02em' }}>{capa.title}</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>{capa.description}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="k-btn k-btn-secondary" onClick={() => kToast(`Export started — ${capa.id.toLowerCase()}.pdf`)}><Icon name="download" size={14}/> Export</button>
            <button
              className="k-btn k-btn-primary"
              onClick={advancePhase}
              disabled={atEnd}
              style={atEnd ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
              title={atEnd ? 'This CAPA has reached the final phase' : `Move to ${nextPhase.label}`}>
              <Icon name={atEnd ? 'lock' : 'arrowRight'} size={14}/> {atEnd ? 'Closed' : `Advance to ${nextPhase.label}`}
            </button>
          </div>
        </div>
      </div>

      {/* Phase tracker */}
      <div style={{ padding: '20px 28px 0' }}>
        <div className="k-surface" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Current phase</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{CAPA_PHASES[phaseIdx]?.label || capa.phase}</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 14 }}>
              <span><Icon name="clock" size={12}/> Opened {capa.opened} ({capa.daysOpen}d)</span>
              <span><Icon name="calendar" size={12}/> Due {capa.dueDate}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 0 }}>
            {CAPA_PHASES.map((p, i) => {
              const done = i < phaseIdx, current = i === phaseIdx;
              return (
                <div key={p.id} style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%',
                      background: done || current ? 'var(--accent)' : 'var(--bg-subtle)',
                      color: (done || current) ? 'white' : 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: `2px solid ${(done || current) ? 'var(--accent)' : 'var(--border)'}`,
                      flexShrink: 0,
                    }}>
                      {done ? <Icon name="check" size={12}/> : <Icon name={p.icon} size={12}/>}
                    </div>
                    {i < CAPA_PHASES.length - 1 && (
                      <div style={{ flex: 1, height: 2, background: i < phaseIdx ? 'var(--accent)' : 'var(--border)' }}/>
                    )}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, fontWeight: current ? 600 : 500, color: current ? 'var(--text)' : 'var(--text-muted)' }}>{p.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: '20px 28px', display: 'grid', gridTemplateColumns: '1fr 320px', gap: 18 }}>
        <div>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 14 }}>
            {[
              { id: 'plan', label: 'Action plan', count: capa.actions?.length || 0, icon: 'clipboard' },
              { id: 'rca', label: 'Root cause', icon: 'brain' },
              { id: 'effectiveness', label: 'Effectiveness', count: capa.effectivenessChecks?.length || 0, icon: 'shieldCheck' },
              { id: 'history', label: 'Activity', icon: 'history' },
            ].map(tb => (
              <button key={tb.id} onClick={() => setTab(tb.id)}
                style={{
                  padding: '10px 16px', fontSize: 13, fontWeight: 500,
                  borderBottom: tab === tb.id ? '2px solid var(--accent)' : '2px solid transparent',
                  color: tab === tb.id ? 'var(--text)' : 'var(--text-muted)',
                  marginBottom: -1, display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                <Icon name={tb.icon} size={13}/> {tb.label}
                {tb.count !== undefined && tb.count > 0 && (
                  <span style={{ background: 'var(--bg-subtle)', padding: '1px 6px', borderRadius: 8, fontSize: 11, fontWeight: 600 }}>{tb.count}</span>
                )}
              </button>
            ))}
          </div>

          {tab === 'plan' && <CapaActionPlan capa={capa}/>}
          {tab === 'rca' && <CapaRootCause capa={capa}/>}
          {tab === 'effectiveness' && <CapaEffectiveness capa={capa}/>}
          {tab === 'history' && <CapaActivity capa={capa}/>}
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="k-surface" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 10 }}>Details</div>
            <DetailRow label="Owner" value={<><Avatar user={owner} size={18}/> <span style={{ fontSize: 12.5 }}>{owner.name}</span></>}/>
            <DetailRow label="Sponsor" value={<><Avatar user={capa.sponsorId} size={18}/> <span style={{ fontSize: 12.5 }}>{userById(capa.sponsorId).name}</span></>}/>
            <DetailRow label="Type" value={capa.type === 'corrective' ? 'Corrective' : 'Preventive'}/>
            <DetailRow label="Priority" value={<PriorityBadge priority={capa.priority === 'critical' ? 'critical' : capa.priority === 'high' ? 'major' : 'minor'}/>}/>
            <DetailRow label="Risk" value={<RiskBadge risk={capa.risk}/>}/>
            <DetailRow label="Opened" value={capa.opened}/>
            <DetailRow label="Due" value={capa.dueDate}/>
            {capa.targetEffectiveness && <DetailRow label="Eff. check" value={capa.targetEffectiveness}/>}
          </div>

          <div className="k-surface" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 10 }}>Linked items</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {capa.sourceRef && (
                <LinkedItem icon={capa.source === 'audit' ? 'audit' : capa.source === '8d' ? 'brain' : 'clipboard'}
                  label={capa.source === 'audit' ? 'Source audit' : capa.source === '8d' ? '8D' : 'Source inspection'}
                  id={capa.sourceRef}
                  onClick={() => {
                    if (capa.source === 'audit') setRoute('audits');
                    else if (capa.source === '8d') { set8d(capa.sourceRef); setRoute('8d-detail'); }
                  }}/>
              )}
              {capa.linkedNcr && (
                <LinkedItem icon="alert" label="NCR" id={capa.linkedNcr}
                  onClick={() => { setNcr(capa.linkedNcr); setRoute('ncr-detail'); }}/>
              )}
              {capa.linked8d && (
                <LinkedItem icon="brain" label="8D" id={capa.linked8d}
                  onClick={() => { set8d(capa.linked8d); setRoute('8d-detail'); }}/>
              )}
              {capa.findingId && (
                <LinkedItem icon="audit" label="Audit finding" id={capa.findingId} onClick={() => {}}/>
              )}
            </div>
          </div>

          <div className="k-surface" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 10 }}>Team</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {capa.teamIds.map(uid => {
                const u = userById(uid);
                return (
                  <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <Avatar user={u} size={20}/>
                    <span>{u.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 100,
          background: '#16a34a', color: 'white', padding: '11px 18px', borderRadius: 'var(--r-lg)',
          boxShadow: '0 10px 30px rgba(15,23,42,0.25)', display: 'flex', alignItems: 'center', gap: 9,
          fontSize: 13, fontWeight: 600,
        }}>
          <Icon name="check" size={15} stroke={3}/> {toast}
        </div>
      )}
    </div>
  );
}

function LinkedItem({ icon, label, id, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', padding: '8px 10px',
      border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
      background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 8,
      cursor: 'pointer', textAlign: 'left',
    }}>
      <div style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={13}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent)' }}>{id}</div>
      </div>
      <Icon name="chevronRight" size={14} className="" />
    </button>
  );
}

function CapaActionPlan({ capa }) {
  if (!capa.actions || capa.actions.length === 0) {
    return <EmptyState icon="clipboard" title="No actions yet" body="Add corrective or preventive actions to this CAPA."/>;
  }
  const completed = capa.actions.filter(a => a.status === 'completed').length;
  return (
    <div className="k-surface" style={{ padding: 0 }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Action plan ({completed}/{capa.actions.length} complete)</div>
        <button className="k-btn k-btn-secondary" style={{ height: 28, fontSize: 12 }} onClick={() => kToast('New action drafted — assign an owner to activate')}><Icon name="plus" size={12}/> Add action</button>
      </div>
      <div>
        {capa.actions.map(a => {
          const owner = userById(a.owner);
          const done = a.status === 'completed';
          const inProg = a.status === 'in_progress';
          return (
            <div key={a.id} style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${done ? '#22c55e' : inProg ? 'var(--accent)' : 'var(--border)'}`,
                background: done ? '#22c55e' : 'transparent',
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginTop: 2,
              }}>
                {done && <Icon name="check" size={12}/>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, textDecoration: done ? 'line-through' : 'none', color: done ? 'var(--text-muted)' : 'var(--text)' }}>{a.title}</div>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                  <span><Avatar user={owner} size={14}/> {owner.name.split(' ')[0]}</span>
                  <span><Icon name="calendar" size={11}/> {a.due}</span>
                  {a.evidence > 0 && <span><Icon name="paperclip" size={11}/> {a.evidence} files</span>}
                </div>
              </div>
              <StatusBadge status={a.status === 'completed' ? 'completed' : a.status === 'in_progress' ? 'in_progress' : 'pending'}/>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CapaRootCause({ capa }) {
  return (
    <div className="k-surface" style={{ padding: 18 }}>
      <h4 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 10px' }}>Root cause analysis</h4>
      <div style={{ marginBottom: 14, fontSize: 12, color: 'var(--text-muted)' }}>
        Method: <strong style={{ color: 'var(--text)' }}>{capa.rcaMethod === '5_whys' ? '5 Whys' : 'Fishbone'}</strong>
      </div>
      {capa.rootCause ? (
        <div style={{ padding: 14, background: 'var(--accent-soft)', borderLeft: '3px solid var(--accent)', borderRadius: 'var(--r-sm)', fontSize: 13, lineHeight: 1.6 }}>
          {capa.rootCause}
        </div>
      ) : (
        <EmptyState icon="brain" title="Root cause not yet documented" body="Run a 5-whys or fishbone analysis to identify the root cause."
          action={<button className="k-btn k-btn-primary" style={{ marginTop: 12 }}><Icon name="brain" size={13}/> Start analysis</button>}/>
      )}
      {capa.linked8d && (
        <div style={{ marginTop: 14, padding: 12, background: 'var(--bg-subtle)', borderRadius: 'var(--r-sm)', fontSize: 12 }}>
          <Icon name="link" size={11}/> Detailed root cause analysis available in linked 8D: <strong>{capa.linked8d}</strong>
        </div>
      )}
    </div>
  );
}

function CapaEffectiveness({ capa }) {
  if (!capa.effectivenessChecks) {
    return <EmptyState icon="shieldCheck" title="Effectiveness checks not scheduled" body="Effectiveness checks are scheduled after action plan completion."/>;
  }
  return (
    <div className="k-surface" style={{ padding: 18 }}>
      <h4 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>Effectiveness verification</h4>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
        Verifying that the implemented actions are sustainably effective. Target: {capa.targetEffectiveness}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {capa.effectivenessChecks.map((c, i) => {
          const isPass = c.result === 'pass';
          const isFail = c.result === 'fail';
          const pending = c.result === 'pending';
          return (
            <div key={c.id} style={{ padding: 14, border: `1px solid ${isPass ? '#22c55e' : isFail ? '#dc2626' : 'var(--border)'}`, borderRadius: 'var(--r-md)', background: isPass ? 'rgba(34,197,94,0.06)' : isFail ? 'rgba(220,38,38,0.06)' : 'var(--surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: isPass ? '#22c55e' : isFail ? '#dc2626' : 'var(--bg-subtle)', color: pending ? 'var(--text-muted)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                  {isPass ? <Icon name="check" size={14}/> : isFail ? <Icon name="x" size={14}/> : i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Check {i + 1} — {c.date}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{c.metric} (target: {c.target})</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {pending ? (
                    <span className="k-chip" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>Pending</span>
                  ) : (
                    <>
                      <div style={{ fontSize: 14, fontWeight: 700, color: isPass ? '#15803d' : '#b91c1c' }}>{c.actual}</div>
                      <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', color: isPass ? '#15803d' : '#b91c1c' }}>{c.result}</div>
                    </>
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

function CapaActivity({ capa }) {
  const events = [
    { time: capa.opened, who: 'u1', what: `Created CAPA from ${capa.source}`, icon: 'plus' },
    { time: capa.opened, who: 'u1', what: `Assigned to ${userById(capa.ownerId).name}`, icon: 'user' },
    { time: '2026-04-18', who: capa.ownerId, what: 'Drafted action plan with 4 corrective actions', icon: 'clipboard' },
    { time: '2026-04-19', who: capa.ownerId, what: 'Action #1 in progress: regulator replacement scheduled', icon: 'tool' },
    { time: '2026-04-20', who: 'u4', what: 'Auditor approved action plan', icon: 'check' },
  ];
  return (
    <div className="k-surface" style={{ padding: 18 }}>
      <h4 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 14px' }}>Activity history</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {events.map((e, i) => {
          const u = userById(e.who);
          return (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={e.icon} size={13}/>
              </div>
              <div style={{ flex: 1, fontSize: 12.5 }}>
                <div><strong>{u.name}</strong> {e.what}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{e.time}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { CapaList, CapaDetail, CAPA_PHASES });
