// Kaenal — 8D PDF Report (print-ready preview)
// Final 8D documentation generated from the template designer

function EightDPdfReport({ id, setRoute }) {
  const e = window.EIGHT_D;
  const templates = window.EIGHTD_TEMPLATES || [];
  const [templateId, setTemplateId] = React.useState(templates[0]?.id || null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef(null);

  const activeTpl = templates.find(t => t.id === templateId) || templates[0];
  const accent = activeTpl?.color || '#2563eb';
  const STANDARDS = {
    'tmpl-iatf-weld': 'IATF 16949:2016',
    'tmpl-iatf-machining': 'IATF 16949:2016',
    'tmpl-customer-complaint': 'IATF 16949:2016',
    'tmpl-supplier': 'ISO 9001:2015',
    'tmpl-safety': 'ISO 45001:2018',
    'tmpl-aerospace': 'AS9100D:2016',
    'tmpl-pharma': '21 CFR Part 211 / 820',
  };
  const standard = STANDARDS[templateId] || 'IATF 16949:2016';
  const totalSla = activeTpl?.slas ? Object.values(activeTpl.slas).reduce((a, b) => a + b, 0) : null;

  React.useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (ev) => { if (menuRef.current && !menuRef.current.contains(ev.target)) setMenuOpen(false); };
    const onKey = (ev) => { if (ev.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  return (
    <div style={{ background: '#e2e8f0', minHeight: 'calc(100vh - 56px)' }}>
      {/* Top toolbar */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 5 }}>
        <button onClick={() => setRoute('8d-detail')} className="k-btn-plain" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
          <Icon name="arrowLeft" size={14}/> Back to 8D
        </button>
        <div style={{ width: 1, height: 22, background: 'var(--border)' }}/>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>8D Final Report — Preview</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.id} · Generated via "{activeTpl?.name || 'IATF — Welding Defects'}" template · 3 pages</div>
        </div>
        <Segmented size="sm" value="100" onChange={() => {}} options={[
          { value: '75', label: '75%' },
          { value: '100', label: '100%' },
          { value: '125', label: '125%' },
        ]}/>
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button className="k-btn k-btn-secondary" aria-haspopup="true" aria-expanded={menuOpen}
            onClick={() => setMenuOpen(o => !o)}>
            <Icon name="copy" size={13}/> Choose template
            <Icon name="chevronDown" size={12}/>
          </button>
          {menuOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 320, zIndex: 30,
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
              boxShadow: '0 12px 32px rgba(15,23,42,0.18)', padding: 6, maxHeight: 420, overflowY: 'auto',
            }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, padding: '8px 10px 6px' }}>Regenerate report with template</div>
              {templates.map(t => {
                const active = t.id === templateId;
                return (
                  <button key={t.id} onClick={() => { setTemplateId(t.id); setMenuOpen(false); }} style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                    padding: '9px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: active ? 'var(--accent-soft)' : 'transparent',
                  }}
                    onMouseEnter={ev => { if (!active) ev.currentTarget.style.background = 'var(--bg-subtle)'; }}
                    onMouseLeave={ev => { if (!active) ev.currentTarget.style.background = 'transparent'; }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: t.color + '18', color: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="brain" size={15}/>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{t.name}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{t.industry} · {t.uses} uses · avg {t.avgCloseDays}d</div>
                    </div>
                    {active && <Icon name="check" size={15} stroke={3} />}
                  </button>
                );
              })}
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6 }}>
                <button onClick={() => { setMenuOpen(false); setRoute('8d-templates'); }} className="k-btn-plain" style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 10px',
                  fontSize: 12, color: 'var(--accent)', fontWeight: 600,
                }}>
                  <Icon name="settings" size={13}/> Manage templates
                </button>
              </div>
            </div>
          )}
        </div>
        <button className="k-btn k-btn-secondary" onClick={() => kToast('Report emailed to the 8D team & customer contact')}><Icon name="mail" size={13}/> Email</button>
        <button className="k-btn k-btn-primary" onClick={() => kToast('Download started — 8d-report.pdf')}><Icon name="download" size={13}/> Download PDF</button>
      </div>

      {/* Page stack */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 0 60px', gap: 24 }}>
        <PdfPage page={1} of={3}>
          <CoverPage e={e} accent={accent} standard={standard} tpl={activeTpl} totalSla={totalSla}/>
        </PdfPage>
        <PdfPage page={2} of={3}>
          <D1D4Page e={e} accent={accent}/>
        </PdfPage>
        <PdfPage page={3} of={3}>
          <D5D8Page e={e} accent={accent}/>
        </PdfPage>
      </div>
    </div>
  );
}

function PdfPage({ page, of, children }) {
  return (
    <div style={{ width: 816, minHeight: 1056, background: 'white', color: '#0f172a', boxShadow: '0 10px 30px rgba(15,23,42,0.18)', position: 'relative', padding: 56, fontFamily: '"Inter", sans-serif' }}>
      {children}
      <div style={{ position: 'absolute', bottom: 24, left: 56, right: 56, paddingTop: 14, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#94a3b8' }}>
        <span>Confidential — Precision Auto Components Pvt. Ltd.</span>
        <span>8D-2026-0015 · Page {page} of {of}</span>
      </div>
    </div>
  );
}

function CoverPage({ e, accent = '#2563eb', standard = 'IATF 16949:2016', tpl, totalSla }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 40 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: accent, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800 }}>P</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Precision Auto Components Pvt. Ltd.</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Quality Assurance · Pune-1 Plant</div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: '#94a3b8', letterSpacing: '0.08em', fontWeight: 700 }}>{standard}</div>
          {tpl && <div style={{ fontSize: 9.5, color: '#cbd5e1', fontWeight: 600, marginTop: 2 }}>{tpl.name}</div>}
        </div>
      </div>

      <div style={{ marginBottom: 36, paddingBottom: 28, borderBottom: `3px solid ${accent}` }}>
        <div style={{ fontSize: 10, color: '#64748b', letterSpacing: '0.18em', fontWeight: 700 }}>8D PROBLEM-SOLVING REPORT</div>
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', margin: '8px 0 14px', lineHeight: 1.1 }}>{e.title}</h1>
        <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#475569' }}>
          <span><strong style={{ color: '#0f172a' }}>{e.id}</strong></span>
          <span>·</span>
          <span>Linked NCR: <strong style={{ color: '#0f172a' }}>{e.ncrId || 'NCR-2026-0089'}</strong></span>
          <span>·</span>
          <span>Started: <strong style={{ color: '#0f172a' }}>16 Apr 2026</strong></span>
          <span>·</span>
          <span>Closed: <strong style={{ color: '#0f172a' }}>11 May 2026</strong></span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 32 }}>
        {[
          { l: 'Customer Impact', v: '12 units', s: 'Volvo Group — Hold released' },
          { l: 'Cost to Resolve', v: '$8,420', s: 'Containment + rework + tooling' },
          { l: 'Days to Close', v: (tpl ? `${tpl.avgCloseDays} days` : '26 days'), s: (totalSla ? `Template SLA target: ${totalSla}d` : '4 days faster than target') },
        ].map(k => (
          <div key={k.l} style={{ padding: 16, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 4 }}>{k.l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>{k.v}</div>
            <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>{k.s}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: '#0f172a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Executive Summary</div>
        <p style={{ fontSize: 12.5, lineHeight: 1.7, color: '#334155', margin: 0 }}>
          Recurring weld porosity on Part #A-7742 (driveshaft yoke) was traced to wire feed regulator drift on Station 3B
          combined with insufficient pre-cleaning of the joint surface. A closed-loop SPC patch and revised cleaning protocol
          were implemented and verified across 3 production runs. Effectiveness validated by zero porosity defects in 14,200
          consecutive parts (May 2–11, 2026). Permanent corrective actions complete and rolled out to all five welding cells.
        </p>
      </div>

      <div>
        <div style={{ fontSize: 11, color: '#0f172a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Team</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {[
            { n: 'Anna Schmidt', r: 'Team Lead — Quality Engineer' },
            { n: 'Manjunath Kumar', r: 'Champion — Quality Manager' },
            { n: 'Rafael Costa', r: 'Process Engineer (Welding)' },
            { n: 'Tanmay Bhat', r: 'Maintenance Lead' },
            { n: 'Liu Wei', r: 'Cell 3 Operator' },
            { n: 'Sarah Ahmed', r: 'CMM Specialist' },
          ].map(p => (
            <div key={p.n} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#f1f5f9', borderRadius: 6 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: accent, color: 'white', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{p.n.split(' ').map(x => x[0]).join('')}</div>
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 600 }}>{p.n}</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>{p.r}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function PdfSection({ d, title, status, children, accent = '#2563eb' }) {
  const colors = { complete: '#16a34a', inProgress: '#f59e0b' };
  return (
    <div style={{ marginBottom: 22, paddingBottom: 18, borderBottom: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 6, background: accent, color: 'white', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d}</div>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, flex: 1 }}>{title}</h3>
        <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 'var(--r-full)', background: '#dcfce7', color: '#15803d', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Complete</span>
      </div>
      <div style={{ paddingLeft: 40, fontSize: 11.5, color: '#334155', lineHeight: 1.65 }}>{children}</div>
    </div>
  );
}

function D1D4Page({ e, accent = '#2563eb' }) {
  return (
    <>
      <div style={{ fontSize: 10, color: '#64748b', letterSpacing: '0.18em', fontWeight: 700, marginBottom: 18 }}>D1 — D4 · TEAM, PROBLEM, CONTAINMENT, ROOT CAUSE</div>

      <PdfSection accent={accent} d="D1" title="Team" status="complete">
        Cross-functional team established 16 Apr 2026. Six members spanning Quality, Process Engineering, Maintenance,
        and Production. Team Lead: Anna Schmidt. Champion: Manjunath Kumar. Daily 15-min stand-ups for first 5 days,
        then 2× weekly.
      </PdfSection>

      <PdfSection accent={accent} d="D2" title="Problem Description (5W2H)" status="complete">
        <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
          <tbody>
            {[
              ['What', 'Weld porosity on Part #A-7742 (driveshaft yoke) exceeding 2.5% defect rate (spec ≤ 0.5%)'],
              ['Where', 'Plant A — Weld Cell 3, Station 3B'],
              ['When', '14 Apr 2026 onwards; observed on 2nd shift initially, spread to all shifts within 48h'],
              ['Who', 'Affects all operators on Cell 3; 12 units shipped to Volvo Group before detection'],
              ['Why', 'Customer field return triggered investigation'],
              ['How', 'Visual + X-ray reveals subsurface porosity in 14.2% of weld passes'],
              ['How many', '47 confirmed defective units in 3 days; 14,200 units at risk in pipeline'],
            ].map(([k, v]) => (
              <tr key={k} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '6px 10px 6px 0', fontWeight: 700, width: 80, verticalAlign: 'top' }}>{k}</td>
                <td style={{ padding: '6px 0' }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PdfSection>

      <PdfSection accent={accent} d="D3" title="Interim Containment" status="complete">
        <ul style={{ paddingLeft: 16, margin: '6px 0' }}>
          <li>Customer notified, 12 suspect units held at Volvo. Containment ECN-2026-114 issued.</li>
          <li>Cell 3 shut down 14 Apr 18:00 — 15 Apr 06:00. 100% X-ray inspection added.</li>
          <li>WIP (1,247 units) re-inspected; 41 additional defective parts removed.</li>
          <li>Effectiveness: 0 escapes during containment window (validated by SQC).</li>
        </ul>
      </PdfSection>

      <PdfSection accent={accent} d="D4" title="Root Cause Analysis" status="complete">
        <div style={{ fontWeight: 700, marginBottom: 6 }}>5 Whys (verified):</div>
        <ol style={{ paddingLeft: 18, margin: '4px 0 12px', fontSize: 11, lineHeight: 1.8 }}>
          <li><strong>Why are welds porous?</strong> Insufficient shielding gas at the joint surface.</li>
          <li><strong>Why insufficient shielding gas?</strong> Wire feed speed running at 5.8 m/min vs. 6.5 m/min spec.</li>
          <li><strong>Why feed speed off?</strong> Regulator on Station 3B drifting due to aged solenoid.</li>
          <li><strong>Why undetected?</strong> No closed-loop feedback on feed speed; manual gauge check 1×/shift.</li>
          <li><strong>Why no closed-loop?</strong> Control plan written when only open-loop sensors were available.</li>
        </ol>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Verified root causes:</div>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: 10, fontSize: 11 }}>
          <strong style={{ color: '#991b1b' }}>RC1 — Detection:</strong> Open-loop wire feed control with manual checks insufficient to catch drift.<br/>
          <strong style={{ color: '#991b1b' }}>RC2 — Occurrence:</strong> Aged solenoid (4.2 yrs, MTBF 4 yrs) on Station 3B regulator.
        </div>
      </PdfSection>
    </>
  );
}

function D5D8Page({ e, accent = '#2563eb' }) {
  return (
    <>
      <div style={{ fontSize: 10, color: '#64748b', letterSpacing: '0.18em', fontWeight: 700, marginBottom: 18 }}>D5 — D8 · CORRECTIVE ACTIONS, PREVENTION, CLOSURE</div>

      <PdfSection accent={accent} d="D5" title="Permanent Corrective Action" status="complete">
        <ol style={{ paddingLeft: 18, margin: 0, lineHeight: 1.8 }}>
          <li><strong>Closed-loop SPC patch</strong> — Real-time wire feed monitoring via IFM SU8000 flow sensor. Alarm + auto-stop on ±3% deviation.</li>
          <li><strong>Predictive maintenance</strong> — Replace all 5 cell solenoids on 4-yr schedule (was 5-yr). Calibration verified quarterly.</li>
          <li><strong>Control plan revision</strong> — CP-A7742-r5 published with closed-loop control class (was open-loop).</li>
        </ol>
        <div style={{ marginTop: 10, fontSize: 11, padding: '8px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6 }}>
          <strong>Verification:</strong> Tested across 3 production runs (28 Apr – 5 May), 14,200 consecutive parts inspected.
          Result: 0 porosity defects (was 14.2%). Cpk improved from 0.84 to 1.67 on this characteristic.
        </div>
      </PdfSection>

      <PdfSection accent={accent} d="D6" title="Implement & Validate" status="complete">
        <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>Action</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>Owner</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>Date</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Install SU8000 sensors on all 5 cells', 'T. Bhat', '28 Apr', '✓ Complete'],
              ['Update PLC logic & SCADA dashboards', 'R. Costa', '30 Apr', '✓ Complete'],
              ['Revise control plan CP-A7742 to r5', 'A. Schmidt', '03 May', '✓ Published'],
              ['Retrain 14 cell operators', 'L. Wei', '05 May', '✓ 100% completed'],
              ['Update PFMEA RPN scores', 'A. Schmidt', '07 May', '✓ Reviewed'],
            ].map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                {r.map((c, j) => <td key={j} style={{ padding: '6px 8px' }}>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </PdfSection>

      <PdfSection accent={accent} d="D7" title="Prevent Recurrence (Systemic)" status="complete">
        <ul style={{ paddingLeft: 16, margin: 0, lineHeight: 1.7 }}>
          <li>Closed-loop monitoring required on all open-loop critical-characteristic processes (12 identified, 3 implemented, 9 in queue — CAPA-2026-0042).</li>
          <li>Lessons-learned added to standard work for weld cells globally (Pune, Detroit, Bratislava).</li>
          <li>Knowledge base entry KB-WLD-014 published.</li>
          <li>Layered Process Audits to verify closed-loop alarms monthly for 6 months.</li>
        </ul>
      </PdfSection>

      <PdfSection accent={accent} d="D8" title="Team Recognition & Closure" status="complete">
        Team recognized at the May 2026 Plant Town Hall. Estimated 12-month savings: $186K from prevented escapes and rework.
        8D closed by Quality Manager 11 May 2026 with effectiveness review scheduled 11 Nov 2026 (6-month checkpoint).
      </PdfSection>

      <div style={{ marginTop: 20, padding: 14, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 6 }}>Team Lead</div>
          <div style={{ height: 36, borderBottom: '1.5px solid #475569', display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
            <span style={{ fontFamily: 'Dancing Script, cursive', fontSize: 22, color: '#1e3a8a' }}>Anna Schmidt</span>
          </div>
          <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 4 }}>Anna Schmidt · 11 May 2026</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 6 }}>Champion / Quality Manager</div>
          <div style={{ height: 36, borderBottom: '1.5px solid #475569', display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
            <span style={{ fontFamily: 'Dancing Script, cursive', fontSize: 22, color: '#1e3a8a' }}>M. Kumar</span>
          </div>
          <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 4 }}>Manjunath Kumar · 11 May 2026</div>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { EightDPdfReport });
