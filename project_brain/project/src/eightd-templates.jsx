// Kaenal — 8D Template Library + Editor
// Industry-specific D2 prompts, default team roles, SLA per step

const EIGHTD_TEMPLATES = [
  {
    id: 'tmpl-iatf-weld',
    name: 'IATF — Welding / Joining Defects',
    industry: 'Automotive',
    description: 'Optimized for weld porosity, penetration, splatter, and joint integrity issues',
    uses: 47,
    avgCloseDays: 26,
    color: '#2563eb',
    slas: { D1: 1, D2: 2, D3: 1, D4: 7, D5: 5, D6: 14, D7: 30, D8: 7 },
    defaultTeam: ['Quality Engineer', 'Process Engineer (Weld)', 'Maintenance Lead', 'Cell Operator'],
  },
  {
    id: 'tmpl-iatf-machining',
    name: 'IATF — Machining / Dimensional',
    industry: 'Automotive',
    description: 'Dimensional drift, OOS conditions, tool wear and CMM-detected nonconformities',
    uses: 32,
    avgCloseDays: 22,
    color: '#0891b2',
    slas: { D1: 1, D2: 2, D3: 1, D4: 5, D5: 5, D6: 10, D7: 30, D8: 5 },
    defaultTeam: ['Quality Engineer', 'CNC Programmer', 'Tool Crib', 'Operator'],
  },
  {
    id: 'tmpl-customer-complaint',
    name: 'Customer Complaint — Tier-1',
    industry: 'Automotive',
    description: 'Field returns and customer claims with 8D/PPAP requirements',
    uses: 58,
    avgCloseDays: 18,
    color: '#dc2626',
    slas: { D1: 1, D2: 1, D3: 1, D4: 5, D5: 3, D6: 10, D7: 21, D8: 3 },
    defaultTeam: ['Customer Quality', 'Quality Manager', 'Process Engineer', 'Account Manager'],
  },
  {
    id: 'tmpl-supplier',
    name: 'Supplier Nonconformance',
    industry: 'General',
    description: 'For incoming material rejections — drives 8D back to supplier',
    uses: 21,
    avgCloseDays: 31,
    color: '#7c3aed',
    slas: { D1: 2, D2: 3, D3: 2, D4: 10, D5: 7, D6: 21, D7: 45, D8: 10 },
    defaultTeam: ['Supplier Quality', 'Incoming QA', 'Buyer', 'Engineering'],
  },
  {
    id: 'tmpl-safety',
    name: 'Safety / Near-Miss',
    industry: 'General',
    description: 'EHS-driven 8D for incidents, near-misses, and safety walkdowns',
    uses: 14,
    avgCloseDays: 19,
    color: '#ea580c',
    slas: { D1: 1, D2: 1, D3: 1, D4: 3, D5: 3, D6: 7, D7: 14, D8: 3 },
    defaultTeam: ['EHS Manager', 'Area Supervisor', 'Maintenance', 'Safety Rep'],
  },
  {
    id: 'tmpl-aerospace',
    name: 'AS9100 — Aerospace',
    industry: 'Aerospace',
    description: 'AS9100D-compliant with FAIR and Net Inspection considerations',
    uses: 8,
    avgCloseDays: 38,
    color: '#0d9488',
    slas: { D1: 2, D2: 3, D3: 2, D4: 10, D5: 7, D6: 21, D7: 45, D8: 14 },
    defaultTeam: ['Quality Engineer', 'DER', 'Manufacturing Eng.', 'Customer Quality'],
  },
  {
    id: 'tmpl-pharma',
    name: 'Pharma / FDA — Deviation',
    industry: 'Pharma',
    description: '21 CFR Part 211/820 deviation investigation with CAPA linkage',
    uses: 5,
    avgCloseDays: 42,
    color: '#16a34a',
    slas: { D1: 2, D2: 3, D3: 1, D4: 14, D5: 7, D6: 30, D7: 60, D8: 14 },
    defaultTeam: ['QA Lead', 'Manufacturing', 'Validation', 'Reg Affairs'],
  },
];

const D_STEP_DEFS = [
  { key: 'D1', title: 'Team', defaultPrompt: 'Form a cross-functional team with the skills, time, and authority to solve the problem.' },
  { key: 'D2', title: 'Problem Description', defaultPrompt: 'Describe the problem using 5W2H: What, Where, When, Who, Why, How, How many?' },
  { key: 'D3', title: 'Interim Containment', defaultPrompt: 'Protect the customer. Define and verify containment actions.' },
  { key: 'D4', title: 'Root Cause Analysis', defaultPrompt: 'Identify root cause(s) using 5 Whys, Fishbone, and Is/Is Not.' },
  { key: 'D5', title: 'Permanent Corrective Action', defaultPrompt: 'Choose and verify permanent corrective actions.' },
  { key: 'D6', title: 'Implement & Validate', defaultPrompt: 'Implement permanent actions and verify effectiveness.' },
  { key: 'D7', title: 'Prevent Recurrence', defaultPrompt: 'Update FMEAs, control plans, work instructions, training.' },
  { key: 'D8', title: 'Team & Closure', defaultPrompt: 'Recognize the team and close the 8D.' },
];

function EightDTemplatesList({ setRoute, setTemplate }) {
  return (
    <div>
      <PageHeader
        title="8D Templates"
        description="Industry-specific 8D scaffolds — D2 prompts, default team roles, SLA per step"
        actions={
          <>
            <button className="k-btn k-btn-secondary" onClick={() => kToast('Choose a .json template file to import')}><Icon name="upload" size={14}/> Import JSON</button>
            <button className="k-btn k-btn-primary" onClick={() => { setTemplate('new'); setRoute('8d-template-editor'); }}>
              <Icon name="plus" size={14}/> New 8D template
            </button>
          </>
        }
      />

      <div style={{ padding: '20px 28px 0', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[
          { l: 'Templates', v: EIGHTD_TEMPLATES.length, c: '#2563eb', i: 'brain' },
          { l: '8Ds opened (YTD)', v: '185', c: '#7c3aed', i: 'history' },
          { l: 'Avg time-to-close', v: '24d', c: '#16a34a', i: 'clock' },
          { l: 'On-time closure', v: '78%', c: '#f59e0b', i: 'check' },
        ].map(k => (
          <div key={k.l} className="k-surface" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: k.c + '18', color: k.c, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={k.i} size={20}/>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{k.l}</div>
              <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.1 }}>{k.v}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '20px 28px 28px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
        {EIGHTD_TEMPLATES.map(t => (
          <div key={t.id} onClick={() => { setTemplate(t.id); setRoute('8d-template-editor'); }}
            className="k-surface k-hoverable" style={{ padding: 18, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: t.color + '18', color: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="brain" size={20}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{t.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.industry}</div>
              </div>
              <span className="k-chip" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', fontSize: 10 }}>{t.uses} uses</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t.description}</div>

            {/* SLA strip */}
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>SLA per step (days)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 3 }}>
                {Object.entries(t.slas).map(([k, v]) => (
                  <div key={k} style={{
                    padding: '4px 2px', textAlign: 'center', borderRadius: 4,
                    background: 'var(--bg-subtle)', fontSize: 10,
                  }}>
                    <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{k}</div>
                    <div style={{ fontWeight: 700, fontSize: 11.5 }}>{v}d</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)' }}>
              <span><Icon name="users" size={11}/> {t.defaultTeam.length} default roles</span>
              <span><Icon name="clock" size={11}/> Avg close {t.avgCloseDays}d</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EightDTemplateEditor({ id, setRoute }) {
  const baseTpl = EIGHTD_TEMPLATES.find(t => t.id === id) || EIGHTD_TEMPLATES[0];
  const [tpl, setTpl] = React.useState(() => ({
    ...baseTpl,
    steps: D_STEP_DEFS.map(d => ({
      ...d,
      prompt: d.defaultPrompt,
      sla: baseTpl.slas[d.key],
      requiredFields: d.key === 'D2' ? ['What', 'Where', 'When', 'How many'] : d.key === 'D4' ? ['5 Whys', 'Fishbone'] : [],
      autoEvidence: d.key === 'D3' || d.key === 'D5' || d.key === 'D6',
    })),
  }));
  const [activeStep, setActiveStep] = React.useState(1);
  const step = tpl.steps[activeStep];

  const updateStep = (patch) => {
    setTpl(t => ({ ...t, steps: t.steps.map((s, i) => i === activeStep ? { ...s, ...patch } : s) }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)' }}>
      {/* Header */}
      <div style={{ padding: '14px 28px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={() => setRoute('8d-templates')} className="k-btn-plain" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
          <Icon name="arrowLeft" size={14}/> 8D Templates
        </button>
        <div style={{ width: 1, height: 22, background: 'var(--border)' }}/>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: tpl.color + '20', color: tpl.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="brain" size={16}/>
        </div>
        <input value={tpl.name} onChange={e => setTpl(t => ({ ...t, name: e.target.value }))}
          style={{ fontSize: 16, fontWeight: 700, border: 'none', outline: 'none', background: 'transparent', flex: 1 }}/>
        <select value={tpl.industry} onChange={e => setTpl(t => ({ ...t, industry: e.target.value }))} className="k-input" style={{ height: 30, fontSize: 12 }}>
          <option>Automotive</option><option>Aerospace</option><option>Pharma</option><option>General</option><option>Food</option>
        </select>
        <button className="k-btn k-btn-secondary" onClick={() => kToast('Export started — 8d-template.json')}><Icon name="download" size={13}/> Export</button>
        <button className="k-btn k-btn-primary" onClick={() => kToast('Template saved & published — available for new 8D reports')}><Icon name="check" size={13}/> Save & Publish</button>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Left: step list */}
        <div style={{ width: 220, borderRight: '1px solid var(--border)', background: 'var(--bg-subtle)', overflowY: 'auto', padding: '14px 10px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', padding: '0 6px 10px' }}>Steps</div>
          {tpl.steps.map((s, i) => (
            <button key={s.key} onClick={() => setActiveStep(i)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '9px 10px', marginBottom: 3, borderRadius: 6,
              background: activeStep === i ? 'var(--accent-soft)' : 'transparent',
              color: activeStep === i ? 'var(--accent)' : 'var(--text)',
              borderLeft: activeStep === i ? '3px solid var(--accent)' : '3px solid transparent',
              border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 13,
            }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: activeStep === i ? 'var(--accent)' : 'var(--border)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{s.key}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 12.5 }}>{s.title}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>SLA: {s.sla}d</div>
              </div>
            </button>
          ))}
        </div>

        {/* Middle: step config */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800 }}>{step.key}</div>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{step.title}</h2>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Step {activeStep + 1} of 8 · SLA {step.sla} days</div>
              </div>
            </div>

            <div className="k-surface" style={{ padding: 18, marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>AI-prompt template</label>
              <textarea value={step.prompt} onChange={e => updateStep({ prompt: e.target.value })}
                className="k-input" rows={3} style={{ height: 'auto', padding: 10, fontSize: 13, resize: 'vertical', minHeight: 70 }}/>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>This is shown as guidance to the team and seeds the AI suggestion for this step.</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div className="k-surface" style={{ padding: 16 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>SLA — Target days</label>
                <input type="number" value={step.sla} onChange={e => updateStep({ sla: +e.target.value })}
                  className="k-input" style={{ height: 36, fontSize: 18, fontWeight: 700 }}/>
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Escalate to</span>
                  <select className="k-input" style={{ height: 26, fontSize: 11.5, width: 'auto' }}>
                    <option>Team Lead</option><option>Quality Manager</option><option>Plant Director</option>
                  </select>
                </div>
                <div style={{ marginTop: 8, fontSize: 11.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Warn at</span>
                  <Segmented size="sm" value="80%" onChange={() => {}} options={[
                    { value: '50%', label: '50%' },
                    { value: '80%', label: '80%' },
                    { value: '100%', label: '100%' },
                  ]}/>
                </div>
              </div>

              <div className="k-surface" style={{ padding: 16 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Required evidence</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { k: 'photo', l: 'Photo' },
                    { k: 'doc', l: 'Document attached' },
                    { k: 'signature', l: 'Approver signature' },
                    { k: 'measurement', l: 'Verified measurement' },
                  ].map(o => (
                    <label key={o.k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <input type="checkbox" defaultChecked={step.autoEvidence && (o.k === 'photo' || o.k === 'doc')} style={{ accentColor: 'var(--accent)' }}/>
                      {o.l}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="k-surface" style={{ padding: 16, marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 8 }}>Required fields for this step</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {step.requiredFields.map((f, i) => (
                  <span key={i} style={{
                    padding: '4px 10px', background: 'var(--accent-soft)', color: 'var(--accent)',
                    border: '1px solid var(--accent)', borderRadius: 'var(--r-full)', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}>
                    {f}
                    <button onClick={() => updateStep({ requiredFields: step.requiredFields.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0 }}>
                      <Icon name="x" size={11}/>
                    </button>
                  </span>
                ))}
                <button onClick={() => updateStep({ requiredFields: [...step.requiredFields, `Custom field ${step.requiredFields.length + 1}`] })} style={{
                  padding: '4px 10px', background: 'transparent', color: 'var(--text-muted)',
                  border: '1px dashed var(--border-strong)', borderRadius: 'var(--r-full)',
                  fontSize: 11.5, cursor: 'pointer',
                }}>
                  <Icon name="plus" size={11}/> Add field
                </button>
              </div>
            </div>

            <div className="k-surface" style={{ padding: 16 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 8 }}>Auto-assign roles</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {tpl.defaultTeam.map((r, i) => (
                  <span key={i} className="k-chip" style={{ background: 'var(--bg-subtle)' }}>
                    <Icon name="user" size={10}/> {r}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: meta */}
        <div style={{ width: 280, borderLeft: '1px solid var(--border)', background: 'var(--surface)', overflowY: 'auto', padding: 18 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 10 }}>Template settings</div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Description</label>
            <textarea value={tpl.description} onChange={e => setTpl(t => ({ ...t, description: e.target.value }))}
              className="k-input" rows={3} style={{ height: 'auto', padding: 8, fontSize: 12, resize: 'vertical', minHeight: 60 }}/>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Total SLA</label>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{tpl.steps.reduce((s, x) => s + x.sla, 0)} <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>days</span></div>
          </div>

          <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 8 }}>Default team roles</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {tpl.defaultTeam.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'var(--bg-subtle)', borderRadius: 6, fontSize: 12 }}>
                  <Icon name="user" size={12}/>
                  <span style={{ flex: 1 }}>{r}</span>
                  <button onClick={() => setTpl(t => ({ ...t, defaultTeam: t.defaultTeam.filter((_, j) => j !== i) }))} className="k-btn-plain" style={{ padding: 2 }}><Icon name="x" size={11}/></button>
                </div>
              ))}
              <button onClick={() => setTpl(t => ({ ...t, defaultTeam: [...t.defaultTeam, 'Team member'] }))} style={{ padding: '6px 8px', textAlign: 'left', background: 'transparent', border: '1px dashed var(--border-strong)', borderRadius: 6, fontSize: 11.5, color: 'var(--text-muted)', cursor: 'pointer' }}>
                <Icon name="plus" size={11}/> Add role
              </button>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Usage</label>
            <div style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--text-muted)' }}>
              <div>Used by <strong style={{ color: 'var(--text)' }}>{tpl.uses}</strong> active 8Ds</div>
              <div>Avg close time <strong style={{ color: 'var(--text)' }}>{tpl.avgCloseDays}d</strong></div>
              <div>Created Feb 2024</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { EightDTemplatesList, EightDTemplateEditor, EIGHTD_TEMPLATES });
