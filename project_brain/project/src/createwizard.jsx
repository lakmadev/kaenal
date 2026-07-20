// Kaenal — Full-page CreateWizard for Inspection / NCR / 8D / Document
// 4 steps: Type → Details → Assignees → Review

const { useState: useStateCW, useEffect: useEffectCW, useRef: useRefCW } = React;

const ENTITY_TYPES = {
  inspection: {
    label: 'Inspection',
    icon: 'clipboard',
    color: '#2563eb',
    desc: 'Run a checklist against an asset, area, or process.',
    templates: [
    { id: 'iso9001-line', label: 'ISO 9001 — Production Line', meta: '42 questions · ~25 min' },
    { id: 'safety-walk', label: 'Safety Walk-Through', meta: '18 questions · ~12 min' },
    { id: 'fda-cleanroom', label: 'FDA Cleanroom Verification', meta: '64 questions · ~45 min' },
    { id: 'iatf-tpm', label: 'IATF TPM Audit', meta: '36 questions · ~20 min' },
    { id: 'blank', label: 'Blank inspection', meta: 'Build your own' }]

  },
  ncr: {
    label: 'Non-Conformity',
    icon: 'alert',
    color: '#ea580c',
    desc: 'Log a quality issue, defect, or deviation.',
    templates: [
    { id: 'product', label: 'Product defect', meta: 'Material / dimensional / functional' },
    { id: 'process', label: 'Process deviation', meta: 'Procedure not followed' },
    { id: 'supplier', label: 'Supplier issue', meta: 'Incoming material rejected' },
    { id: 'customer', label: 'Customer complaint', meta: 'External feedback / return' },
    { id: 'audit', label: 'Audit finding', meta: 'Internal or external audit' }]

  },
  '8d': {
    label: '8D Report',
    icon: 'brain',
    color: '#6366f1',
    desc: 'Structured root-cause investigation across D1–D8.',
    templates: [
    { id: 'auto', label: 'Automotive (IATF)', meta: 'Customer-facing problem solving' },
    { id: 'medical', label: 'Medical Device (FDA)', meta: '21 CFR Part 820' },
    { id: 'aero', label: 'Aerospace (AS9100)', meta: 'Customer-driven CAPA' },
    { id: 'standard', label: 'Standard 8D', meta: 'General-purpose template' }]

  },
  document: {
    label: 'Document',
    icon: 'doc',
    color: '#0d9488',
    desc: 'Upload or draft a controlled document.',
    templates: [
    { id: 'sop', label: 'Standard Operating Procedure (SOP)', meta: 'Procedure document' },
    { id: 'wi', label: 'Work Instruction', meta: 'Step-by-step task guide' },
    { id: 'form', label: 'Form / Record', meta: 'Template for capturing data' },
    { id: 'policy', label: 'Policy', meta: 'Governance document' },
    { id: 'manual', label: 'Manual', meta: 'Quality / safety manual section' },
    { id: 'upload', label: 'Upload existing file', meta: 'PDF, DOCX, XLSX' }]

  }
};

const StepIndicator = ({ steps, current }) =>
<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    {steps.map((s, i) =>
  <React.Fragment key={i}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
        width: 24, height: 24, borderRadius: '50%',
        background: i < current ? 'var(--accent)' : i === current ? 'var(--accent)' : 'var(--bg-subtle)',
        color: i <= current ? 'white' : 'var(--text-muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700,
        border: i === current ? '2px solid var(--ring)' : 'none',
        boxShadow: i === current ? '0 0 0 4px var(--ring)' : 'none',
        transition: 'all 200ms'
      }}>
            {i < current ? <Icon name="check" size={12} stroke={3} /> : i + 1}
          </div>
          <span style={{
        fontSize: 13, fontWeight: i === current ? 600 : 500,
        color: i === current ? 'var(--text)' : i < current ? 'var(--text)' : 'var(--text-muted)'
      }}>{s}</span>
        </div>
        {i < steps.length - 1 &&
    <div style={{ width: 32, height: 1, background: i < current ? 'var(--accent)' : 'var(--border)', transition: 'all 200ms' }} />
    }
      </React.Fragment>
  )}
  </div>;


const TypeCard = ({ type, def, selected, onClick }) =>
<button onClick={onClick}
style={{
  padding: 20, textAlign: 'left',
  background: selected ? def.color + '08' : 'var(--surface)',
  border: '2px solid ' + (selected ? def.color : 'var(--border)'),
  borderRadius: 'var(--r-lg)',
  display: 'flex', flexDirection: 'column', gap: 10,
  cursor: 'pointer', transition: 'all 150ms',
  boxShadow: selected ? '0 0 0 4px ' + def.color + '14' : 'none'
}}
onMouseEnter={(e) => {if (!selected) e.currentTarget.style.borderColor = 'var(--border-strong)';}}
onMouseLeave={(e) => {if (!selected) e.currentTarget.style.borderColor = 'var(--border)';}}>
  
    <div style={{
    width: 40, height: 40, borderRadius: 'var(--r-md)',
    background: def.color + '18', color: def.color,
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  }}>
      <Icon name={def.icon} size={20} stroke={1.75} />
    </div>
    <div>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{def.label}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{def.desc}</div>
    </div>
  </button>;


const TemplateRow = ({ t, selected, onClick, color }) =>
<button onClick={onClick}
style={{
  width: '100%', padding: '14px 16px', textAlign: 'left',
  background: selected ? color + '08' : 'var(--surface)',
  border: '1px solid ' + (selected ? color : 'var(--border)'),
  borderRadius: 'var(--r-md)',
  display: 'flex', alignItems: 'center', gap: 12,
  cursor: 'pointer', transition: 'all 120ms'
}}
onMouseEnter={(e) => {if (!selected) e.currentTarget.style.background = 'var(--bg-subtle)';}}
onMouseLeave={(e) => {if (!selected) e.currentTarget.style.background = 'var(--surface)';}}>
  
    <div style={{
    width: 18, height: 18, borderRadius: '50%',
    border: '2px solid ' + (selected ? color : 'var(--border-strong)'),
    background: selected ? color : 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0
  }}>
      {selected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />}
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 13, fontWeight: 500 }}>{t.label}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t.meta}</div>
    </div>
  </button>;


const PersonRow = ({ user, role, onChangeRole, onRemove }) =>
<div style={{
  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
  background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)'
}}>
    <Avatar user={user} size={28} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 500 }}>{user.name}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{user.role}</div>
    </div>
    <select value={role} onChange={(e) => onChangeRole(e.target.value)}
  style={{
    height: 28, padding: '0 8px', fontSize: 12,
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--r-sm)', color: 'var(--text)'
  }}>
      <option value="owner">Owner</option>
      <option value="reviewer">Reviewer</option>
      <option value="approver">Approver</option>
      <option value="watcher">Watcher</option>
    </select>
    <button onClick={onRemove} className="k-btn-icon k-btn-plain" style={{ height: 28, width: 28 }}>
      <Icon name="x" size={14} />
    </button>
  </div>;


const PeoplePicker = ({ onAdd, exclude = [] }) => {
  const [open, setOpen] = useStateCW(false);
  const [q, setQ] = useStateCW('');
  const ref = useRefCW();
  useEffectCW(() => {
    const handler = (e) => {if (ref.current && !ref.current.contains(e.target)) setOpen(false);};
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const filtered = USERS.filter((u) =>
  !exclude.includes(u.id) && (
  u.name.toLowerCase().includes(q.toLowerCase()) || u.role.toLowerCase().includes(q.toLowerCase()))
  );
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} className="k-btn k-btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }}>
        <Icon name="plus" size={14} /> Add person
      </button>
      {open &&
      <div style={{
        position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 100,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-lg)',
        maxHeight: 280, overflow: 'hidden', display: 'flex', flexDirection: 'column'
      }}>
          <div style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>
            <input className="k-input" placeholder="Search people…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          </div>
          <div style={{ overflowY: 'auto', padding: 4 }}>
            {filtered.length === 0 && <div style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>No matches</div>}
            {filtered.map((u) =>
          <button key={u.id} onClick={() => {onAdd(u.id);setOpen(false);setQ('');}}
          style={{
            width: '100%', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 10,
            borderRadius: 'var(--r-sm)', textAlign: 'left'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            
                <Avatar user={u} size={26} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{u.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.role}</div>
                </div>
              </button>
          )}
          </div>
        </div>
      }
    </div>);

};

const CreateWizard = ({ initialType, onClose, onComplete }) => {
  const [step, setStep] = useStateCW(initialType ? 1 : 0);
  const [type, setType] = useStateCW(initialType || null);
  const [template, setTemplate] = useStateCW(null);

  // Step 2 form state
  const [title, setTitle] = useStateCW('');
  const [priority, setPriority] = useStateCW('medium');
  const [site, setSite] = useStateCW('plant-a');
  const [area, setArea] = useStateCW('');
  const [due, setDue] = useStateCW('');
  const [description, setDescription] = useStateCW('');
  const [linkedNcr, setLinkedNcr] = useStateCW('');

  // Step 3
  const [people, setPeople] = useStateCW([]); // [{userId, role}]

  // Lock body scroll
  useEffectCW(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {document.body.style.overflow = orig;};
  }, []);

  // Esc to close
  useEffectCW(() => {
    const handler = (e) => {if (e.key === 'Escape') onClose();};
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const def = type ? ENTITY_TYPES[type] : null;
  const steps = ['Type', 'Details', 'Assignees', 'Review'];

  const canNext = () => {
    if (step === 0) return !!type;
    if (step === 1) return !!template && !!title.trim();
    if (step === 2) return people.length > 0;
    return true;
  };

  const next = () => {
    if (step < 3) setStep(step + 1);else
    {
      onComplete && onComplete({ type, template, title, priority, site, area, due, description, people, linkedNcr });
      onClose();
    }
  };

  const back = () => {
    if (step > 0) setStep(step - 1);else
    onClose();
  };

  // ---- Render steps ----
  const renderStep0 = () =>
  <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 32px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>What would you like to create?</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 8 }}>Pick the type — you'll fill in details next.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {Object.entries(ENTITY_TYPES).map(([k, d]) =>
      <TypeCard key={k} type={k} def={d} selected={type === k} onClick={() => {setType(k);setTemplate(null);}} />
      )}
      </div>
    </div>;


  const renderStep1 = () =>
  <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, marginBottom: 4 }}>Choose a template</h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Templates pre-fill fields and rules.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {def.templates.map((t) =>
        <TemplateRow key={t.id} t={t} selected={template === t.id} color={def.color} onClick={() => setTemplate(t.id)} />
        )}
        </div>
      </div>
      <div data-comment-anchor="f2b913ef3d-div-308-7">
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, marginBottom: 4 }}>Details</h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>The basics. You can refine later.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Title">
            <input className="k-input" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder={
          type === 'inspection' ? 'e.g. Plant A — Line 3 weekly safety walk' :
          type === 'ncr' ? 'e.g. Bracket weld bead inconsistent on Line 2' :
          type === '8d' ? 'e.g. Recurrent porosity on aluminum housing' :
          'e.g. SOP-2026-Q2-Welding-rev3'
          } />
          </Field>
          {(type === 'ncr' || type === 'inspection' || type === '8d') &&
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Priority">
                <select className="k-input" value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </Field>
              <Field label="Due date">
                <input className="k-input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
              </Field>
            </div>
        }
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Site">
              <select className="k-input" value={site} onChange={(e) => setSite(e.target.value)}>
                <option value="plant-a">Plant A — Detroit</option>
                <option value="plant-b">Plant B — Monterrey</option>
                <option value="hq">HQ — Chicago</option>
                <option value="warehouse">Warehouse — Memphis</option>
              </select>
            </Field>
            <Field label="Area / Asset">
              <input className="k-input" value={area} onChange={(e) => setArea(e.target.value)}
            placeholder={type === 'document' ? 'Department' : 'e.g. Welding · Line 3'} />
            </Field>
          </div>
          {type === '8d' &&
        <Field label="Linked NCR (optional)">
              <input className="k-input" value={linkedNcr} onChange={(e) => setLinkedNcr(e.target.value)}
          placeholder="NCR-2026-…" />
            </Field>
        }
          <Field label="Description">
            <textarea className="k-input" value={description} onChange={(e) => setDescription(e.target.value)}
          rows={4} style={{ height: 'auto', padding: 12, resize: 'vertical', fontFamily: 'inherit' }}
          placeholder="What happened, where, when. Add context the team will need." />
          </Field>
        </div>
      </div>
    </div>;


  const renderStep2 = () =>
  <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 32px' }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, marginBottom: 4 }}>Assignees & approvals</h2>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>Who owns this, who reviews, who needs to approve.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {people.map((p, i) => {
        const u = userById(p.userId);
        if (!u) return null;
        return (
          <PersonRow key={p.userId} user={u} role={p.role}
          onChangeRole={(r) => setPeople(people.map((x) => x.userId === p.userId ? { ...x, role: r } : x))}
          onRemove={() => setPeople(people.filter((x) => x.userId !== p.userId))} />);

      })}
        {people.length === 0 &&
      <div style={{
        padding: '24px 16px', border: '1px dashed var(--border-strong)',
        borderRadius: 'var(--r-md)', textAlign: 'center'
      }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No one assigned yet — add at least one owner.</div>
          </div>
      }
        <PeoplePicker
        exclude={people.map((p) => p.userId)}
        onAdd={(uid) => setPeople([...people, { userId: uid, role: people.length === 0 ? 'owner' : 'reviewer' }])} />
      
      </div>

      <div style={{ marginTop: 28, padding: 16, background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)', display: 'flex', gap: 12 }}>
        <Icon name="info" size={16} stroke={2} />
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text)' }}>Notification:</strong> Assignees get an in-app + email notification with a one-click open link. Approvers receive a separate request when the {def.label.toLowerCase()} reaches their step.
        </div>
      </div>
    </div>;


  const renderStep3 = () => {
    const tplLabel = def.templates.find((t) => t.id === template)?.label;
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 32px' }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, marginBottom: 4 }}>Review & create</h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>Confirm the details before creating.</p>

        <div className="k-surface" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: 20, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 'var(--r-md)',
              background: def.color + '18', color: def.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Icon name={def.icon} size={22} stroke={1.75} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>{def.label}</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{title || '(untitled)'}</div>
            </div>
            {(type === 'ncr' || type === 'inspection' || type === '8d') && <PriorityBadge priority={priority} />}
          </div>

          <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, fontSize: 13 }}>
            <div><div className="k-overline" style={{ marginBottom: 4 }}>Template</div><div>{tplLabel}</div></div>
            <div><div className="k-overline" style={{ marginBottom: 4 }}>Site</div><div>{{ 'plant-a': 'Plant A — Detroit', 'plant-b': 'Plant B — Monterrey', 'hq': 'HQ — Chicago', 'warehouse': 'Warehouse — Memphis' }[site]}</div></div>
            {area && <div><div className="k-overline" style={{ marginBottom: 4 }}>Area / Asset</div><div>{area}</div></div>}
            {due && <div><div className="k-overline" style={{ marginBottom: 4 }}>Due</div><div>{due}</div></div>}
            {linkedNcr && <div><div className="k-overline" style={{ marginBottom: 4 }}>Linked NCR</div><div className="mono">{linkedNcr}</div></div>}
          </div>

          {description &&
          <div style={{ padding: '0 20px 20px' }}>
              <div className="k-overline" style={{ marginBottom: 6 }}>Description</div>
              <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text-muted)' }}>{description}</div>
            </div>
          }

          <div style={{ padding: 20, borderTop: '1px solid var(--border)' }}>
            <div className="k-overline" style={{ marginBottom: 8 }}>Team — {people.length} {people.length === 1 ? 'person' : 'people'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {people.map((p) => {
                const u = userById(p.userId);
                if (!u) return null;
                return (
                  <div key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                    <Avatar user={u} size={24} />
                    <span style={{ flex: 1, fontWeight: 500 }}>{u.name}</span>
                    <span className="k-chip" style={{ textTransform: 'capitalize' }}>{p.role}</span>
                  </div>);

              })}
            </div>
          </div>

          <div style={{ padding: 16, background: 'var(--bg-subtle)', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
            <Icon name="zap" size={14} stroke={2} />
            <span>AI will pre-fill {type === '8d' ? 'D1–D3 from the linked NCR data' : type === 'inspection' ? 'context from previous similar inspections' : 'similar past records and suggest a category'} after creation.</span>
          </div>
        </div>
      </div>);

  };

  // ---- Wrapper ----
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      animation: 'fadeIn 200ms ease-out'
    }}>
      {/* Top bar */}
      <header style={{
        height: 64, padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)', background: 'var(--surface)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={onClose} className="k-btn k-btn-ghost k-btn-sm">
            <Icon name="x" size={14} /> Cancel
          </button>
          <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            New {def?.label || 'item'}
          </div>
        </div>
        <StepIndicator steps={steps} current={step} />
        <div style={{ display: 'flex', gap: 8 }}>
          {step > 0 && <button onClick={back} className="k-btn k-btn-ghost">Back</button>}
          <button onClick={next} disabled={!canNext()} className="k-btn k-btn-primary"
          style={{ opacity: canNext() ? 1 : 0.5, cursor: canNext() ? 'pointer' : 'not-allowed' }}>
            {step === 3 ? <>Create {def?.label} <Icon name="check" size={14} stroke={2.5} /></> : <>Next <Icon name="arrowRight" size={14} /></>}
          </button>
        </div>
      </header>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto' }} className="fade-in">
        {step === 0 && renderStep0()}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </div>

      {/* Footer hint */}
      <div style={{
        padding: '10px 24px', borderTop: '1px solid var(--border)',
        background: 'var(--bg-subtle)',
        fontSize: 11, color: 'var(--text-muted)',
        display: 'flex', justifyContent: 'space-between'
      }}>
        <span>Tip: Press <kbd className="kbd">Esc</kbd> to cancel · <kbd className="kbd">Enter</kbd> to continue</span>
        <span>Step {step + 1} of {steps.length}</span>
      </div>
    </div>);

};

// Toast for after-creation feedback
const Toast = ({ message, onClose }) => {
  useEffectCW(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 999,
      background: 'var(--text)', color: 'var(--surface)',
      padding: '12px 18px', borderRadius: 'var(--r-md)',
      boxShadow: 'var(--shadow-lg)',
      display: 'flex', alignItems: 'center', gap: 10,
      fontSize: 13, fontWeight: 500,
      animation: 'slideUpToast 200ms ease-out',
      maxWidth: 420
    }}>
      <Icon name="check" size={16} stroke={2.5} />
      <span>{message}</span>
      <button onClick={onClose} style={{ marginLeft: 4, color: 'var(--text-subtle)' }}>
        <Icon name="x" size={14} />
      </button>
    </div>);

};

// Command palette (Cmd+K) — superseded by the entity-search palette in
// notifications.jsx; kept local (NOT exported) so it doesn't shadow it.
const CommandPaletteBasic = ({ open, onClose, onCreate, setRoute }) => {
  const [q, setQ] = useStateCW('');
  const [idx, setIdx] = useStateCW(0);

  const commands = [
  { id: 'new-inspection', label: 'New Inspection', icon: 'clipboard', kbd: '⌘ I', action: () => onCreate('inspection') },
  { id: 'new-ncr', label: 'New Non-Conformity', icon: 'alert', kbd: '⌘ N', action: () => onCreate('ncr') },
  { id: 'new-8d', label: 'New 8D Report', icon: 'brain', kbd: '⌘ D', action: () => onCreate('8d') },
  { id: 'new-doc', label: 'New Document', icon: 'doc', kbd: '⌘ U', action: () => onCreate('document') },
  { id: 'goto-dash', label: 'Go to Dashboard', icon: 'home', action: () => setRoute('dashboard') },
  { id: 'goto-insp', label: 'Go to Inspections', icon: 'clipboard', action: () => setRoute('inspections') },
  { id: 'goto-ncr', label: 'Go to Non-Conformities', icon: 'alert', action: () => setRoute('ncr') },
  { id: 'goto-8d', label: 'Go to 8D Reports', icon: 'brain', action: () => setRoute('8d') },
  { id: 'goto-docs', label: 'Go to Documents', icon: 'doc', action: () => setRoute('documents') },
  { id: 'goto-reports', label: 'Go to Reports', icon: 'reports', action: () => setRoute('reports') },
  { id: 'goto-settings', label: 'Go to Settings', icon: 'settings', action: () => setRoute('settings') }];


  const filtered = q ? commands.filter((c) => c.label.toLowerCase().includes(q.toLowerCase())) : commands;

  useEffectCW(() => {setIdx(0);}, [q]);
  useEffectCW(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'ArrowDown') {e.preventDefault();setIdx((i) => Math.min(filtered.length - 1, i + 1));} else
      if (e.key === 'ArrowUp') {e.preventDefault();setIdx((i) => Math.max(0, i - 1));} else
      if (e.key === 'Enter') {
        e.preventDefault();
        const c = filtered[idx];
        if (c) {c.action();onClose();setQ('');}
      } else if (e.key === 'Escape') {onClose();}
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, filtered, idx, onClose]);

  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: '15vh',
      animation: 'fadeIn 150ms ease-out'
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 600, maxWidth: '90vw', background: 'var(--surface)',
        borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-xl)',
        overflow: 'hidden', border: '1px solid var(--border)'
      }}>
        <div style={{ padding: 12, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="search" size={16} stroke={2} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search commands or type to filter…"
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: 'var(--text)' }} />
          <kbd className="kbd">esc</kbd>
        </div>
        <div style={{ maxHeight: 360, overflowY: 'auto', padding: 6 }}>
          {filtered.length === 0 && <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>No commands match "{q}"</div>}
          {filtered.map((c, i) =>
          <button key={c.id} onClick={() => {c.action();onClose();setQ('');}}
          onMouseEnter={() => setIdx(i)}
          style={{
            width: '100%', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 12,
            borderRadius: 'var(--r-sm)', textAlign: 'left',
            background: idx === i ? 'var(--accent-soft)' : 'transparent',
            color: idx === i ? 'var(--accent)' : 'var(--text)',
            transition: 'all 80ms'
          }}>
              <Icon name={c.icon} size={16} stroke={1.75} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{c.label}</span>
              {c.kbd && <kbd className="kbd">{c.kbd}</kbd>}
            </button>
          )}
        </div>
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)', display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-muted)' }}>
          <span><kbd className="kbd">↑↓</kbd> Navigate</span>
          <span><kbd className="kbd">↵</kbd> Select</span>
          <span><kbd className="kbd">esc</kbd> Close</span>
        </div>
      </div>
    </div>);

};

// Floating "+" with type menu
const QuickCreateButton = ({ onCreate }) => {
  const [open, setOpen] = useStateCW(false);
  const ref = useRefCW();
  useEffectCW(() => {
    const handler = (e) => {if (ref.current && !ref.current.contains(e.target)) setOpen(false);};
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} className="k-btn k-btn-primary k-btn-sm">
        <Icon name="plus" size={14} stroke={2.5} /> New
      </button>
      {open &&
      <div style={{
        position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 200,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-lg)',
        padding: 4, minWidth: 240
      }}>
          {Object.entries(ENTITY_TYPES).map(([k, d]) =>
        <button key={k} onClick={() => {onCreate(k);setOpen(false);}}
        style={{
          width: '100%', padding: '10px 10px', display: 'flex', alignItems: 'center', gap: 10,
          borderRadius: 'var(--r-sm)', textAlign: 'left'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
          
              <div style={{
            width: 28, height: 28, borderRadius: 'var(--r-sm)',
            background: d.color + '18', color: d.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
                <Icon name={d.icon} size={14} stroke={2} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{d.label}</div>
              </div>
              <Icon name="arrowRight" size={12} />
            </button>
        )}
        </div>
      }
    </div>);

};

Object.assign(window, { CreateWizard, Toast, QuickCreateButton, ENTITY_TYPES });