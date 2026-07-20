// Kaenal — QMS Risk & SPC Analytics
// Risk register (ISO 31000), FMEA workbench, SPC charts, MSA / Gauge R&R

// ─────────────────────────────────────────────────────────────
// RISK REGISTER (ISO 31000)
// ─────────────────────────────────────────────────────────────
const RISKS = [
  { id: 'R-001', cat: 'Supply', t: 'Single-source supplier for VBR-3041 hub bearing', owner: 'u4', likelihood: 4, impact: 5, trend: 'up', treatment: 'mitigate', residual: 12, status: 'active', plan: 'Qualify 2nd source by Q3 — PPAP started' },
  { id: 'R-002', cat: 'Process', t: 'Weld penetration drift on Line 4', owner: 'u1', likelihood: 3, impact: 4, trend: 'flat', treatment: 'mitigate', residual: 6, status: 'active', plan: 'SPC alarm + monthly Cpk review' },
  { id: 'R-003', cat: 'Compliance', t: 'IATF re-certification audit due Sep 2026', owner: 'u1', likelihood: 5, impact: 5, trend: 'flat', treatment: 'mitigate', residual: 10, status: 'active', plan: 'Mock audit May, prep packets June' },
  { id: 'R-004', cat: 'Cyber', t: 'Ransomware on plant OT network', owner: 'u-david', likelihood: 2, impact: 5, trend: 'up', treatment: 'mitigate', residual: 6, status: 'active', plan: 'OT segmentation, EDR rollout' },
  { id: 'R-005', cat: 'People', t: 'Loss of senior CMM operators (3 retiring)', owner: 'u-david', likelihood: 4, impact: 3, trend: 'up', treatment: 'mitigate', residual: 8, status: 'active', plan: 'Shadowing program · 6 trainees' },
  { id: 'R-006', cat: 'Quality', t: 'Field failure cluster on Volvo T-9384', owner: 'u1', likelihood: 3, impact: 5, trend: 'up', treatment: 'mitigate', residual: 9, status: 'active', plan: '8D in flight, retrofit being scoped' },
  { id: 'R-007', cat: 'Environmental', t: 'Effluent compliance — ZLD readiness', owner: 'u-david', likelihood: 2, impact: 4, trend: 'down', treatment: 'mitigate', residual: 4, status: 'monitoring', plan: 'CETP-approved · monthly testing' },
  { id: 'R-008', cat: 'Financial', t: 'Inventory write-off on slow-moving SKUs', owner: 'u-david', likelihood: 3, impact: 2, trend: 'flat', treatment: 'accept', residual: 6, status: 'accepted', plan: 'Quarterly review' },
  { id: 'R-009', cat: 'Reputation', t: 'Public 8D request from OEM customer', owner: 'u1', likelihood: 2, impact: 4, trend: 'flat', treatment: 'transfer', residual: 4, status: 'monitoring', plan: 'PR retainer + customer liaison' },
];

function RiskRegister({ setRoute }) {
  const [selected, setSelected] = React.useState('R-001');
  const r = RISKS.find(x => x.id === selected);

  return (
    <div>
      <PageHeader
        title="Risk register"
        description="ISO 31000 risk register with treatment plans, residual scoring, and quarterly review schedule."
        actions={
          <>
            <button className="k-btn k-btn-ghost" onClick={() => kToast('Export started — risk-board-pack.pdf')}><Icon name="download" size={13}/> Board pack</button>
            <button className="k-btn k-btn-primary" onClick={() => kToast('New risk drafted — score severity × likelihood to place it')}><Icon name="plus" size={13}/> Add risk</button>
          </>
        }
      />

      <div style={{ padding: '20px 28px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 18 }}>
          {[
            { l: 'Total risks', v: 47, c: '#2563eb' },
            { l: 'High residual (≥ 12)', v: 4, c: '#dc2626' },
            { l: 'Treatments overdue', v: 2, c: '#f59e0b' },
            { l: 'Accepted', v: 12, c: '#7c3aed' },
            { l: 'Reviewed this quarter', v: '87%', c: '#16a34a' },
          ].map(k => (
            <div key={k.l} className="k-surface" style={{ padding: 12 }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{k.l}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: k.c }}>{k.v}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
          <Card title="5×5 heat map — residual risk" desc="Click a cell to filter the register">
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
              {/* y-axis label */}
              <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '8px 0' }}>Impact →</div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', padding: '4px 4px 28px', textAlign: 'right' }}>
                {[5,4,3,2,1].map(i => <div key={i}>{i}</div>)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
                  {[5,4,3,2,1].map(y => [1,2,3,4,5].map(x => {
                    const s = x * y;
                    const count = RISKS.filter(r => r.likelihood === x && r.impact === y).length;
                    const bg = s >= 16 ? '#dc2626' : s >= 10 ? '#ea580c' : s >= 6 ? '#f59e0b' : '#22c55e';
                    return (
                      <div key={`${x}-${y}`} style={{
                        aspectRatio: '1', background: bg + (count ? 'cc' : '30'), borderRadius: 4,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: count ? 16 : 11, fontWeight: count ? 700 : 400,
                        color: count ? 'white' : 'rgba(255,255,255,0.5)',
                      }}>{count || s}</div>
                    );
                  }))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, marginTop: 6, fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
                  {[1,2,3,4,5].map(i => <div key={i}>{i}</div>)}
                </div>
                <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 6 }}>Likelihood →</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 11, marginTop: 14, justifyContent: 'center' }}>
              <Legend color="#22c55e" l="Low (1-5)"/>
              <Legend color="#f59e0b" l="Medium (6-9)"/>
              <Legend color="#ea580c" l="High (10-15)"/>
              <Legend color="#dc2626" l="Critical (16-25)"/>
            </div>
          </Card>

          <Card title="By category">
            {[
              { c: 'Supply', n: 12, color: '#2563eb' },
              { c: 'Process', n: 9, color: '#0d9488' },
              { c: 'Compliance', n: 7, color: '#7c3aed' },
              { c: 'Quality', n: 6, color: '#dc2626' },
              { c: 'Cyber', n: 5, color: '#1e293b' },
              { c: 'People', n: 4, color: '#f59e0b' },
              { c: 'Environmental', n: 3, color: '#16a34a' },
              { c: 'Financial', n: 1, color: '#94a3b8' },
            ].map(g => (
              <div key={g.c} style={{ padding: '6px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span>{g.c}</span><span className="mono" style={{ fontWeight: 600 }}>{g.n}</span>
                </div>
                <div style={{ height: 5, background: 'var(--bg-subtle)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${(g.n / 12) * 100}%`, height: '100%', background: g.color }}/>
                </div>
              </div>
            ))}
          </Card>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          <Card title="Register">
            <table className="k-table" style={{ width: '100%' }}>
              <thead><tr><th>ID</th><th>Risk</th><th>Cat</th><th>L</th><th>I</th><th>Score</th><th>Treatment</th></tr></thead>
              <tbody>
                {RISKS.map(rr => (
                  <tr key={rr.id} onClick={() => setSelected(rr.id)} style={{ cursor: 'pointer', background: selected === rr.id ? 'var(--accent-soft)' : '' }}>
                    <td className="mono" style={{ fontSize: 11.5 }}>{rr.id}</td>
                    <td style={{ fontSize: 12.5, maxWidth: 360 }}>{rr.t}</td>
                    <td><span className="k-chip" style={{ background: 'var(--bg-subtle)', fontSize: 10 }}>{rr.cat}</span></td>
                    <td className="mono" style={{ textAlign: 'center' }}>{rr.likelihood}</td>
                    <td className="mono" style={{ textAlign: 'center' }}>{rr.impact}</td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 28, height: 22, borderRadius: 4,
                        background: rr.residual >= 16 ? '#dc2626' : rr.residual >= 10 ? '#ea580c' : rr.residual >= 6 ? '#f59e0b' : '#22c55e',
                        color: 'white', fontWeight: 700, fontSize: 11,
                      }}>{rr.residual}</span>
                      {rr.trend === 'up' && <span style={{ color: '#dc2626', marginLeft: 4, fontSize: 11 }}>↑</span>}
                      {rr.trend === 'down' && <span style={{ color: '#16a34a', marginLeft: 4, fontSize: 11 }}>↓</span>}
                    </td>
                    <td><span className="k-chip" style={{ background: 'var(--bg-subtle)', fontSize: 10 }}>{rr.treatment}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title={r.id} desc={r.t}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 14 }}>
              <Field k="Category" v={r.cat}/>
              <Field k="Owner" v={userById(r.owner)?.name || r.owner}/>
              <Field k="Likelihood" v={`${r.likelihood} / 5`}/>
              <Field k="Impact" v={`${r.impact} / 5`}/>
              <Field k="Inherent score" v={r.likelihood * r.impact}/>
              <Field k="Residual score" v={r.residual}/>
            </div>

            <div className="k-overline" style={{ marginBottom: 6 }}>Treatment plan</div>
            <div style={{ padding: 10, background: 'var(--bg-subtle)', borderRadius: 6, fontSize: 12, lineHeight: 1.5, marginBottom: 14 }}>{r.plan}</div>

            <div className="k-overline" style={{ marginBottom: 6 }}>Controls</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { c: 'Detective — SPC alarm on weld penetration', strength: 'strong' },
                { c: 'Preventive — Weekly Cpk review', strength: 'strong' },
                { c: 'Corrective — NCR / 8D process triggered', strength: 'medium' },
                { c: 'Contingency — Customer notification template', strength: 'weak' },
              ].map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'var(--bg-subtle)', borderRadius: 4, fontSize: 11.5 }}>
                  <Icon name="check" size={12} stroke={3} style={{ color: 'var(--success-600)' }}/>
                  <span style={{ flex: 1 }}>{c.c}</span>
                  <span className="k-chip" style={{ background: 'var(--surface)', color: 'var(--text-muted)', fontSize: 10 }}>{c.strength}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
              <button className="k-btn k-btn-secondary k-btn-sm" onClick={() => kToast('Risk opened for editing')}>Edit</button>
              <button className="k-btn k-btn-secondary k-btn-sm" onClick={() => kToast('Re-scoring — update severity & likelihood')}>Re-score</button>
              <button className="k-btn k-btn-secondary k-btn-sm" style={{ marginLeft: 'auto' }} onClick={() => kToast('Linked to PFMEA — Brake Caliper (failure mode #3)')}>Link to FMEA</button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// FMEA WORKBENCH (AIAG/VDA harmonized — PFMEA)
// ─────────────────────────────────────────────────────────────
const FMEA_ROWS = [
  { id: 1, fn: 'Weld bracket VBR-3041 to chassis', failure: 'Insufficient penetration (< 5.0mm)', effect: 'Joint fails in field — safety recall', sev: 9,
    cause: 'Wire feed speed drift', occ: 4, control_p: 'Daily calibration check', control_d: 'SPC chart on penetration', det: 3, ap: 'H', actions: ['Weekly auto-calibration', 'Add witness photo step'], current: true },
  { id: 2, fn: 'Same', failure: 'Excessive porosity (> 2%)', effect: 'Fatigue cracking', sev: 8,
    cause: 'Shield gas contamination', occ: 3, control_p: 'Gas mix verification each shift', control_d: 'Visual + RT every 50th part', det: 4, ap: 'M' },
  { id: 3, fn: 'Same', failure: 'Bead alignment off-center', effect: 'Cosmetic reject by customer', sev: 4,
    cause: 'Fixture wear on locating pin', occ: 5, control_p: 'PM monthly', control_d: 'First-article inspection per shift', det: 3, ap: 'L' },
  { id: 4, fn: 'CMM measure hub bore', failure: 'Roundness > 0.05mm out of tol', effect: 'Bearing pre-load wrong → field failure', sev: 9,
    cause: 'CMM stylus debris', occ: 2, control_p: 'Stylus cleaning every shift', control_d: '5-pt MMC check at start of shift', det: 2, ap: 'M' },
  { id: 5, fn: 'Assembly torque on fastener', failure: 'Under-torque (< 28 Nm)', effect: 'Fastener loosens in field', sev: 8,
    cause: 'Wrench calibration drift', occ: 3, control_p: '6-month calibration', control_d: 'Auto-log every torque', det: 2, ap: 'M' },
  { id: 6, fn: 'Surface finish bushing BHS-12', failure: 'Ra > 1.6μm', effect: 'Premature wear, customer complaint', sev: 6,
    cause: 'Wheel dressing missed', occ: 4, control_p: 'Counter-based dress cycle', control_d: 'Profilometer every 50 parts', det: 3, ap: 'L' },
];

function FMEAWorkbench({ setRoute }) {
  const [selected, setSelected] = React.useState(1);
  const row = FMEA_ROWS.find(r => r.id === selected) || FMEA_ROWS[0];

  return (
    <div>
      <PageHeader
        title="FMEA workbench"
        description="AIAG / VDA harmonized PFMEA — Action Priority scoring, control linking, and live re-scoring as actions complete."
        actions={
          <>
            <Segmented size="sm" value="pfmea" onChange={() => {}} options={[{value:'pfmea',label:'PFMEA'},{value:'dfmea',label:'DFMEA'}]}/>
            <button className="k-btn k-btn-ghost" onClick={() => kToast('Export started — fmea-aiag-vda-form.xlsx')}><Icon name="download" size={13}/> Export AIAG form</button>
            <button className="k-btn k-btn-primary" onClick={() => kToast('New FMEA created — add process steps to begin')}><Icon name="plus" size={13}/> New FMEA</button>
          </>
        }
      />
      <div style={{ padding: '20px 28px 32px' }}>
        <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <select className="k-input" defaultValue="vbr" style={{ width: 360 }}>
            <option>VBR-3041 — Volvo wheel hub bearing assembly</option>
            <option>BHS-12 — Bosch housing</option>
            <option>DTR-201 — Daimler bracket</option>
          </select>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>Last updated 12 min ago · Rev 4 · 6 process steps · 18 failure modes</span>
        </div>

        <div className="k-surface" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
            <thead style={{ background: 'var(--bg-subtle)' }}>
              <tr>
                <th style={{ ...thStyle, width: 30 }}>#</th>
                <th style={thStyle}>Process function</th>
                <th style={thStyle}>Failure mode</th>
                <th style={thStyle}>Effect</th>
                <th style={{ ...thStyle, width: 38, textAlign: 'center' }}>SEV</th>
                <th style={thStyle}>Cause</th>
                <th style={{ ...thStyle, width: 38, textAlign: 'center' }}>OCC</th>
                <th style={thStyle}>Prevention</th>
                <th style={thStyle}>Detection</th>
                <th style={{ ...thStyle, width: 38, textAlign: 'center' }}>DET</th>
                <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>AP</th>
              </tr>
            </thead>
            <tbody>
              {FMEA_ROWS.map((r) => (
                <tr key={r.id} onClick={() => setSelected(r.id)} style={{
                  cursor: 'pointer', background: selected === r.id ? 'var(--accent-soft)' : '',
                  borderTop: '1px solid var(--border)',
                }}>
                  <td style={tdStyle}>{r.id}</td>
                  <td style={tdStyle}>{r.fn}</td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{r.failure}</td>
                  <td style={tdStyle}>{r.effect}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}><ScoreBox v={r.sev}/></td>
                  <td style={tdStyle}>{r.cause}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}><ScoreBox v={r.occ}/></td>
                  <td style={tdStyle}>{r.control_p}</td>
                  <td style={tdStyle}>{r.control_d}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}><ScoreBox v={r.det}/></td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}><APBadge ap={r.ap}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, marginTop: 16 }}>
          <Card title="Action priority distribution">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                { l: 'High priority', n: 4, c: '#dc2626', desc: 'Action required. Senior management review.' },
                { l: 'Medium priority', n: 8, c: '#f59e0b', desc: 'Action should be taken. Document if not.' },
                { l: 'Low priority', n: 6, c: '#16a34a', desc: 'Action discretionary.' },
              ].map(p => (
                <div key={p.l} style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 'var(--r-md)', borderTop: `3px solid ${p.c}` }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 26, fontWeight: 700, color: p.c }}>{p.n}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>items</span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>{p.l}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4, marginTop: 4 }}>{p.desc}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, padding: 10, background: 'var(--bg-subtle)', borderRadius: 6, fontSize: 11.5, color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text)' }}>AIAG/VDA AP rules:</strong> Severity 9–10 with Occ ≥ 2 → High. Severity 7–8 with Occ × Det ≥ 6 → High. Others mapped per AIAG/VDA 1st Ed table.
            </div>
          </Card>

          <Card title={`#${row.id} — recommended actions`}>
            <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>{row.failure}</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <APBadge ap={row.ap}/>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>S{row.sev} × O{row.occ} × D{row.det}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {(row.actions || ['Increase detection frequency', 'Add poka-yoke gate']).map((a, i) => (
                <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: 'var(--bg-subtle)', borderRadius: 4, fontSize: 12 }}>
                  <input type="checkbox" style={{ accentColor: 'var(--accent)' }}/>
                  {a}
                </label>
              ))}
            </div>

            <div className="k-overline" style={{ marginBottom: 6 }}>Projected after-action</div>
            <div style={{ padding: 12, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Current AP</div>
                <APBadge ap={row.ap}/>
              </div>
              <Icon name="arrowRight" size={14}/>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>After actions</div>
                <APBadge ap="L"/>
              </div>
              <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--success-700)', fontWeight: 600 }}>Estimated risk reduction: 64%</div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

const thStyle = { padding: '8px 10px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'left', borderBottom: '1px solid var(--border)' };
const tdStyle = { padding: '10px', fontSize: 11.5, verticalAlign: 'top' };

function ScoreBox({ v }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 28, height: 22, borderRadius: 4,
      background: v >= 9 ? '#dc2626' : v >= 7 ? '#ea580c' : v >= 4 ? '#f59e0b' : '#22c55e',
      color: 'white', fontWeight: 700, fontSize: 11,
    }}>{v}</div>
  );
}
function APBadge({ ap }) {
  const m = { H: ['HIGH','#dc2626'], M: ['MEDIUM','#f59e0b'], L: ['LOW','#22c55e'] };
  return <span style={{
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: '3px 8px', borderRadius: 4, background: m[ap][1] + '18', color: m[ap][1],
    fontWeight: 800, fontSize: 10, letterSpacing: '0.04em',
  }}>{m[ap][0]}</span>;
}

// ─────────────────────────────────────────────────────────────
// SPC CHARTS
// ─────────────────────────────────────────────────────────────
function SPCCharts({ setRoute }) {
  const [chartType, setChartType] = React.useState('xbar-r');

  // Synthetic data — penetration mm, target 6.0, USL 7.0, LSL 5.0
  const subgroupCount = 25;
  const samples = [];
  for (let i = 0; i < subgroupCount; i++) {
    const driftBase = i > 18 ? 5.5 + (i - 18) * 0.05 : 6.0;
    const subgroup = [];
    for (let j = 0; j < 5; j++) {
      subgroup.push(driftBase + (Math.sin(i * 1.3 + j) + Math.sin(i * 0.7 + j * 1.4)) * 0.18);
    }
    samples.push(subgroup);
  }
  const xbar = samples.map(s => s.reduce((a, b) => a + b, 0) / s.length);
  const ranges = samples.map(s => Math.max(...s) - Math.min(...s));
  const xbarBar = xbar.reduce((a, b) => a + b, 0) / xbar.length;
  const rBar = ranges.reduce((a, b) => a + b, 0) / ranges.length;
  const A2 = 0.577, D3 = 0, D4 = 2.115;
  const UCL_x = xbarBar + A2 * rBar;
  const LCL_x = xbarBar - A2 * rBar;
  const UCL_r = D4 * rBar;
  const LCL_r = D3 * rBar;

  // Western Electric: any point outside ±3σ → WE-1
  const violations = xbar.map((v, i) => v > UCL_x || v < LCL_x ? i : null).filter(x => x !== null);

  return (
    <div>
      <PageHeader
        title="SPC charts"
        description="X-bar/R, p-chart, c-chart, individuals with Western Electric runs rules. Live link to inspection data."
        actions={
          <>
            <button className="k-btn k-btn-ghost" onClick={() => kToast('Export started — spc-control-charts.pdf')}><Icon name="download" size={13}/> Export PDF</button>
            <button className="k-btn k-btn-primary" onClick={() => kToast('Alarm rules opened — Western Electric rules 1–4 active')}><Icon name="bell" size={13}/> Configure alarm</button>
          </>
        }
      />

      <div style={{ padding: '20px 28px 32px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
          <Segmented size="sm" value={chartType} onChange={setChartType} options={[
            { value: 'xbar-r', label: 'X̄ / R' }, { value: 'imr', label: 'I-MR' }, { value: 'p', label: 'p-chart' }, { value: 'c', label: 'c-chart' },
          ]}/>
          <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-muted)' }}>Volvo VBR-3041 · Weld penetration · Station 4 · Last 25 shifts (subgroup n=5)</span>
        </div>

        {violations.length > 0 && (
          <div style={{ padding: 14, marginBottom: 14, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Icon name="alert" size={18} style={{ color: '#dc2626' }}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: '#7f1d1d' }}>Out of statistical control — Western Electric Rule 1</div>
              <div style={{ fontSize: 11.5, color: '#9f1239' }}>
                {violations.length} subgroup(s) outside ±3σ. NCR auto-drafted, line supervisor notified.
                Trend rule WE-2 also active: 4 of last 5 points below center line.
              </div>
            </div>
            <button className="k-btn k-btn-secondary k-btn-sm" onClick={() => kToast('NCR draft opened — pre-filled from SPC violation')}>View NCR draft</button>
            <button className="k-btn k-btn-primary k-btn-sm" onClick={() => kToast('Investigation started — assigned to you')}>Investigate</button>
          </div>
        )}

        <Card title="X̄ chart (subgroup means)">
          <SPCChart
            data={xbar}
            cl={xbarBar}
            ucl={UCL_x}
            lcl={LCL_x}
            usl={7.0}
            lsl={5.0}
            yLabel="mm"
            color="#2563eb"
            violations={violations}
          />
          <div style={{ display: 'flex', gap: 18, fontSize: 11, marginTop: 10, color: 'var(--text-muted)' }}>
            <span><strong>X̄̄ </strong><span className="mono">{xbarBar.toFixed(3)}</span></span>
            <span><strong>UCL </strong><span className="mono">{UCL_x.toFixed(3)}</span></span>
            <span><strong>LCL </strong><span className="mono">{LCL_x.toFixed(3)}</span></span>
            <span><strong>USL </strong><span className="mono">7.000</span></span>
            <span><strong>LSL </strong><span className="mono">5.000</span></span>
            <span style={{ marginLeft: 'auto' }}><strong>Cp </strong><span className="mono">1.28</span></span>
            <span><strong>Cpk </strong><span className="mono" style={{ color: '#f59e0b' }}>0.84</span></span>
            <span><strong>Ppk </strong><span className="mono" style={{ color: '#dc2626' }}>0.72</span></span>
          </div>
        </Card>

        <Card title="R chart (subgroup ranges)">
          <SPCChart
            data={ranges}
            cl={rBar}
            ucl={UCL_r}
            lcl={LCL_r}
            yLabel="mm"
            color="#0d9488"
            violations={[]}
          />
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card title="Western Electric runs rules" desc="Standard SPC pattern detection">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { r: 'WE-1', n: '1 pt > ±3σ', active: true, count: 1 },
                { r: 'WE-2', n: '2 of 3 consecutive pts > ±2σ', active: false, count: 0 },
                { r: 'WE-3', n: '4 of 5 consecutive pts > ±1σ', active: true, count: 1, recent: true },
                { r: 'WE-4', n: '8 consecutive pts on same side of center', active: false, count: 0 },
                { r: 'Nelson-5', n: '6 consecutive pts trending', active: true, count: 1, recent: true },
                { r: 'Nelson-7', n: '15 consecutive pts within ±1σ (over-control)', active: false, count: 0 },
              ].map(r => (
                <div key={r.r} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, background: r.active ? (r.recent ? 'rgba(245,158,11,0.06)' : 'rgba(220,38,38,0.06)') : 'var(--bg-subtle)', borderRadius: 4, borderLeft: r.active ? `3px solid ${r.recent ? '#f59e0b' : '#dc2626'}` : '3px solid transparent' }}>
                  <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: r.active ? (r.recent ? '#92400e' : '#b91c1c') : 'var(--text-muted)' }}>{r.r}</span>
                  <span style={{ flex: 1, fontSize: 12 }}>{r.n}</span>
                  {r.active && <span className="k-chip" style={{ background: r.recent ? 'rgba(245,158,11,0.15)' : 'rgba(220,38,38,0.15)', color: r.recent ? '#92400e' : '#b91c1c' }}>{r.count} active</span>}
                </div>
              ))}
            </div>
          </Card>

          <Card title="Process capability">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 14 }}>
              <Field k="Cp" v="1.28 (target ≥ 1.33)"/>
              <Field k="Cpk" v="0.84"/>
              <Field k="Pp" v="1.04"/>
              <Field k="Ppk" v="0.72"/>
              <Field k="DPMO (est.)" v="3,840"/>
              <Field k="Sigma level" v="4.17σ"/>
            </div>
            <div style={{ padding: 10, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6, fontSize: 11.5 }}>
              <strong style={{ color: '#92400e' }}>Cpk below customer minimum (≥ 1.00).</strong>
              <span style={{ color: 'var(--text-muted)' }}> Customer Volvo specifies Cpk ≥ 1.33 for safety-critical features. Action plan from FMEA #1 in flight.</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SPCChart({ data, cl, ucl, lcl, usl, lsl, yLabel, color, violations = [] }) {
  const w = 760, h = 200, pad = { l: 50, r: 16, t: 12, b: 24 };
  const allVals = [...data, ucl, lcl, usl || ucl, lsl || lcl, cl];
  const min = Math.min(...allVals.filter(x => x != null));
  const max = Math.max(...allVals.filter(x => x != null));
  const yRange = max - min;
  const yPad = yRange * 0.1;
  const yMin = min - yPad, yMax = max + yPad;
  const xStep = (w - pad.l - pad.r) / (data.length - 1);
  const yScale = v => h - pad.b - ((v - yMin) / (yMax - yMin)) * (h - pad.t - pad.b);

  const pts = data.map((v, i) => `${pad.l + i * xStep},${yScale(v)}`).join(' ');

  return (
    <div style={{ width: '100%', overflow: 'auto' }}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* spec lines USL / LSL */}
        {usl != null && <>
          <line x1={pad.l} x2={w - pad.r} y1={yScale(usl)} y2={yScale(usl)} stroke="#dc2626" strokeWidth="1" strokeDasharray="6 3"/>
          <text x={w - pad.r - 2} y={yScale(usl) - 3} fontSize="9" fill="#dc2626" textAnchor="end" fontWeight="700">USL</text>
        </>}
        {lsl != null && <>
          <line x1={pad.l} x2={w - pad.r} y1={yScale(lsl)} y2={yScale(lsl)} stroke="#dc2626" strokeWidth="1" strokeDasharray="6 3"/>
          <text x={w - pad.r - 2} y={yScale(lsl) - 3} fontSize="9" fill="#dc2626" textAnchor="end" fontWeight="700">LSL</text>
        </>}
        {/* UCL / LCL */}
        <line x1={pad.l} x2={w - pad.r} y1={yScale(ucl)} y2={yScale(ucl)} stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="3 3"/>
        <text x={w - pad.r - 2} y={yScale(ucl) - 3} fontSize="9" fill="#f59e0b" textAnchor="end" fontWeight="700">UCL</text>
        <line x1={pad.l} x2={w - pad.r} y1={yScale(lcl)} y2={yScale(lcl)} stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="3 3"/>
        <text x={w - pad.r - 2} y={yScale(lcl) - 3} fontSize="9" fill="#f59e0b" textAnchor="end" fontWeight="700">LCL</text>
        {/* CL */}
        <line x1={pad.l} x2={w - pad.r} y1={yScale(cl)} y2={yScale(cl)} stroke="#475569" strokeWidth="1"/>
        <text x={w - pad.r - 2} y={yScale(cl) - 3} fontSize="9" fill="#475569" textAnchor="end" fontWeight="700">CL {cl.toFixed(2)}</text>
        {/* y axis ticks */}
        {[yMin, (yMin+yMax)/2, yMax].map((v, i) => (
          <text key={i} x={pad.l - 6} y={yScale(v) + 3} fontSize="9" fill="#64748b" textAnchor="end">{v.toFixed(2)}</text>
        ))}
        {/* x axis */}
        <line x1={pad.l} x2={w - pad.r} y1={h - pad.b} y2={h - pad.b} stroke="#cbd5e1"/>
        {data.map((_, i) => i % 5 === 0 && (
          <text key={i} x={pad.l + i * xStep} y={h - pad.b + 14} fontSize="9" fill="#64748b" textAnchor="middle">{i + 1}</text>
        ))}
        {/* line */}
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"/>
        {/* points */}
        {data.map((v, i) => (
          <circle key={i} cx={pad.l + i * xStep} cy={yScale(v)} r={violations.includes(i) ? 5 : 3}
            fill={violations.includes(i) ? '#dc2626' : color}
            stroke={violations.includes(i) ? 'white' : 'none'} strokeWidth="2"/>
        ))}
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MSA / Gauge R&R
// ─────────────────────────────────────────────────────────────
function MSAStudy({ setRoute }) {
  return (
    <div>
      <PageHeader
        title="MSA / Gauge R&R"
        description="Variable & attribute measurement system analysis. AIAG 4th Ed methods, % study variation."
        actions={
          <>
            <button className="k-btn k-btn-ghost" onClick={() => kToast('Export started — gauge-rr-aiag-report.pdf')}><Icon name="download" size={13}/> AIAG report</button>
            <button className="k-btn k-btn-primary" onClick={() => kToast('New Gauge R&R study — pick instrument & operators')}><Icon name="plus" size={13}/> New study</button>
          </>
        }
      />
      <div style={{ padding: '20px 28px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
          {[
            { l: 'Total GR&R %', v: '14.2%', s: 'Acceptable (< 30%)', c: '#16a34a' },
            { l: 'Repeatability (EV)', v: '8.4%', s: 'Equipment variation', c: '#2563eb' },
            { l: 'Reproducibility (AV)', v: '11.6%', s: 'Appraiser variation', c: '#7c3aed' },
            { l: 'ndc', v: '8', s: 'Number distinct categories (≥ 5)', c: '#0d9488' },
          ].map(k => (
            <div key={k.l} className="k-surface" style={{ padding: 14 }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{k.l}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: k.c }}>{k.v}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{k.s}</div>
            </div>
          ))}
        </div>

        <Card title="Active study — Hub bore diameter (CMM #CAL-002)" desc="3 appraisers · 10 parts · 3 trials · AIAG long-form">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <div>
              <div className="k-overline" style={{ marginBottom: 8 }}>Variance components</div>
              <table style={{ width: '100%', fontSize: 12 }}>
                <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 0', fontSize: 10, color: 'var(--text-muted)' }}>Source</th>
                  <th style={{ textAlign: 'right', padding: '6px 0', fontSize: 10, color: 'var(--text-muted)' }}>StdDev</th>
                  <th style={{ textAlign: 'right', padding: '6px 0', fontSize: 10, color: 'var(--text-muted)' }}>% StudyVar</th>
                  <th style={{ textAlign: 'right', padding: '6px 0', fontSize: 10, color: 'var(--text-muted)' }}>% Tolerance</th>
                </tr></thead>
                <tbody>
                  {[
                    { s: 'Total Gauge R&R', sd: 0.0124, sv: 14.2, tol: 12.4, fmt: true },
                    { s: '  Repeatability (EV)', sd: 0.0084, sv: 8.4, tol: 7.4 },
                    { s: '  Reproducibility (AV)', sd: 0.0091, sv: 11.6, tol: 10.2 },
                    { s: '    Appraiser', sd: 0.0091, sv: 11.6, tol: 10.2 },
                    { s: '    Appraiser × Part', sd: 0.0000, sv: 0.0, tol: 0.0 },
                    { s: 'Part-to-Part', sd: 0.0864, sv: 98.0, tol: 86.4 },
                    { s: 'Total Variation', sd: 0.0872, sv: 100.0, tol: 87.2, fmt: true },
                  ].map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px 0', fontWeight: r.fmt ? 700 : 400, whiteSpace: 'pre' }}>{r.s}</td>
                      <td className="mono" style={{ padding: '6px 0', textAlign: 'right' }}>{r.sd.toFixed(4)}</td>
                      <td className="mono" style={{ padding: '6px 0', textAlign: 'right' }}>{r.sv.toFixed(1)}</td>
                      <td className="mono" style={{ padding: '6px 0', textAlign: 'right' }}>{r.tol.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 12, padding: 12, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 6, fontSize: 12 }}>
                <strong style={{ color: 'var(--success-700)' }}>✓ Acceptable</strong> — Total GR&R 14.2% is below 30% acceptable threshold per AIAG. NDC = 8 (≥ 5 required). System adequate for product control.
              </div>
            </div>

            <div>
              <div className="k-overline" style={{ marginBottom: 8 }}>Variation by source</div>
              <svg viewBox="0 0 360 200" style={{ width: '100%', height: 'auto' }}>
                {[
                  { l: 'GR&R', v: 14.2, c: '#7c3aed' },
                  { l: 'EV', v: 8.4, c: '#2563eb' },
                  { l: 'AV', v: 11.6, c: '#0d9488' },
                  { l: 'Part-Part', v: 98.0, c: '#16a34a' },
                  { l: '% Tol', v: 12.4, c: '#f59e0b' },
                ].map((b, i) => (
                  <g key={i}>
                    <rect x={20 + i * 70} y={200 - b.v * 1.8 - 30} width="40" height={b.v * 1.8} fill={b.c} rx="2"/>
                    <text x={40 + i * 70} y={200 - b.v * 1.8 - 36} fontSize="11" fill={b.c} textAnchor="middle" fontWeight="700">{b.v.toFixed(1)}</text>
                    <text x={40 + i * 70} y={195} fontSize="10" fill="#64748b" textAnchor="middle">{b.l}</text>
                  </g>
                ))}
                <line x1="10" y1="170" x2="350" y2="170" stroke="#cbd5e1"/>
                <line x1="10" y1={200 - 30 * 1.8 - 30} x2="350" y2={200 - 30 * 1.8 - 30} stroke="#dc2626" strokeDasharray="3 3"/>
                <text x="350" y={200 - 30 * 1.8 - 33} fontSize="9" fill="#dc2626" textAnchor="end" fontWeight="700">30% threshold</text>
              </svg>
            </div>
          </div>
        </Card>

        <Card title="Recent MSA studies">
          <table className="k-table" style={{ width: '100%' }}>
            <thead><tr><th>Study</th><th>Gauge</th><th>Method</th><th>Date</th><th>GR&R %</th><th>ndc</th><th>Verdict</th></tr></thead>
            <tbody>
              {[
                { s: 'Hub bore diameter', g: 'Zeiss Contura', m: 'Crossed (X-bar/R)', d: '2026-05-12', grr: 14.2, ndc: 8, verdict: 'pass' },
                { s: 'Weld penetration mm', g: 'Mitutoyo CMM 776', m: 'Crossed', d: '2026-04-28', grr: 22.4, ndc: 6, verdict: 'marginal' },
                { s: 'Surface finish Ra', g: 'Mahr XR-20', m: 'Nested', d: '2026-04-14', grr: 18.2, ndc: 7, verdict: 'pass' },
                { s: 'Visual inspection — porosity', g: 'Human appraiser', m: 'Attribute (kappa)', d: '2026-04-08', grr: null, ndc: null, verdict: 'pass', kappa: 0.84 },
                { s: 'Torque audit', g: 'Norbar 3AR', m: 'Crossed', d: '2026-03-22', grr: 32.4, ndc: 4, verdict: 'fail' },
              ].map((r, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 12.5, fontWeight: 600 }}>{r.s}</td>
                  <td style={{ fontSize: 12 }}>{r.g}</td>
                  <td style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{r.m}</td>
                  <td className="mono" style={{ fontSize: 11.5 }}>{r.d}</td>
                  <td className="mono">{r.grr != null ? `${r.grr.toFixed(1)}%` : `κ=${r.kappa}`}</td>
                  <td className="mono">{r.ndc ?? '—'}</td>
                  <td>
                    <span className="k-chip" style={{
                      background: r.verdict === 'pass' ? 'var(--success-100)' : r.verdict === 'marginal' ? 'rgba(245,158,11,0.12)' : 'rgba(220,38,38,0.10)',
                      color: r.verdict === 'pass' ? 'var(--success-700)' : r.verdict === 'marginal' ? '#92400e' : '#b91c1c',
                    }}>{r.verdict}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

Object.assign(window, { RiskRegister, FMEAWorkbench, SPCCharts, MSAStudy });
