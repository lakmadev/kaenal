// Kaenal — Agentic 8D layer: AI-draft provenance, copilot side-rail, generate-pack flows

const aiTint = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

// ——————————————————————————————————————————————
// Per-field "AI draft" provenance controls
// ——————————————————————————————————————————————
const AI_FIELD_KEYS = ['d1', 'd2-problem', 'd2-isisnot', 'd2-impact', 'd3', 'd4-fivewhys'];

const AiDraftControls = ({ state, onApprove, onEdit, compact }) => {
  if (state === 'approved')
    return (
      <span className="k-chip" style={{ background: 'var(--success-100)', color: 'var(--success-700)', fontSize: 10.5, fontWeight: 600 }}>
        <Icon name="check" size={11} stroke={3} />Approved
      </span>);
  if (state === 'edited')
    return (
      <span className="k-chip" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', fontSize: 10.5, fontWeight: 600, border: '1px solid var(--border)' }}>
        <Icon name="pen" size={10} />Edited
      </span>);
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span title="Drafted by Kaenal Quality Copilot from the linked NCR" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 'var(--r-full)', background: 'rgba(99,102,241,0.1)', color: '#6366f1', fontSize: 10.5, fontWeight: 600, whiteSpace: 'nowrap' }}>
        <Icon name="sparkles" size={10} />AI draft
      </span>
      <button onClick={onApprove} className="k-btn" style={{ height: 24, padding: '0 9px', fontSize: 11, gap: 4, background: 'var(--success-500)', color: 'white', border: 'none' }}>
        <Icon name="check" size={11} stroke={3} />Approve
      </button>
      <button onClick={onEdit} className="k-btn k-btn-ghost" style={{ height: 24, padding: '0 9px', fontSize: 11, gap: 4 }}>
        <Icon name="edit" size={11} />Edit
      </button>
    </div>);
};

// A card header row carrying an overline label + AI-draft controls on the right.
const AiCardHeader = ({ label, fieldKey, ai, right, style }) => {
  const state = ai?.fieldStates?.[fieldKey];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, ...style }}>
      <span className="k-overline" style={{ marginBottom: 0 }}>{label}</span>
      <div style={{ flex: 1 }} />
      {right}
      {ai && <AiDraftControls state={state} onApprove={() => ai.approveField(fieldKey)} onEdit={() => ai.editField(fieldKey)} />}
    </div>);
};

// ——————————————————————————————————————————————
// Top provenance strip — "these steps were drafted by the AI"
// ——————————————————————————————————————————————
const AIProvenanceStrip = ({ e, fieldStates, onApproveAll, setNcr, setRoute }) => {
  const total = AI_FIELD_KEYS.length;
  const approved = AI_FIELD_KEYS.filter((k) => fieldStates[k] === 'approved').length;
  const edited = AI_FIELD_KEYS.filter((k) => fieldStates[k] === 'edited').length;
  const reviewed = approved + edited;
  const pct = Math.round(reviewed / total * 100);
  const allDone = reviewed === total;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px',
      borderRadius: 'var(--r-xl)',
      background: 'linear-gradient(135deg, rgba(99,102,241,0.10), rgba(219,39,119,0.07))',
      border: '1px solid rgba(99,102,241,0.22)'
    }}>
      <div style={{ width: 38, height: 38, borderRadius: 'var(--r-md)', background: 'linear-gradient(135deg, #6366f1, #db2777)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name="sparkles" size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          Steps D1–D4 drafted by {e.aiModel}
          <button onClick={() => { setNcr(e.aiDraftedFrom); setRoute('ncr-detail'); }} className="k-chip" style={{ background: 'var(--surface)', color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 10.5, border: '1px solid var(--border)' }}>
            <Icon name="link" size={10} />from {e.aiDraftedFrom}
          </button>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
          {allDone
            ? `All ${total} AI-drafted fields reviewed — ${approved} approved · ${edited} edited`
            : `${reviewed} of ${total} fields reviewed · ${total - reviewed} awaiting your approval`}
        </div>
        <div style={{ marginTop: 8, height: 4, borderRadius: 'var(--r-full)', background: 'rgba(99,102,241,0.16)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, borderRadius: 'var(--r-full)', background: allDone ? 'var(--success-500)' : 'linear-gradient(90deg, #6366f1, #db2777)', transition: 'width 300ms ease' }} />
        </div>
      </div>
      <button onClick={onApproveAll} disabled={allDone} className="k-btn k-btn-ghost" style={{ flexShrink: 0, opacity: allDone ? 0.5 : 1, background: 'var(--surface)' }}>
        <Icon name={allDone ? 'check' : 'sparkles'} size={14} />{allDone ? 'All reviewed' : 'Approve all drafts'}
      </button>
    </div>);
};

// ——————————————————————————————————————————————
// AI Copilot side-rail (persistent across steps)
// ——————————————————————————————————————————————
const RailSection = ({ icon, color, title, count, children, action }) => (
  <div className="k-surface" style={{ padding: 0, overflow: 'hidden' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 13px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 24, height: 24, borderRadius: 'var(--r-sm)', background: aiTint(color, 0.13), color: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={13} />
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '-0.005em', flex: 1 }}>{title}</div>
      {count != null && <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', background: 'var(--bg-subtle)', borderRadius: 'var(--r-full)', minWidth: 20, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>{count}</span>}
      {action}
    </div>
    <div style={{ padding: 11, display: 'flex', flexDirection: 'column', gap: 9 }}>{children}</div>
  </div>);

const ConfidenceMeter = ({ value }) => {
  const c = value >= 80 ? 'var(--success-600)' : value >= 60 ? 'var(--warning-600)' : 'var(--text-muted)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <div style={{ flex: 1, height: 5, borderRadius: 'var(--r-full)', background: 'var(--bg-subtle)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value}%`, background: c, borderRadius: 'var(--r-full)' }} />
      </div>
      <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: c, width: 30, textAlign: 'right' }}>{value}%</span>
    </div>);
};

const AICopilotRail = ({ e, accepted, setAccepted, setRoute, setNcr, set8d, onToast }) => {
  const [applied, setApplied] = React.useState(() => new Set());
  const [dismissed, setDismissed] = React.useState(() => new Set());
  const [causesDismissed, setCausesDismissed] = React.useState(() => new Set());
  const containment = e.aiContainment.filter((c) => !dismissed.has(c.id));
  const causes = e.steps.D4.aiSuggestions;

  const apply = (c) => { setApplied((s) => new Set(s).add(c.id)); onToast && onToast(`✓ Containment added to D3 — ${c.title.slice(0, 42)}…`); };
  const dismiss = (c) => setDismissed((s) => new Set(s).add(c.id));

  return (
    <aside style={{ position: 'sticky', top: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Copilot header */}
      <div style={{ padding: 14, borderRadius: 'var(--r-xl)', background: 'linear-gradient(135deg, #4f46e5, #db2777)', color: 'white', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 'var(--r-md)', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="sparkles" size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '-0.01em' }}>Quality Copilot</div>
            <div style={{ fontSize: 11, opacity: 0.85, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 0 3px rgba(74,222,128,0.3)' }} />
              Analyzing · 47 similar NCRs
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11.5, lineHeight: 1.5, marginTop: 10, opacity: 0.92 }}>
          I drafted D1–D4 from <span style={{ fontFamily: 'var(--font-mono)' }}>{e.aiDraftedFrom}</span>. Review the suggestions below as you work — I update them as evidence changes.
        </div>
      </div>

      {/* Proposed containment */}
      <RailSection icon="shield" color="#0891b2" title="Proposed containment" count={containment.length}>
        {containment.length === 0 &&
          <div style={{ fontSize: 11.5, color: 'var(--text-subtle)', textAlign: 'center', padding: '8px 0', fontStyle: 'italic' }}>All suggestions actioned.</div>}
        {containment.map((c) => {
          const done = applied.has(c.id);
          return (
            <div key={c.id} style={{ padding: 10, borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: done ? 'var(--success-50)' : 'var(--surface)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 6 }}>
                <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.06em', padding: '2px 5px', borderRadius: 3, marginTop: 1, flexShrink: 0, background: c.impact === 'high' ? 'rgba(8,145,178,0.13)' : 'var(--bg-subtle)', color: c.impact === 'high' ? '#0891b2' : 'var(--text-muted)' }}>{c.impact === 'high' ? 'HIGH' : 'MED'}</span>
                <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.35 }}>{c.title}</div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: 8 }}>{c.rationale}</div>
              {done ?
                <span className="k-chip" style={{ background: 'var(--success-100)', color: 'var(--success-700)', fontSize: 10.5 }}><Icon name="check" size={11} stroke={3} />Added to D3</span> :
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => apply(c)} className="k-btn k-btn-primary" style={{ height: 26, padding: '0 10px', fontSize: 11, flex: 1, justifyContent: 'center' }}><Icon name="plus" size={11} />Apply</button>
                  <button onClick={() => dismiss(c)} className="k-btn k-btn-plain" style={{ height: 26, padding: '0 9px', fontSize: 11 }}>Dismiss</button>
                </div>}
            </div>);
        })}
      </RailSection>

      {/* Ranked root causes */}
      <RailSection icon="gitBranch" color="#6366f1" title="Ranked root causes" count={causes.length}
        action={<button title="Refresh" onClick={() => { setCausesDismissed(new Set()); onToast && onToast('AI suggestions refreshed — ranking re-computed'); }} className="k-btn-plain" style={{ padding: 4, color: 'var(--text-muted)', display: 'inline-flex' }}><Icon name="refresh" size={13} /></button>}>
        {causes.map((s, i) => {
          if (causesDismissed.has(i)) return null;
          const isAccepted = accepted === i;
          return (
            <div key={i} style={{ padding: 10, borderRadius: 'var(--r-md)', border: isAccepted ? '1.5px solid var(--success-500)' : '1px solid var(--border)', background: isAccepted ? 'var(--success-50)' : 'var(--surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-subtle)' }}>#{i + 1}</span>
                <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, flex: 1 }}>{s.cause}</div>
              </div>
              <ConfidenceMeter value={s.confidence} />
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.45, margin: '7px 0' }}>{s.evidence}</div>
              {s.similar &&
                <button onClick={() => { if (s.similar.startsWith('8D')) { set8d(s.similar); setRoute('8d-detail'); } else { setNcr(s.similar); setRoute('ncr-detail'); } }}
                  style={{ fontSize: 10.5, display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 8 }}>
                  <Icon name="link" size={10} />Precedent: <span className="mono">{s.similar}</span>
                </button>}
              <div>
                {isAccepted ?
                  <span className="k-chip" style={{ background: 'var(--success-100)', color: 'var(--success-700)', fontSize: 10.5 }}><Icon name="check" size={11} stroke={3} />Accepted as root cause</span> :
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setAccepted(i)} className="k-btn k-btn-primary" style={{ height: 26, padding: '0 10px', fontSize: 11, flex: 1, justifyContent: 'center' }}><Icon name="check" size={11} stroke={2.5} />Accept</button>
                    <button onClick={() => setCausesDismissed(s2 => new Set(s2).add(i))} className="k-btn k-btn-plain" style={{ height: 26, padding: '0 9px', fontSize: 11 }}>Dismiss</button>
                  </div>}
              </div>
            </div>);
        })}
      </RailSection>

      {/* Similar past cases */}
      <RailSection icon="history" color="#9333ea" title="Similar past cases" count={e.similarCases.length}>
        {e.similarCases.map((c) => (
          <button key={c.id} onClick={() => { if (c.kind === '8d') { set8d(c.id); setRoute('8d-detail'); } else { setNcr(c.id); setRoute('ncr-detail'); } }}
            style={{ textAlign: 'left', padding: 10, borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', transition: 'border-color 120ms, background 120ms' }}
            onMouseEnter={(ev) => { ev.currentTarget.style.borderColor = 'var(--accent)'; ev.currentTarget.style.background = 'var(--bg-subtle)'; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.borderColor = 'var(--border)'; ev.currentTarget.style.background = 'var(--surface)'; }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <span className="mono" style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--accent)' }}>{c.id}</span>
              <div style={{ flex: 1 }} />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, color: c.match >= 80 ? 'var(--success-600)' : 'var(--warning-600)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />{c.match}% match
              </span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, marginBottom: 6 }}>{c.title}</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: 7 }}>
              <span style={{ color: 'var(--text-subtle)' }}>Root cause:</span> {c.rootCause}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5 }}>
              <span className="k-chip" style={{ fontSize: 10, background: c.outcome === 'closed' ? 'var(--success-100)' : 'var(--warning-100)', color: c.outcome === 'closed' ? 'var(--success-700)' : 'var(--warning-700)' }}>
                {c.outcome === 'closed' ? `Closed · ${c.closedIn}` : 'CAPA active'}
              </span>
              <span style={{ color: 'var(--text-subtle)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>{c.capa}</span>
            </div>
          </button>))}
      </RailSection>
    </aside>);
};

// ——————————————————————————————————————————————
// Generate pack / report modal
// ——————————————————————————————————————————————
const rootCauseText = (e) => {
  if (e.steps.D4.aiSuggestions[0]) return e.steps.D4.aiSuggestions[0].cause;
  return 'See D4 analysis';
};

const GENERATE_SPECS = {
  capa: {
    title: 'Generate CAPA pack',
    sub: 'Corrective & preventive action package, derived from the 8D',
    icon: 'shieldCheck',
    steps: [
      'Reading verified root cause from D4 analysis',
      'Mapping corrective actions (D5) and preventive actions (D7)',
      'Drafting CAPA record with owners & due dates',
      'Attaching evidence, approvals and the 5-Whys chain',
      'Assembling CAPA pack — record · plan · effectiveness check',
    ],
    artifacts: [
      { icon: 'fileText', name: 'CAPA-2026-0058 — record.pdf', meta: 'Corrective + preventive plan' },
      { icon: 'fileXls', name: 'action-plan.xlsx', meta: '6 actions · owners · due dates' },
      { icon: 'fileText', name: 'effectiveness-check.pdf', meta: '30 / 60 / 90-day verification' },
    ],
    cta: 'Open CAPA record', route: 'capa-detail',
    file: (e) => ({
      name: `CAPA-pack-${e.id}.md`,
      content:
`# CAPA Pack — derived from ${e.id}
Generated by Kaenal Quality Copilot

Source NCR:      ${e.aiDraftedFrom}
Problem:         ${e.title}
Verified root cause: ${rootCauseText(e)}

## Corrective actions (D5)
- Replace shielding-gas regulator on Station 3B (Owner: Production · due +3d)
- Re-validate gas flow at 18 L/min across Weld Cell 3 (Owner: Quality · due +5d)

## Preventive actions (D7)
- Shorten regulator PM interval from 36 to 18 months (Owner: Maintenance)
- Add inline gas-flow monitoring to all weld stations (Owner: Engineering)
- Update pre-weld checklist with mandatory flow verification (Owner: Quality)

## Effectiveness verification
- 30 / 60 / 90-day porosity reject-rate review vs 0.5% IATF threshold
`,
    }),
  },
  audit: {
    title: 'Generate audit-ready report',
    sub: 'IATF 16949 §10.2 conformant 8D report with full evidence trail',
    icon: 'fileText',
    steps: [
      'Collecting D1–D8 workflow data and approvals',
      'Compiling evidence, photos and measurement records',
      'Checking IATF 16949 §10.2 conformance',
      'Rendering audit-ready 8D report',
      'Sealing with timestamps & e-signatures',
    ],
    artifacts: [
      { icon: 'filePdf', name: `${'8D'}-report.pdf`, meta: 'D1–D8 · 14 pages' },
      { icon: 'folder', name: 'evidence-appendix.zip', meta: '11 files · photos & records' },
      { icon: 'fileText', name: 'conformance-checklist.pdf', meta: 'IATF 16949 §10.2 — 18/18 met' },
    ],
    cta: 'Open report PDF', route: '8d-pdf',
    file: (e) => ({
      name: `audit-report-${e.id}.md`,
      content:
`# Audit-Ready 8D Report — ${e.id}
Generated by Kaenal Quality Copilot · IATF 16949 §10.2

Title:        ${e.title}
Source NCR:   ${e.aiDraftedFrom}
Status:       ${e.status} · D${e.currentStep} of 8

## Evidence trail
- D1 Team formed ......... ${e.startedAt}
- D2 Problem defined ..... approved
- D3 Containment ......... effective
- D4 Root cause .......... ${rootCauseText(e)}

## Conformance
IATF 16949 §10.2 — 18 / 18 requirements met.
All AI-drafted fields reviewed and approved by the quality team.
`,
    }),
  },
};

const GeneratePackModal = ({ type, e, onClose, setRoute }) => {
  const spec = GENERATE_SPECS[type];
  const [done, setDone] = React.useState(0);
  const finished = done >= spec.steps.length;

  React.useEffect(() => {
    if (finished) return;
    const t = setTimeout(() => setDone((d) => d + 1), done === 0 ? 450 : 720);
    return () => clearTimeout(t);
  }, [done, finished]);

  const download = () => {
    const { name, content } = spec.file(e);
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={(ev) => ev.stopPropagation()} className="k-surface" style={{ width: 540, maxWidth: '100%', maxHeight: '90vh', overflow: 'auto', padding: 0, boxShadow: 'var(--shadow-xl)' }}>
        {/* Header */}
        <div style={{ padding: 20, background: 'linear-gradient(135deg, rgba(99,102,241,0.10), rgba(219,39,119,0.07))', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 13 }}>
          <div style={{ width: 40, height: 40, borderRadius: 'var(--r-md)', background: 'linear-gradient(135deg, #6366f1, #db2777)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name={spec.icon} size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>{spec.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{spec.sub}</div>
          </div>
          <button onClick={onClose} className="k-btn-plain" style={{ padding: 6, display: 'inline-flex' }}><Icon name="x" size={18} /></button>
        </div>

        {/* Body */}
        <div style={{ padding: 20 }}>
          {!finished ?
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {spec.steps.map((label, i) => {
                const state = i < done ? 'done' : i === done ? 'active' : 'pending';
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: state === 'pending' ? 0.4 : 1, transition: 'opacity 200ms' }}>
                    <div style={{ width: 22, height: 22, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {state === 'done' && <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--success-500)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={13} stroke={3} /></div>}
                      {state === 'active' && <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2.5px solid var(--accent-soft)', borderTopColor: 'var(--accent)', animation: 'k-spin 0.7s linear infinite' }} />}
                      {state === 'pending' && <div style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--border-strong)' }} />}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: state === 'active' ? 600 : 500, color: state === 'pending' ? 'var(--text-muted)' : 'var(--text)' }}>{label}</div>
                  </div>);
              })}
            </div>
            :
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 'var(--r-md)', background: 'var(--success-50)', border: '1px solid var(--success-100)' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--success-500)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="check" size={16} stroke={3} /></div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--success-700)' }}>Pack generated</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{spec.artifacts.length} artifacts ready · traceable to {e.id}</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {spec.artifacts.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 'var(--r-sm)', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name={a.icon} size={15} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.meta}</div>
                    </div>
                    <Icon name="check" size={14} stroke={2.5} className="" />
                  </div>))}
              </div>
            </div>}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, fontSize: 11, color: 'var(--text-subtle)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Icon name="sparkles" size={12} />Generated by Kaenal Quality Copilot
          </div>
          {finished ?
            <>
              <button onClick={download} className="k-btn k-btn-ghost"><Icon name="download" size={14} />Download</button>
              <button onClick={() => { setRoute(spec.route); onClose(); }} className="k-btn k-btn-primary"><Icon name="arrowRight" size={14} />{spec.cta}</button>
            </>
            :
            <button onClick={onClose} className="k-btn k-btn-ghost">Cancel</button>}
        </div>
      </div>
    </div>);
};

Object.assign(window, {
  AI_FIELD_KEYS, AiDraftControls, AiCardHeader, AIProvenanceStrip,
  AICopilotRail, GeneratePackModal,
});
