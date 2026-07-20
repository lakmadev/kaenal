// Kaenal — 8D workflow

const fmtStepDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[(m || 1) - 1]} ${d}`;
};

const D_STEPS = [
{ key: 'D1', title: 'Team', desc: 'Form the team' },
{ key: 'D2', title: 'Problem', desc: 'Describe the problem' },
{ key: 'D3', title: 'Contain', desc: 'Interim containment' },
{ key: 'D4', title: 'Root Cause', desc: 'Analyze & verify' },
{ key: 'D5', title: 'Corrective', desc: 'Choose permanent actions' },
{ key: 'D6', title: 'Implement', desc: 'Validate effectiveness' },
{ key: 'D7', title: 'Prevent', desc: 'Systemic changes' },
{ key: 'D8', title: 'Close', desc: 'Congratulate team' }];


const EightDList = ({ setRoute, set8d, openCreate }) => {
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [extraFilters, setExtraFilters] = React.useState({ status: 'any', lead: 'any' });
  const filterRef = React.useRef(null);

  React.useEffect(() => {
    if (!filtersOpen) return;
    const close = (e) => { if (filterRef.current && !filterRef.current.contains(e.target)) setFiltersOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [filtersOpen]);

  const uniqueLeads = [...new Set(EIGHT_D_LIST.map((e) => e.teamLeadId))];
  const activeFilterCount = (extraFilters.status !== 'any' ? 1 : 0) + (extraFilters.lead !== 'any' ? 1 : 0);
  const filtered = EIGHT_D_LIST.filter((e) =>
    (extraFilters.status === 'any' || e.status === extraFilters.status) &&
    (extraFilters.lead === 'any' || e.teamLeadId === extraFilters.lead)
  );

  return (
  <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }} className="fade-in">
    <PageHeader title="8D Reports" description="Guided D1–D8 problem solving — Kaenal's quality differentiator"
  actions={<>
        <div style={{ position: 'relative' }}>
          <button className="k-btn k-btn-ghost" data-comment-anchor="40101118e0-button-17-18" onClick={() => setFiltersOpen((v) => !v)}>
            <Icon name="filter" size={14} />Filters
            {activeFilterCount > 0 && <span style={{ background: 'var(--accent)', color: 'white', fontSize: 10, fontWeight: 700, padding: '0 6px', borderRadius: 'var(--r-full)', minWidth: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{activeFilterCount}</span>}
          </button>
          {filtersOpen &&
          <div ref={filterRef} className="k-surface" style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, padding: 16, minWidth: 280, zIndex: 30, boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Filters</div>
                <button className="k-btn-plain" style={{ fontSize: 11, color: 'var(--text-muted)' }} onClick={() => setExtraFilters({ status: 'any', lead: 'any' })}>Reset</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="k-overline">Status</span>
                <select className="k-input" value={extraFilters.status} onChange={(e) => setExtraFilters((f) => ({ ...f, status: e.target.value }))}>
                  <option value="any">Any</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="k-overline">Team Lead</span>
                <select className="k-input" value={extraFilters.lead} onChange={(e) => setExtraFilters((f) => ({ ...f, lead: e.target.value }))}>
                  <option value="any">Any</option>
                  {uniqueLeads.map((id) => <option key={id} value={id}>{userById(id).name}</option>)}
                </select>
              </div>
            </div>
          }
        </div>
        <button className="k-btn k-btn-primary" onClick={() => openCreate && openCreate('8d')}><Icon name="plus" size={14} />Start 8D</button>
      </>} />

    <div className="k-surface" style={{ padding: 0, overflow: 'hidden' }}>
      <table className="k-table">
        <thead><tr>
          <th style={{ width: 140 }}>ID</th><th>Title</th>
          <th style={{ width: 130 }}>Linked NCR</th>
          <th style={{ width: 260 }}>Progress</th>
          <th style={{ width: 130 }}>Team Lead</th>
          <th style={{ width: 110 }}>Status</th>
          <th style={{ width: 110 }}>Target</th>
        </tr></thead>
        <tbody>
          {filtered.length === 0 &&
          <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No 8D reports match these filters.</td></tr>
          }
          {filtered.map((e) => {
          const u = userById(e.teamLeadId);
          return (
            <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => {set8d(e.id);setRoute('8d-detail');}}>
                <td><span className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>{e.id}</span></td>
                <td style={{ fontWeight: 500 }}>{e.title}</td>
                <td><span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.ncrId}</span></td>
                <td><StepperMini current={e.currentStep} /></td>
                <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar user={u} size={22} /><span style={{ fontSize: 12 }}>{u.name.split(' ')[0]}</span></div></td>
                <td><StatusBadge status={e.status} /></td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{e.target}</td>
              </tr>);

        })}
        </tbody>
      </table>
    </div>
  </div>);
};


const StepperMini = ({ current }) =>
<div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
  <div key={n} style={{ flex: 1, height: 6, borderRadius: 3, background: n < current ? 'var(--success-500)' : n === current ? 'var(--warning-500)' : 'var(--border)' }} />
  )}
    <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginLeft: 6 }}>D{current}/8</span>
  </div>;


const EightDDetail = ({ id, setRoute, setNcr, set8d, setCapa }) => {
  const e = EIGHT_D;
  const [activeStep, setActiveStep] = React.useState(4);
  const [accepted, setAccepted] = React.useState(null);
  const [fieldStates, setFieldStates] = React.useState({});
  const [genModal, setGenModal] = React.useState(null); // null | 'capa' | 'audit'
  const [toast, setToast] = React.useState(null);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const moreRef = React.useRef(null);
  const lead = userById(e.teamLeadId);

  React.useEffect(() => {
    if (!moreOpen) return;
    const close = (ev) => { if (moreRef.current && !moreRef.current.contains(ev.target)) setMoreOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [moreOpen]);

  const approveField = (k) => setFieldStates((s) => ({ ...s, [k]: 'approved' }));
  const editField = (k) => { setFieldStates((s) => ({ ...s, [k]: 'edited' })); setToast('Editing AI draft — you now own this field'); };
  const approveAll = () => setFieldStates(() => Object.fromEntries(AI_FIELD_KEYS.map((k) => [k, fieldStates[k] === 'edited' ? 'edited' : 'approved'])));
  const ai = { fieldStates, approveField, editField };

  return (
    <div style={{ padding: '20px 28px 28px', display: 'flex', flexDirection: 'column', gap: 16 }} className="fade-in">
      <button onClick={() => setRoute('8d')} className="k-btn-plain" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '4px 0', alignSelf: 'flex-start', color: 'var(--text-muted)' }}>
        <Icon name="arrowLeft" size={14} />Back to 8D Reports
      </button>

      <div className="k-surface" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
              <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{e.id}</span>
              <StatusBadge status={e.status} />
              <button onClick={() => {setNcr(e.ncrId);setRoute('ncr-detail');}} className="k-chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}><Icon name="link" size={11} />{e.ncrId}</button>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: 0, marginBottom: 10 }}>{e.title}</h1>
            <div style={{ display: 'flex', gap: 20, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Avatar user={lead} size={18} />Lead: {lead.name}</span>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Icon name="users" size={13} />{e.team.length} members</span>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Icon name="calendar" size={13} />Started {e.startedAt}</span>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Icon name="target" size={13} />Target {e.target}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={() => setGenModal('audit')} className="k-btn k-btn-ghost"><Icon name="fileText" size={14} />Audit-ready report</button>
            <button onClick={() => setGenModal('capa')} className="k-btn k-btn-primary" style={{ background: 'linear-gradient(135deg, #6366f1, #db2777)', border: 'none' }}><Icon name="sparkles" size={14} />Generate CAPA pack</button>
            <div style={{ position: 'relative' }} ref={moreRef}>
              <button onClick={() => setMoreOpen((v) => !v)} className="k-btn k-btn-ghost k-btn-icon"><Icon name="more" size={16} /></button>
              {moreOpen &&
                <div className="k-surface" style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, padding: 6, minWidth: 180, zIndex: 30, boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button onClick={() => { setMoreOpen(false); setRoute('8d-pdf'); }} className="k-btn-plain" style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 'var(--r-md)', fontSize: 13, textAlign: 'left' }}><Icon name="download" size={14} />Report PDF</button>
                  <button onClick={() => { setMoreOpen(false); setToast('Share link copied to clipboard'); }} className="k-btn-plain" style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 'var(--r-md)', fontSize: 13, textAlign: 'left' }}><Icon name="send" size={14} />Share 8D</button>
                </div>}
            </div>
          </div>
        </div>
      </div>

      {/* AI provenance — D1–D4 drafted from the linked NCR */}
      <AIProvenanceStrip e={e} fieldStates={fieldStates} onApproveAll={approveAll} setNcr={setNcr} setRoute={setRoute} />

      {/* Two-column workspace: workflow + AI copilot rail */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 322px', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {/* Stepper */}
          <div className="k-surface" style={{ padding: '24px 28px 22px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span className="k-overline">Workflow progress</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {e.currentStep - 1} of {D_STEPS.length} complete · D{e.currentStep} in progress
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success-500)' }} />Complete</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warning-500)' }} />In progress</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--surface)', border: '1.5px solid var(--border-strong)' }} />Pending</span>
              </div>
            </div>

            {/* Rail */}
            <div style={{ position: 'relative', padding: '0 4px' }}>
              {D_STEPS.slice(0, -1).map((_, i) => {
                const n = i + 1;
                const inset = 18;
                const leftPct = (n - 0.5) / D_STEPS.length * 100;
                const rightPct = 100 - (n + 0.5) / D_STEPS.length * 100;
                const bothComplete = (n + 1) < e.currentStep;
                const toCurrent = (n + 1) === e.currentStep;
                const bg = bothComplete
                  ? 'var(--success-500)'
                  : toCurrent
                    ? 'linear-gradient(90deg, var(--success-500), var(--warning-500))'
                    : 'var(--border)';
                return (
                  <div key={'conn-' + i} style={{
                    position: 'absolute', top: 17, height: 2, borderRadius: 2,
                    left: `calc(${leftPct}% + ${inset}px)`,
                    right: `calc(${rightPct}% + ${inset}px)`,
                    background: bg, zIndex: 0
                  }} />);
              })}

              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${D_STEPS.length}, minmax(0, 1fr))`, position: 'relative' }}>
                {D_STEPS.map((s, i) => {
                  const stepNum = i + 1;
                  const step = e.steps[s.key];
                  const complete = stepNum < e.currentStep;
                  const current = stepNum === e.currentStep;
                  const locked = stepNum > e.currentStep;
                  const isActive = activeStep === stepNum;
                  const statusLabel = complete ? 'Complete' : current ? 'In progress' : 'Pending';
                  const statusColor = complete ? 'var(--success-600)' : current ? 'var(--warning-700)' : 'var(--text-subtle)';

                  return (
                    <button key={s.key} onClick={() => !locked && setActiveStep(stepNum)} disabled={locked}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      padding: '0 2px',
                      cursor: locked ? 'not-allowed' : 'pointer',
                      opacity: locked ? 0.55 : 1,
                      background: 'transparent', border: 'none',
                      position: 'relative'
                    }}>
                      {/* Circle */}
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: complete ? 'var(--success-500)' : current ? 'var(--warning-500)' : 'var(--surface)',
                        border: complete || current ? 'none' : '2px solid var(--border-strong)',
                        color: complete || current ? 'white' : 'var(--text-muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700,
                        boxShadow: isActive ? '0 0 0 4px var(--surface), 0 0 0 6px var(--accent), 0 4px 12px rgba(0,0,0,0.08)' : current ? '0 0 0 4px rgba(245,158,11,0.18)' : 'none',
                        transition: 'box-shadow 160ms ease, transform 160ms ease',
                        transform: isActive ? 'translateY(-1px)' : 'none',
                        zIndex: 2
                      }}>
                        {complete ? <Icon name="check" size={16} stroke={3} /> : s.key}
                      </div>

                      {/* Title + viewing pill */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, marginTop: 4 }}>
                        <div style={{
                          fontSize: 12, fontWeight: 700,
                          color: isActive ? 'var(--accent)' : locked ? 'var(--text-subtle)' : 'var(--text)',
                          letterSpacing: '-0.005em'
                        }}>{s.title}</div>
                        <div style={{
                          fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.35,
                          maxWidth: 110
                        }}>{s.desc}</div>
                      </div>

                      {/* Status row */}
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 10, fontWeight: 600, color: statusColor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {current && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--warning-500)', animation: 'k-pulse 1.4s ease-in-out infinite' }} />}
                        {complete && <Icon name="check" size={10} stroke={3} />}
                        {locked && <Icon name="lock" size={9} stroke={2} />}
                        {statusLabel}
                      </div>

                      {/* Completed date */}
                      {complete && step?.completedAt &&
                      <div style={{ fontSize: 10, color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
                        {fmtStepDate(step.completedAt)}
                      </div>
                      }

                      {/* Viewing indicator under active */}
                      {isActive &&
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', borderRadius: 'var(--r-full)',
                        background: 'var(--accent)', color: 'white',
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                        whiteSpace: 'nowrap', marginTop: 4
                      }}>
                          <Icon name="eye" size={10} stroke={2.5} />Viewing
                        </div>
                      }
                    </button>);

                })}
              </div>
            </div>
          </div>

          {/* Active step body */}
          {activeStep === 1 && <D1Step team={e.team} lead={lead} champ={userById(e.championId)} startedAt={e.startedAt} ai={ai} />}
          {activeStep === 2 && <D2Step step={e.steps.D2} ai={ai} />}
          {activeStep === 3 && <D3Step step={e.steps.D3} ai={ai} />}
          {activeStep === 4 && <D4Step step={e.steps.D4} accepted={accepted} setAccepted={setAccepted} ai={ai} />}
          {activeStep > 4 && <StepLocked step={D_STEPS[activeStep - 1]} />}
        </div>

        {/* AI copilot side-rail */}
        <AICopilotRail e={e} accepted={accepted} setAccepted={setAccepted} setRoute={setRoute} setNcr={setNcr} set8d={set8d} onToast={setToast} />
      </div>

      {genModal && <GeneratePackModal type={genModal} e={e} onClose={() => setGenModal(null)} setRoute={setRoute} />}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>);

};

const StepHeader = ({ step, badge }) =>
<div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4, padding: '0 4px' }}>
    <div style={{ width: 30, height: 30, borderRadius: 'var(--r-md)', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{step}</div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>{D_STEPS[parseInt(step[1]) - 1].title}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{D_STEPS[parseInt(step[1]) - 1].desc}</div>
    </div>
    {badge}
  </div>;


const D1Step = ({ team, lead, champ, startedAt, ai }) =>
<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <StepHeader step="D1" badge={<span className="k-chip" style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}><Icon name="check" size={11} stroke={3} />Complete</span>} />
    <div className="k-surface" style={{ padding: 20 }}>
      <AiCardHeader label="Team & roles" fieldKey="d1" ai={ai} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <div className="k-overline" style={{ marginBottom: 8 }}>Team Lead</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar user={lead} size={36} /><div><div style={{ fontSize: 14, fontWeight: 600 }}>{lead.name}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lead.role}</div></div></div>
        </div>
        <div>
          <div className="k-overline" style={{ marginBottom: 8 }}>Champion / Sponsor</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar user={champ} size={36} /><div><div style={{ fontSize: 14, fontWeight: 600 }}>{champ.name}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{champ.role}</div></div></div>
        </div>
      </div>
      <div style={{ marginTop: 20 }}>
        <div className="k-overline" style={{ marginBottom: 8 }}>Team members ({team.length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {team.map((t) => {const u = userById(t.userId);return (
            <div key={t.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)' }}>
              <Avatar user={u} size={26} />
              <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500 }}>{u.name}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.role}</div></div>
              <span className="k-chip" style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{t.role}</span>
            </div>);
        })}
        </div>
      </div>
    </div>
  </div>;


const D2Step = ({ step, ai }) =>
<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <StepHeader step="D2" badge={<span className="k-chip" style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}><Icon name="check" size={11} stroke={3} />Complete</span>} />
    <div className="k-surface" style={{ padding: 20 }}>
      <AiCardHeader label="Problem statement" fieldKey="d2-problem" ai={ai} />
      <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>{step.problemStatement}</p>
    </div>
    <div className="k-surface" style={{ padding: 20 }}>
      <AiCardHeader label="IS / IS NOT analysis" fieldKey="d2-isisnot" ai={ai} />
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
        <thead><tr>
          <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)', width: 90 }}></th>
          <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, color: 'var(--success-700)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)' }}>IS</th>
          <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, color: 'var(--danger-700)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)' }}>IS NOT</th>
        </tr></thead>
        <tbody>
          {Object.entries(step.isIsNot).map(([k, v], i, arr) =>
        <tr key={k}>
              <td style={{ padding: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'capitalize', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>{k === 'howMuch' ? 'How much' : k}</td>
              <td style={{ padding: '10px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', background: 'rgba(34,197,94,0.04)' }}>{v.is}</td>
              <td style={{ padding: '10px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', background: 'rgba(220,38,38,0.04)' }}>{v.isNot}</td>
            </tr>
        )}
        </tbody>
      </table>
    </div>
    <div className="k-surface" style={{ padding: 20 }}>
      <AiCardHeader label="Impact assessment" fieldKey="d2-impact" ai={ai} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        <div><div className="k-overline">Cost impact</div><div className="mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--danger-600)', marginTop: 4 }}>${(step.cost / 1000).toFixed(0)}k</div></div>
        <div><div className="k-overline">Affected qty</div><div className="mono" style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{step.quantity.toLocaleString()}</div></div>
        <div><div className="k-overline">Customer impact</div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning-700)', marginTop: 6 }}>Tier-1 OEM notified — containment accepted</div></div>
      </div>
    </div>
  </div>;


const D3Step = ({ step, ai }) =>
<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <StepHeader step="D3" badge={<span className="k-chip" style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}><Icon name="check" size={11} stroke={3} />Complete — containment effective</span>} />
    <div className="k-surface" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>Containment actions</span>
        {ai && <AiDraftControls state={ai.fieldStates['d3']} onApprove={() => ai.approveField('d3')} onEdit={() => ai.editField('d3')} />}
      </div>
      {step.actions.map((a, i) => {const u = userById(a.owner);return (
        <div key={i} style={{ padding: '12px 20px', borderBottom: i < step.actions.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--success-500)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="check" size={12} stroke={3} /></div>
          <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{a.title}</div>
          <Avatar user={u} size={22} />
          <StatusBadge status={a.status} />
        </div>);
    })}
    </div>
  </div>;


const D4Step = ({ step, accepted, setAccepted, ai }) => {
  const [analyses, setAnalyses] = React.useState([
    { id: 1, type: 'fivewhys', title: '5 Whys', seed: step.fiveWhys },
    { id: 2, type: 'fishbone', title: 'Fishbone (Ishikawa)' } ]);
  const [nextId, setNextId] = React.useState(3);
  const [picker, setPicker] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState({});
  const pickerRef = React.useRef(null);

  React.useEffect(() => {
    if (!picker) return;
    const close = (ev) => { if (pickerRef.current && !pickerRef.current.contains(ev.target)) setPicker(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [picker]);

  const addAnalysis = (m) => {
    const sameType = analyses.filter((a) => a.type === m.type).length;
    setAnalyses((prev) => [...prev, { id: nextId, type: m.type, title: sameType ? `${m.name} ${sameType + 1}` : m.name }]);
    setNextId((n) => n + 1);
    setPicker(false);
  };
  const removeAnalysis = (id) => setAnalyses((prev) => prev.filter((a) => a.id !== id));
  const renameAnalysis = (id, title) => setAnalyses((prev) => prev.map((a) => a.id === id ? { ...a, title } : a));
  const toggleCollapse = (id) => setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  const renderMethod = (a) => {
    switch (a.type) {
      case 'fivewhys': return <FiveWhysCard seed={a.seed} />;
      case 'fishbone': return <Fishbone />;
      case 'pareto': return <ParetoCard />;
      case 'fiveW2H': return <FiveW2HCard />;
      case 'timeline': return <TimelineCard />;
      case 'freeform': return <FreeformCard />;
      default: return null;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <StepHeader step="D4" badge={<span className="k-chip" style={{ background: 'var(--warning-100)', color: 'var(--warning-700)' }}><span className="pulse-dot" style={{ background: 'var(--warning-500)' }} />In progress</span>} />

      {/* Root cause comes from the AI Copilot rail — this strip reflects the decision */}
      <div className="k-surface" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 13, borderLeft: accepted !== null ? '3px solid var(--success-500)' : '3px solid #6366f1' }}>
        <div style={{ width: 34, height: 34, borderRadius: 'var(--r-md)', background: accepted !== null ? 'var(--success-50)' : 'rgba(99,102,241,0.1)', color: accepted !== null ? 'var(--success-600)' : '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name={accepted !== null ? 'check' : 'sparkles'} size={17} stroke={accepted !== null ? 3 : 2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {accepted !== null ?
            <>
              <div className="k-overline" style={{ color: 'var(--success-600)' }}>Verified root cause · accepted from Copilot</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{step.aiSuggestions[accepted].cause}</div>
            </> :
            <>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>Choose a root cause from the AI Copilot</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>{step.aiSuggestions.length} ranked candidates with confidence are in the rail →</div>
            </>}
        </div>
        {accepted !== null && <span className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--success-600)', flexShrink: 0 }}>{step.aiSuggestions[accepted].confidence}%</span>}
      </div>

      {/* Analysis workspace — add any number of RCA methods */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>Root cause analysis</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Combine any methods below · {analyses.length} active</div>
        </div>
        <div style={{ position: 'relative' }} ref={pickerRef}>
          <button className="k-btn k-btn-primary k-btn-sm" onClick={() => setPicker((v) => !v)}><Icon name="plus" size={13} />Add method</button>
          {picker && <MethodPicker onPick={addAnalysis} />}
        </div>
      </div>

      {analyses.length === 0 &&
        <div className="k-surface" style={{ padding: 36, textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', padding: 12, borderRadius: '50%', background: 'var(--bg-subtle)', marginBottom: 10, color: 'var(--text-muted)' }}><Icon name="layers" size={24} stroke={1.6} /></div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>No analysis methods yet</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Add 5 Whys, Fishbone, Pareto and more to investigate the root cause.</div>
        </div>}

      {analyses.map((a) => {
        const m = ANALYSIS_METHODS.find((x) => x.type === a.type) || {};
        const isCollapsed = collapsed[a.id];
        return (
          <div key={a.id} className="k-surface" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderBottom: isCollapsed ? 'none' : '1px solid var(--border)' }}>
              <div style={{ width: 30, height: 30, borderRadius: 'var(--r-sm)', background: tintColor(m.color, 0.13), color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name={m.icon} size={15} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <input value={a.title} onChange={(e) => renameAnalysis(a.id, e.target.value)} title="Rename"
                  style={{ border: '1px solid transparent', background: 'transparent', font: 'inherit', fontSize: 13.5, fontWeight: 700, color: 'var(--text)', width: '100%', padding: '1px 4px', marginLeft: -4, borderRadius: 'var(--r-sm)', outline: 'none' }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--border-strong)'}
                  onBlur={(e) => e.target.style.borderColor = 'transparent'} />
                <div style={{ fontSize: 10.5, color: 'var(--text-subtle)' }}>{m.name}</div>
              </div>
              {a.seed && ai && <AiDraftControls state={ai.fieldStates['d4-fivewhys']} onApprove={() => ai.approveField('d4-fivewhys')} onEdit={() => ai.editField('d4-fivewhys')} />}
              <button className="k-btn-plain" title={isCollapsed ? 'Expand' : 'Collapse'} onClick={() => toggleCollapse(a.id)} style={{ padding: 5, color: 'var(--text-muted)', display: 'inline-flex' }}><Icon name={isCollapsed ? 'chevronRight' : 'chevronDown'} size={16} /></button>
              <button className="k-btn-plain" title="Delete analysis" onClick={() => removeAnalysis(a.id)} style={{ padding: 5, color: 'var(--text-subtle)', display: 'inline-flex' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger-500)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-subtle)'}><Icon name="trash" size={15} /></button>
            </div>
            {!isCollapsed && <div style={{ padding: 18 }}>{renderMethod(a)}</div>}
          </div>);
      })}

      <div className="k-surface" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 14, background: 'var(--bg-subtle)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Ready to advance to D5?</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Confirm root cause statement & verification evidence before moving to permanent corrective actions.</div>
        </div>
        <button className="k-btn k-btn-ghost" onClick={() => kToast('Draft saved — all D4 evidence retained')}>Save draft</button>
        <button className="k-btn k-btn-primary" disabled={accepted === null} style={{ opacity: accepted === null ? 0.5 : 1 }} onClick={() => kToast('D4 complete — root cause locked. D5 corrective actions unlocked.')}>Complete D4 →</button>
      </div>
    </div>);

};

const tintColor = (hex, a) => {
  if (!hex) return `rgba(120,120,120,${a})`;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

const ANALYSIS_METHODS = [
  { type: 'fivewhys', name: '5 Whys', icon: 'gitBranch', color: '#2563eb', desc: 'Iteratively ask "why" to drill from symptom to systemic root.' },
  { type: 'fishbone', name: 'Fishbone (Ishikawa)', icon: 'target', color: '#0891b2', desc: 'Brainstorm candidate causes across the 6M categories.' },
  { type: 'pareto', name: 'Pareto Analysis', icon: 'reports', color: '#d97706', desc: 'Rank causes by frequency to isolate the vital few (80/20).' },
  { type: 'fiveW2H', name: '5W2H', icon: 'list', color: '#16a34a', desc: 'Structured Who / What / When / Where / Why / How / How much.' },
  { type: 'timeline', name: 'Timeline & Change', icon: 'clock', color: '#9333ea', desc: 'Sequence events and pinpoint what changed before failure.' },
  { type: 'freeform', name: 'Free-form notes', icon: 'edit', color: '#64748b', desc: 'Open narrative for evidence and reasoning.' } ];

const MethodPicker = ({ onPick }) =>
  <div className="k-surface" style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, width: 340, padding: 8, zIndex: 40, boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', gap: 2 }}>
    <div className="k-overline" style={{ padding: '6px 8px 4px' }}>Add analysis method</div>
    {ANALYSIS_METHODS.map((m) =>
      <button key={m.type} onClick={() => onPick(m)} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', padding: 8, border: 'none', background: 'transparent', borderRadius: 'var(--r-md)', cursor: 'pointer' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
        <div style={{ width: 28, height: 28, borderRadius: 'var(--r-sm)', background: tintColor(m.color, 0.13), color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name={m.icon} size={14} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{m.desc}</div>
        </div>
        <Icon name="plus" size={14} stroke={2.2} />
      </button>)}
  </div>;

const FiveWhysCard = ({ seed }) => {
  const [rows, setRows] = React.useState(() => (seed && seed.length ? seed.map((r) => ({ why: r.why || '', answer: r.answer || '' })) : [{ why: '', answer: '' }]));
  const update = (i, field, val) => setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  const addRow = () => setRows((prev) => [...prev, { why: '', answer: '' }]);
  const removeRow = (i) => setRows((prev) => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map((row, i) =>
        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: row.answer ? 'var(--accent)' : 'var(--bg-subtle)', color: row.answer ? 'white' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0, border: row.answer ? 'none' : '2px dashed var(--border-strong)' }}>{i + 1}</div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input className="k-input" placeholder={`Why ${i + 1}?`} value={row.why} onChange={(e) => update(i, 'why', e.target.value)} />
            <input className="k-input" placeholder={i === rows.length - 1 ? 'Answer — becomes the next "why"' : 'Answer'} value={row.answer} onChange={(e) => update(i, 'answer', e.target.value)} />
          </div>
          <button className="k-btn-plain" title="Remove" onClick={() => removeRow(i)} disabled={rows.length <= 1} style={{ padding: 6, color: 'var(--text-subtle)', marginTop: 2, opacity: rows.length <= 1 ? 0.3 : 1 }}><Icon name="x" size={14} /></button>
        </div>)}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="k-btn k-btn-ghost k-btn-sm" onClick={addRow}><Icon name="plus" size={12} />Add why</button>
        {rows.length >= 5 && <span style={{ fontSize: 11, color: 'var(--success-600)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="check" size={12} stroke={3} />Reached 5 whys — likely at systemic root</span>}
      </div>
    </div>);
};

const ParetoCard = () => {
  const [factors, setFactors] = React.useState([
    { label: 'Regulator drift', count: 14 },
    { label: 'Checklist skipped', count: 8 },
    { label: 'Gas blend variation', count: 5 },
    { label: 'Wire feed low', count: 3 },
    { label: 'Floor draft', count: 2 } ]);
  const [label, setLabel] = React.useState('');
  const [count, setCount] = React.useState('');
  const sorted = [...factors].sort((a, b) => b.count - a.count);
  const total = sorted.reduce((s, f) => s + f.count, 0) || 1;
  const max = sorted.length ? sorted[0].count : 1;
  let cum = 0;
  const rows = sorted.map((f) => { cum += f.count; return { ...f, cumPct: cum / total * 100 }; });
  const add = () => { const n = parseInt(count, 10); if (!label.trim() || !n) return; setFactors((p) => [...p, { label: label.trim(), count: n }]); setLabel(''); setCount(''); };
  const remove = (lbl) => setFactors((p) => p.filter((f) => f.label !== lbl));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Causes ranked by occurrence. The <strong>vital few</strong> (cumulative ≤ 80%) are highlighted — focus corrective action there.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((f, idx) => {
          const vital = f.cumPct <= 80 || idx === 0;
          return (
            <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 140, fontSize: 12.5, fontWeight: vital ? 600 : 400, color: vital ? 'var(--text)' : 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>{f.label}</div>
              <div style={{ flex: 1, height: 26, background: 'var(--bg-subtle)', borderRadius: 'var(--r-sm)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', insetBlock: 0, left: 0, width: `${f.count / max * 100}%`, background: vital ? 'var(--accent)' : 'var(--border-strong)', borderRadius: 'var(--r-sm)', transition: 'width 300ms' }} />
                <span className="mono" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 700, color: vital ? 'white' : 'var(--text-muted)' }}>{f.count}</span>
              </div>
              <div className="mono" style={{ width: 46, fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>{f.cumPct.toFixed(0)}%</div>
              <button className="k-btn-plain" onClick={() => remove(f.label)} style={{ padding: 4, color: 'var(--text-subtle)', flexShrink: 0 }}><Icon name="x" size={13} /></button>
            </div>);
        })}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input className="k-input" placeholder="Cause / factor" value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} style={{ flex: 1, height: 34 }} />
        <input className="k-input" placeholder="Count" type="number" value={count} onChange={(e) => setCount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} style={{ width: 90, height: 34 }} />
        <button className="k-btn k-btn-ghost k-btn-sm" onClick={add}><Icon name="plus" size={12} />Add</button>
      </div>
    </div>);
};

const FiveW2HCard = () => {
  const FIELDS = [
    { k: 'what', q: 'What is the problem / defect?', a: 'Gas porosity in fillet welds on Part #A-7742.' },
    { k: 'where', q: 'Where does it occur?', a: 'Weld Station 3B, fillet joints only.' },
    { k: 'when', q: 'When was it first seen?', a: 'Since 2026-04-10, intermittent across all shifts.' },
    { k: 'who', q: 'Who detected it / is involved?', a: 'Final inspection (QA); all Station 3B operators.' },
    { k: 'why', q: 'Why is it a problem?', a: 'Fails X-ray; Tier-1 OEM scrap + rework cost.' },
    { k: 'how', q: 'How is it detected / manifested?', a: 'X-ray + visual; scattered subsurface voids.' },
    { k: 'howmuch', q: 'How much — qty / cost / rate?', a: '~6% reject rate · $42k to date · 318 parts.' } ];
  const [vals, setVals] = React.useState(() => Object.fromEntries(FIELDS.map((f) => [f.k, f.a])));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
      {FIELDS.map((f) =>
        <div key={f.k} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label className="k-overline">{f.q}</label>
          <textarea className="k-input" rows="2" value={vals[f.k]} onChange={(e) => setVals((v) => ({ ...v, [f.k]: e.target.value }))} style={{ height: 'auto', padding: 10, fontSize: 12.5, resize: 'vertical', lineHeight: 1.4 }} />
        </div>)}
    </div>);
};

const TimelineCard = () => {
  const [events, setEvents] = React.useState([
    { time: '2026-04-08', text: 'Preventive maintenance on Station 3B regulator deferred', change: true },
    { time: '2026-04-10', text: 'First porosity rejects detected at final X-ray', change: false },
    { time: '2026-04-12', text: 'Shielding-gas supplier switched to new blend lot', change: true },
    { time: '2026-04-16', text: 'Reject rate climbs to 6%; 8D opened', change: false } ]);
  const [time, setTime] = React.useState('');
  const [text, setText] = React.useState('');
  const add = () => { if (!text.trim()) return; setEvents((p) => [...p, { time: time.trim() || '—', text: text.trim(), change: false }]); setTime(''); setText(''); };
  const remove = (i) => setEvents((p) => p.filter((_, idx) => idx !== i));
  const toggleChange = (i) => setEvents((p) => p.map((e, idx) => idx === i ? { ...e, change: !e.change } : e));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Sequence what happened. Flag <strong style={{ color: 'var(--warning-700)' }}>changes</strong> — a deviation from the norm is often the root trigger.</div>
      <div style={{ position: 'relative', paddingLeft: 22 }}>
        <div style={{ position: 'absolute', left: 6, top: 6, bottom: 18, width: 2, background: 'var(--border)' }} />
        {events.map((ev, i) =>
          <div key={i} style={{ position: 'relative', display: 'flex', gap: 12, alignItems: 'flex-start', paddingBottom: 14 }}>
            <div style={{ position: 'absolute', left: -22, top: 3, width: 14, height: 14, borderRadius: '50%', background: ev.change ? 'var(--warning-500)' : 'var(--surface)', border: ev.change ? 'none' : '2px solid var(--border-strong)', boxShadow: '0 0 0 3px var(--surface)' }} />
            <div className="mono" style={{ width: 88, fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, paddingTop: 1 }}>{ev.time}</div>
            <div style={{ flex: 1, fontSize: 12.5, color: 'var(--text)', lineHeight: 1.4 }}>{ev.text}{ev.change && <span style={{ marginLeft: 6, fontSize: 9, padding: '1px 6px', background: 'var(--warning-100)', color: 'var(--warning-700)', borderRadius: 3, fontWeight: 700, letterSpacing: '0.04em', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>CHANGE</span>}</div>
            <button className="k-btn-plain" title={ev.change ? 'Unflag change' : 'Flag as change'} onClick={() => toggleChange(i)} style={{ padding: 3, color: ev.change ? 'var(--warning-600)' : 'var(--text-subtle)', flexShrink: 0, display: 'inline-flex' }}><Icon name="flag" size={13} /></button>
            <button className="k-btn-plain" onClick={() => remove(i)} style={{ padding: 3, color: 'var(--text-subtle)', flexShrink: 0, display: 'inline-flex' }}><Icon name="x" size={13} /></button>
          </div>)}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input className="k-input" placeholder="Date / time" value={time} onChange={(e) => setTime(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} style={{ width: 120, height: 34 }} />
        <input className="k-input" placeholder="What happened?" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} style={{ flex: 1, height: 34 }} />
        <button className="k-btn k-btn-ghost k-btn-sm" onClick={add}><Icon name="plus" size={12} />Add</button>
      </div>
    </div>);
};

const FreeformCard = () => {
  const [text, setText] = React.useState('The weld porosity on Station 3B is driven by inadequate shielding gas coverage. Flow rate measurements confirm the regulator drift (13–14 L/min vs 18 L/min spec). The regulator has been in service for 4 years — 12 months past its 3-year OEM service interval. This is the verified root cause per D4 AI suggestion #1 and on-site measurement.');
  return <textarea className="k-input" rows="7" value={text} onChange={(e) => setText(e.target.value)} style={{ height: 'auto', padding: 14, resize: 'vertical', lineHeight: 1.6, fontSize: 13 }} />;
};

const FB_CATS = [
  { name: 'Machine', color: '#2563eb', icon: 'settings', hint: 'Equipment, tooling, fixtures' },
  { name: 'Method', color: '#16a34a', icon: 'gitBranch', hint: 'Process, procedures, SOPs' },
  { name: 'Material', color: '#d97706', icon: 'package', hint: 'Raw stock, consumables' },
  { name: 'Man', color: '#9333ea', icon: 'users', hint: 'People, training, handoffs' },
  { name: 'Measurement', color: '#db2777', icon: 'target', hint: 'Gauges, MSA, data' },
  { name: 'Environment', color: '#0891b2', icon: 'sun', hint: 'Ambient, layout, conditions' } ];

const Fishbone = () => {
  const [causes, setCauses] = React.useState({
    Machine: ['Regulator drift — Station 3B', 'Wire feed speed 10% low', 'Gas mixer past service'],
    Method: ['No inline gas-flow monitoring', 'Pre-weld checklist skipped'],
    Material: ['Wire batch ER70S-6 edge-of-spec', 'Shielding gas blend variation'],
    Man: ['Welder training current', 'Shift handoff log incomplete'],
    Measurement: ['Amperage drift not flagged', 'Gauge MSA overdue'],
    Environment: ['Humidity nominal', 'Floor draft from Bay 4 doors'] });

  const [roots, setRoots] = React.useState(() => new Set(['Machine::Regulator drift — Station 3B']));
  const [flash, setFlash] = React.useState(null);     // key of newly added cause
  const [hover, setHover] = React.useState(null);     // key of hovered cause
  const [addingFor, setAddingFor] = React.useState(null);
  const [draft, setDraft] = React.useState('');

  React.useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1800);
    return () => clearTimeout(t);
  }, [flash]);

  const keyOf = (cat, text) => cat + '::' + text;

  const addCause = (cat, raw) => {
    const text = (raw ?? '').trim();
    if (!text) return;
    setCauses((prev) => prev[cat].includes(text) ? prev : { ...prev, [cat]: [...prev[cat], text] });
    setFlash(keyOf(cat, text));
    setDraft('');
    setAddingFor(null);
  };

  const removeCause = (cat, text) => {
    setCauses((prev) => ({ ...prev, [cat]: prev[cat].filter((x) => x !== text) }));
    setRoots((prev) => { const n = new Set(prev); n.delete(keyOf(cat, text)); return n; });
  };

  const toggleRoot = (cat, text) => {
    const k = keyOf(cat, text);
    setRoots((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
  };

  const aiSuggest = () => {
    const ideas = [
      { cat: 'Machine', text: 'Torch tip electrode wear' },
      { cat: 'Method', text: 'Travel speed outside SOP window' },
      { cat: 'Material', text: 'Filler wire moisture absorption' },
      { cat: 'Environment', text: 'Compressed-air dewpoint above spec' },
      { cat: 'Measurement', text: 'Flow gauge reads 8% high vs master' } ];
    const existing = new Set(Object.values(causes).flat().map((x) => x.toLowerCase()));
    const pick = ideas.find((i) => !existing.has(i.text.toLowerCase())) || ideas[0];
    addCause(pick.cat, pick.text);
  };

  const exportCauses = () => {
    const header = ['Category', 'Cause', 'Root candidate'];
    const rows = FB_CATS.flatMap((c) => (causes[c.name] || []).map((ca) => [c.name, ca, roots.has(keyOf(c.name, ca)) ? 'yes' : '']));
    const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `fishbone-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const totalCauses = Object.values(causes).reduce((a, list) => a + list.length, 0);
  const rootCount = roots.size;

  const tint = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Effect anchor + toolbar */}
      <div className="k-surface" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14, borderLeft: '3px solid var(--danger-500)' }}>
        <div style={{ width: 42, height: 42, borderRadius: 'var(--r-md)', background: 'var(--danger-50, #fef2f2)', color: 'var(--danger-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="alert" size={20} stroke={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="k-overline" style={{ color: 'var(--danger-600)' }}>Effect — problem under analysis</div>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', marginTop: 2 }}>Weld porosity <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>· Part #A-7742</span></div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>{FB_CATS.length} categories · {totalCauses} candidate causes · {rootCount} flagged root candidate{rootCount === 1 ? '' : 's'}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button className="k-btn k-btn-ghost k-btn-sm" onClick={aiSuggest}><Icon name="sparkles" size={12} />AI suggest</button>
          <button className="k-btn k-btn-ghost k-btn-sm" onClick={exportCauses}><Icon name="download" size={12} />Export</button>
        </div>
      </div>

      {/* Category lanes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(248px, 1fr))', gap: 12 }}>
        {FB_CATS.map((c) => {
          const list = causes[c.name] || [];
          const adding = addingFor === c.name;
          return (
            <div key={c.name} className="k-surface" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {/* Lane header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--border)', background: tint(c.color, 0.05) }}>
                <div style={{ width: 28, height: 28, borderRadius: 'var(--r-sm)', background: tint(c.color, 0.14), color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name={c.icon} size={15} stroke={2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.color, letterSpacing: '-0.005em' }}>{c.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-subtle)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.hint}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', background: 'var(--bg-subtle)', borderRadius: 'var(--r-full)', minWidth: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 7px' }}>{list.length}</span>
              </div>

              {/* Causes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: 10, flex: 1 }}>
                {list.length === 0 &&
                  <div style={{ fontSize: 11.5, color: 'var(--text-subtle)', textAlign: 'center', padding: '14px 0', fontStyle: 'italic' }}>No causes yet</div>}

                {list.map((text) => {
                  const k = keyOf(c.name, text);
                  const isRoot = roots.has(k);
                  const isHover = hover === k;
                  const isFlash = flash === k;
                  return (
                    <div key={k}
                      onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover((h) => h === k ? null : h)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 8px 7px 10px', borderRadius: 'var(--r-md)',
                        background: isRoot ? tint(c.color, 0.10) : isHover ? 'var(--bg-subtle)' : 'transparent',
                        border: isRoot ? `1px solid ${tint(c.color, 0.4)}` : '1px solid transparent',
                        boxShadow: isFlash ? `0 0 0 2px ${tint(c.color, 0.5)}` : 'none',
                        transition: 'background 120ms, box-shadow 300ms'
                      }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: isRoot ? c.color : 'var(--border-strong)', flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 12.5, lineHeight: 1.35, color: isRoot ? 'var(--text)' : 'var(--text-muted)', fontWeight: isRoot ? 600 : 400 }}>
                        {isFlash && <span style={{ marginRight: 5, fontSize: 9, padding: '1px 5px', background: c.color, color: 'white', borderRadius: 3, fontWeight: 700, letterSpacing: '0.04em', verticalAlign: 'middle' }}>NEW</span>}
                        {text}
                      </span>
                      <button title={isRoot ? 'Unflag root candidate' : 'Flag as root candidate'} onClick={() => toggleRoot(c.name, text)}
                        style={{ flexShrink: 0, padding: 3, border: 'none', background: 'transparent', cursor: 'pointer', color: isRoot ? c.color : 'var(--text-subtle)', opacity: isRoot || isHover ? 1 : 0, transition: 'opacity 120ms', display: 'inline-flex' }}>
                        <Icon name="flag" size={13} stroke={2} />
                      </button>
                      <button title="Remove cause" onClick={() => removeCause(c.name, text)}
                        style={{ flexShrink: 0, padding: 3, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-subtle)', opacity: isHover ? 1 : 0, transition: 'opacity 120ms', display: 'inline-flex' }}>
                        <Icon name="x" size={13} stroke={2.2} />
                      </button>
                    </div>);
                })}

                {/* Add row */}
                {adding ?
                  <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                    <input className="k-input" autoFocus value={draft} placeholder={`Add ${c.name.toLowerCase()} cause…`}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') addCause(c.name, draft); if (e.key === 'Escape') { setAddingFor(null); setDraft(''); } }}
                      onBlur={() => { if (!draft.trim()) { setAddingFor(null); setDraft(''); } }}
                      style={{ height: 32, fontSize: 12.5, padding: '0 10px' }} />
                  </div>
                  :
                  <button onClick={() => { setAddingFor(c.name); setDraft(''); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', marginTop: 2, padding: '7px 10px', border: '1px dashed var(--border-strong)', borderRadius: 'var(--r-md)', background: 'transparent', color: 'var(--text-subtle)', cursor: 'pointer', fontSize: 12, fontWeight: 500, transition: 'color 120ms, border-color 120ms' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = c.color; e.currentTarget.style.borderColor = c.color; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-subtle)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }}>
                    <Icon name="plus" size={12} stroke={2.4} />Add cause
                  </button>}
              </div>
            </div>);
        })}
      </div>
    </div>);

};


const StepLocked = ({ step }) =>
<div className="k-surface" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
    <div style={{ display: 'inline-flex', padding: 14, borderRadius: '50%', background: 'var(--bg-subtle)', marginBottom: 12 }}><Icon name="shield" size={28} stroke={1.5} /></div>
    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{step.title} — Locked</div>
    <div style={{ fontSize: 13 }}>Complete previous step to unlock.</div>
  </div>;


Object.assign(window, { EightDList, EightDDetail });