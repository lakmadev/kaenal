// Kaenal — QMS Modules
// Training & competency, Calibration management,
// Customer complaints intake, ECN (engineering change requests)

// ─────────────────────────────────────────────────────────────
// TRAINING & COMPETENCY MATRIX
// ─────────────────────────────────────────────────────────────
const COMPETENCIES = [
  { id: 'iatf', name: 'IATF 16949 awareness', mandatory: true, validMonths: 24 },
  { id: 'fmea', name: 'AIAG/VDA FMEA', mandatory: true, validMonths: 36 },
  { id: 'spc', name: 'SPC fundamentals', mandatory: true, validMonths: 24 },
  { id: 'msa', name: 'MSA / Gauge R&R', mandatory: false, validMonths: 36 },
  { id: 'cmm', name: 'CMM operation — Hexagon', mandatory: false, validMonths: 12 },
  { id: 'weld', name: 'Welding inspector — AWS CWI', mandatory: false, validMonths: 36 },
  { id: 'audit', name: 'Internal auditor — ISO 19011', mandatory: false, validMonths: 36 },
  { id: '8d', name: '8D problem solving', mandatory: true, validMonths: 36 },
  { id: 'safety', name: 'Plant safety — Level A', mandatory: true, validMonths: 12 },
];

const TRAINEES = [
  { u: 'u1', role: 'Quality Manager', status: ['ok','ok','ok','ok','—','—','ok','ok','ok'] },
  { u: 'u2', role: 'Quality Engineer', status: ['ok','ok','ok','ok','—','—','ok','ok','warn'] },
  { u: 'u3', role: 'CMM Specialist', status: ['ok','—','ok','ok','ok','—','—','ok','ok'] },
  { u: 'u4', role: 'QA Engineer', status: ['ok','ok','ok','warn','—','—','ok','ok','ok'] },
  { u: 'u5', role: 'Line Supervisor', status: ['ok','ok','warn','—','—','—','—','ok','ok'] },
  { u: 'u6', role: 'Inspector', status: ['ok','—','ok','—','—','—','—','warn','ok'] },
  { u: 'u7', role: 'Inspector', status: ['warn','—','—','—','—','—','—','—','warn'] },
];

function TrainingMatrix({ setRoute }) {
  return (
    <div>
      <PageHeader
        title="Training & competency"
        description="Skill matrix, certifications, and expirations across 412 members. Auto-link to inspection / NCR signatures."
        actions={
          <>
            <button className="k-btn k-btn-ghost" onClick={() => kToast('Export started — skill-gap-report.pdf')}><Icon name="download" size={13}/> Skill gap report</button>
            <button className="k-btn k-btn-primary" onClick={() => kToast('Training assignment drafted — pick employees & course')}><Icon name="plus" size={13}/> Assign training</button>
          </>
        }
      />
      <div style={{ padding: '20px 28px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
          {[
            { l: 'Members tracked', v: '412', s: 'across 7 plants', c: '#2563eb' },
            { l: 'Coverage', v: '88%', s: 'of mandatory certs', c: '#16a34a' },
            { l: 'Expiring < 30 days', v: '24', s: '4 critical (welding)', c: '#f59e0b' },
            { l: 'Overdue', v: '6', s: 'blocked from sign-off', c: '#dc2626' },
          ].map(k => (
            <div key={k.l} className="k-surface" style={{ padding: 14 }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{k.l}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: k.c }}>{k.v}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{k.s}</div>
            </div>
          ))}
        </div>

        <Card title="Competency matrix" desc="Rows: members. Columns: competencies. Click a cell to see history.">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <input className="k-input" placeholder="Filter by name or role…" style={{ flex: 1, maxWidth: 280, height: 30 }}/>
            <Segmented size="sm" value="all" onChange={() => {}} options={[
              { value: 'all', label: 'All' }, { value: 'mandatory', label: 'Mandatory only' }, { value: 'gaps', label: 'Gaps' },
            ]}/>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
              <Legend color="#22c55e" l="Certified"/><Legend color="#f59e0b" l="Expiring"/><Legend color="#dc2626" l="Overdue"/><Legend color="#cbd5e1" l="N/A"/>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, background: 'var(--surface)', padding: '8px 10px', borderBottom: '1px solid var(--border)', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', minWidth: 200, zIndex: 1 }}>Member</th>
                  {COMPETENCIES.map(c => (
                    <th key={c.id} style={{
                      padding: '8px 6px', borderBottom: '1px solid var(--border)',
                      fontSize: 10, fontWeight: 600,
                      writingMode: 'vertical-rl', transform: 'rotate(180deg)',
                      height: 140, verticalAlign: 'bottom',
                      color: 'var(--text)',
                    }}>
                      {c.mandatory && <span style={{ color: '#dc2626' }}>*</span>}
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TRAINEES.map(t => {
                  const u = userById(t.u);
                  return (
                    <tr key={t.u}>
                      <td style={{ position: 'sticky', left: 0, background: 'var(--surface)', padding: '8px 10px', borderBottom: '1px solid var(--border)', zIndex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Avatar user={t.u} size={26}/>
                          <div>
                            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{u?.name}</div>
                            <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{t.role}</div>
                          </div>
                        </div>
                      </td>
                      {t.status.map((s, i) => (
                        <td key={i} style={{ padding: '4px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                          {s === 'ok' && <div style={{ width: 24, height: 24, borderRadius: 4, background: '#22c55e', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}><Icon name="check" size={11} stroke={3}/></div>}
                          {s === 'warn' && <div style={{ width: 24, height: 24, borderRadius: 4, background: '#f59e0b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10, fontWeight: 700 }}>!</div>}
                          {s === 'fail' && <div style={{ width: 24, height: 24, borderRadius: 4, background: '#dc2626', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}><Icon name="x" size={11} stroke={3}/></div>}
                          {s === '—' && <div style={{ width: 24, height: 24, borderRadius: 4, background: 'var(--bg-subtle)', display: 'inline-block' }}/>}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          <Card title="Expiring & overdue" desc="Auto-block actions when certifications lapse">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { u: 'u7', cert: 'Plant safety — Level A', daysLeft: -4, blocking: true },
                { u: 'u6', cert: '8D problem solving', daysLeft: -12, blocking: true },
                { u: 'u5', cert: 'SPC fundamentals', daysLeft: 8, blocking: false },
                { u: 'u4', cert: 'AIAG/VDA FMEA', daysLeft: 14, blocking: false },
                { u: 'u2', cert: 'Plant safety — Level A', daysLeft: 22, blocking: false },
              ].map((r, i) => {
                const u = userById(r.u);
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: r.blocking ? 'rgba(220,38,38,0.06)' : 'var(--bg-subtle)', borderRadius: 6, borderLeft: r.blocking ? '3px solid #dc2626' : '3px solid #f59e0b' }}>
                    <Avatar user={r.u} size={26}/>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600 }}>{u?.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.cert}</div>
                    </div>
                    {r.blocking
                      ? <span className="k-chip" style={{ background: 'rgba(220,38,38,0.15)', color: '#b91c1c' }}>Overdue {Math.abs(r.daysLeft)}d · BLOCKED</span>
                      : <span className="k-chip" style={{ background: 'rgba(245,158,11,0.12)', color: '#92400e' }}>Expires in {r.daysLeft}d</span>}
                    <button className="k-btn k-btn-secondary k-btn-sm" onClick={() => kToast(`Refresher scheduled for ${u?.name || 'employee'} — invite sent`)}>Schedule</button>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="Linked e-learning">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { p: 'Cornerstone', n: 'Connected · 87 courses synced', s: 'ok' },
                { p: 'SAP SuccessFactors', n: 'Connected · LMS roster bridge', s: 'ok' },
                { p: 'Litmos', n: 'Available', s: 'avail' },
                { p: 'Custom SCORM upload', n: 'Drag .zip / .scorm', s: 'avail' },
              ].map((r, i) => (
                <div key={i} style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name="package" size={14}/>
                    <strong style={{ fontSize: 12.5, flex: 1 }}>{r.p}</strong>
                    {r.s === 'ok' ? <span className="k-chip" style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}>Connected</span> : <button className="k-btn k-btn-secondary k-btn-sm" onClick={() => kToast(`Connecting ${r.p} — authorize in the popup`)}>Connect</button>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{r.n}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, l }) {
  return <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: color }}/>{l}</span>;
}

// ─────────────────────────────────────────────────────────────
// CALIBRATION MANAGEMENT
// ─────────────────────────────────────────────────────────────
const INSTRUMENTS = [
  { id: 'CAL-001', name: 'Mitutoyo CMM Crysta-Apex S 776', type: 'CMM', area: 'Pune-1 / Metrology', last: 'Apr 12, 2026', next: 'Oct 12, 2026', method: 'Internal — ISO 10360', status: 'ok', tolerance: '±1.7μm' },
  { id: 'CAL-002', name: 'Zeiss Contura G2 7/10/6', type: 'CMM', area: 'Chennai-2 / Metrology', last: 'Mar 18, 2026', next: 'Sep 18, 2026', method: 'Internal — ISO 10360', status: 'ok', tolerance: '±1.5μm' },
  { id: 'CAL-014', name: 'Renishaw Equator 300 (gauge)', type: 'Comparator', area: 'Pune-1 / Line 4', last: 'Feb 02, 2026', next: 'Aug 02, 2026', method: 'Internal — manufacturer std', status: 'ok', tolerance: '±2.0μm' },
  { id: 'CAL-021', name: 'Mahr Surf XR-20 (roughness)', type: 'Profilometer', area: 'Pune-1 / Lab', last: 'Jan 20, 2026', next: 'Jul 20, 2026', method: 'External — NABL accredited', status: 'ok', tolerance: '±0.02μm Ra' },
  { id: 'CAL-035', name: 'Olympus 38DL Plus (ultrasonic)', type: 'NDT', area: 'Detroit Aluminum', last: 'Dec 12, 2025', next: 'Jun 12, 2026', method: 'External — A2LA', status: 'warn', tolerance: '±0.01mm', daysUntil: 24 },
  { id: 'CAL-042', name: 'Mitutoyo Digimatic Caliper 500-153-30', type: 'Caliper', area: 'Pune-1 / Line 2', last: 'Nov 04, 2025', next: 'May 04, 2026', method: 'Internal — gage block', status: 'overdue', tolerance: '±0.02mm', daysUntil: -15 },
  { id: 'CAL-054', name: 'Norbar 3AR torque wrench', type: 'Torque', area: 'Pune-1 / Assembly', last: 'Apr 02, 2026', next: 'Oct 02, 2026', method: 'External — UKAS', status: 'ok', tolerance: '±4% reading' },
  { id: 'CAL-067', name: 'Hexagon AT960 laser tracker', type: 'Laser tracker', area: 'Pune-1 / Inspection', last: 'Mar 28, 2026', next: 'Mar 28, 2027', method: 'External — Hexagon AS', status: 'ok', tolerance: '15μm + 6μm/m' },
];

function CalibrationManagement({ setRoute }) {
  const [selected, setSelected] = React.useState('CAL-035');
  const inst = INSTRUMENTS.find(i => i.id === selected) || INSTRUMENTS[0];

  return (
    <div>
      <PageHeader
        title="Calibration management"
        description="Instruments, due dates, calibration history. Auto-block measurement use when calibration lapses."
        actions={
          <>
            <button className="k-btn k-btn-ghost" onClick={() => kToast('Export started — calibration-audit-pack.pdf')}><Icon name="download" size={13}/> Audit pack</button>
            <button className="k-btn k-btn-primary" onClick={() => kToast('New instrument form opened — enter asset tag to begin')}><Icon name="plus" size={13}/> Add instrument</button>
          </>
        }
      />
      <div style={{ padding: '20px 28px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
          {[
            { l: 'Instruments tracked', v: '184', s: 'across 7 plants', c: '#2563eb' },
            { l: 'Due < 30 days', v: '12', s: 'schedule now', c: '#f59e0b' },
            { l: 'Overdue', v: '3', s: 'measurements blocked', c: '#dc2626' },
            { l: 'Out-of-tol findings (YTD)', v: '4', s: '2 led to NCR', c: '#7c3aed' },
          ].map(k => (
            <div key={k.l} className="k-surface" style={{ padding: 14 }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{k.l}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: k.c }}>{k.v}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{k.s}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
          <Card title="Instrument register">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <input className="k-input" placeholder="Search by ID, name, area…" style={{ flex: 1, height: 30 }}/>
              <Segmented size="sm" value="all" onChange={() => {}} options={[
                { value: 'all', label: 'All' }, { value: 'due', label: 'Due soon' }, { value: 'overdue', label: 'Overdue' },
              ]}/>
            </div>
            <table className="k-table" style={{ width: '100%' }}>
              <thead><tr><th>ID</th><th>Instrument</th><th>Area</th><th>Next due</th><th>Status</th></tr></thead>
              <tbody>
                {INSTRUMENTS.map(i => (
                  <tr key={i.id} onClick={() => setSelected(i.id)} style={{ cursor: 'pointer', background: selected === i.id ? 'var(--accent-soft)' : '' }}>
                    <td className="mono" style={{ fontSize: 11.5 }}>{i.id}</td>
                    <td>
                      <div style={{ fontSize: 12.5, fontWeight: 600 }}>{i.name}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{i.type} · tolerance {i.tolerance}</div>
                    </td>
                    <td style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{i.area}</td>
                    <td style={{ fontSize: 11.5 }} className="mono">{i.next}</td>
                    <td>
                      {i.status === 'ok' && <span className="k-chip" style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}>OK</span>}
                      {i.status === 'warn' && <span className="k-chip" style={{ background: 'rgba(245,158,11,0.12)', color: '#92400e' }}>{i.daysUntil}d</span>}
                      {i.status === 'overdue' && <span className="k-chip" style={{ background: 'rgba(220,38,38,0.10)', color: '#b91c1c' }}>Overdue {Math.abs(i.daysUntil)}d</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title={inst.id} desc={inst.name}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {inst.status === 'overdue' && (
                <div style={{ padding: 12, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 6, display: 'flex', gap: 10 }}>
                  <Icon name="alert" size={16} style={{ color: '#dc2626' }}/>
                  <div style={{ fontSize: 12, color: '#b91c1c' }}>
                    <strong>Out of calibration — overdue {Math.abs(inst.daysUntil)} days.</strong>
                    <div style={{ marginTop: 4, color: '#7f1d1d' }}>Measurements with this instrument are blocked at inspection sign-off. All inspections recorded with it since {inst.last} require traceability review.</div>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                <KvField k="Type" v={inst.type}/>
                <KvField k="Area" v={inst.area}/>
                <KvField k="Method" v={inst.method}/>
                <KvField k="Tolerance" v={inst.tolerance}/>
                <KvField k="Last calibrated" v={inst.last}/>
                <KvField k="Next due" v={inst.next}/>
              </div>

              <div className="k-overline" style={{ marginTop: 8 }}>History (last 5)</div>
              <table style={{ width: '100%', fontSize: 12 }}>
                <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 0', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '6px 0', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>By</th>
                  <th style={{ textAlign: 'left', padding: '6px 0', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Result</th>
                  <th style={{ textAlign: 'left', padding: '6px 0', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cert</th>
                </tr></thead>
                <tbody>
                  {[
                    { d: '2025-12-12', by: 'A2LA Cal Labs', r: 'Pass — as found', c: 'CRT-9842' },
                    { d: '2025-06-08', by: 'A2LA Cal Labs', r: 'Pass — as found', c: 'CRT-7421' },
                    { d: '2024-12-04', by: 'A2LA Cal Labs', r: 'Adjusted, pass', c: 'CRT-5114', warn: true },
                    { d: '2024-06-02', by: 'A2LA Cal Labs', r: 'Pass — as found', c: 'CRT-3284' },
                  ].map((h, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="mono" style={{ padding: '7px 0' }}>{h.d}</td>
                      <td style={{ padding: '7px 0' }}>{h.by}</td>
                      <td style={{ padding: '7px 0', color: h.warn ? '#f59e0b' : 'var(--text)' }}>{h.r}</td>
                      <td className="mono" style={{ padding: '7px 0', color: 'var(--accent)' }}>{h.c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button className="k-btn k-btn-primary" onClick={() => kToast('Calibration recorded — next due date advanced')}><Icon name="check" size={12}/> Record calibration</button>
                <button className="k-btn k-btn-secondary" onClick={() => kToast('Choose a certificate PDF to attach')}><Icon name="upload" size={12}/> Upload cert</button>
                <button className="k-btn k-btn-secondary" style={{ marginLeft: 'auto' }} onClick={() => kToast('Instrument options — history, retire, transfer')}><Icon name="more" size={12}/></button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function KvField({ k, v }) {
  return (
    <div style={{ padding: 8, background: 'var(--bg-subtle)', borderRadius: 4 }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{k}</div>
      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{v}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CUSTOMER COMPLAINTS INTAKE
// ─────────────────────────────────────────────────────────────
const COMPLAINTS = [
  { id: 'COM-2026-0084', customer: 'AB Volvo Group', contact: 'Magnus Eriksson · Quality Manager', received: '2 hours ago', via: 'Customer portal', severity: 'critical', status: 'triage', subject: 'Field failure — wheel hub bearing on T-9384', batch: 'PA-VLV-3041', linked: null, color: '#003c64' },
  { id: 'COM-2026-0083', customer: 'Daimler Truck', contact: 'Klaus Müller', received: '6 hours ago', via: 'Email parsed', severity: 'high', status: 'investigation', subject: 'Dimensional variation on bracket DTR-201', batch: 'PA-DTR-1284', linked: 'NCR-2026-0140', color: '#1c1c1c' },
  { id: 'COM-2026-0082', customer: 'Robert Bosch', contact: 'Markus Schwarz', received: 'Yesterday', via: 'Web form', severity: 'medium', status: '8d', subject: 'Surface finish below Ra spec on housing BHS-12', batch: 'PA-BOS-8420', linked: '8D-2026-0015', color: '#cc0000' },
  { id: 'COM-2026-0081', customer: 'BMW', contact: 'Anja Weber', received: '3 days ago', via: 'EDI', severity: 'high', status: 'capa', subject: 'Recurring porosity on weld joint W-4', batch: 'multiple', linked: 'CAPA-2026-0042', color: '#0066b1' },
  { id: 'COM-2026-0080', customer: 'Volkswagen Group', contact: 'Lena Hoffmann', received: '1 week ago', via: 'Phone (logged)', severity: 'low', status: 'closed', subject: 'Wrong label revision on packaging', batch: 'PA-VWA-9012', linked: 'NCR-2026-0138', color: '#0a8541' },
];

function CustomerComplaints({ setRoute }) {
  const [tab, setTab] = React.useState('all');
  const [intake, setIntake] = React.useState(false);
  const tabs = [
    { id: 'all', l: 'All (84 open)' },
    { id: 'critical', l: 'Critical (4)' },
    { id: 'no-link', l: 'Not linked to NCR (7)' },
    { id: 'mine', l: 'Mine (12)' },
  ];

  return (
    <div>
      <PageHeader
        title="Customer complaints"
        description="External-facing intake form + email + EDI. Triage, auto-link to NCR / 8D / CAPA, full traceability."
        actions={
          <>
            <button className="k-btn k-btn-ghost" onClick={() => kToast('Public intake form link copied — kaenal.app/intake/precision-auto')}><Icon name="external" size={13}/> Public intake form</button>
            <button onClick={() => setIntake(true)} className="k-btn k-btn-primary"><Icon name="plus" size={13}/> Log complaint</button>
          </>
        }
      />
      <div style={{ padding: '20px 28px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 18 }}>
          {[
            { l: 'Open', v: 84, c: '#2563eb' },
            { l: 'Critical', v: 4, c: '#dc2626' },
            { l: '< 24h response', v: 92, c: '#16a34a', suffix: '%' },
            { l: 'Avg time to close', v: 18, c: '#7c3aed', suffix: 'd' },
            { l: 'Avg cost / complaint', v: 4280, c: '#f59e0b', prefix: '$' },
          ].map(k => (
            <div key={k.l} className="k-surface" style={{ padding: 12 }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{k.l}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: k.c }}>{k.prefix || ''}{k.v.toLocaleString()}{k.suffix || ''}</div>
            </div>
          ))}
        </div>

        <div className="k-tabs" style={{ marginBottom: 14 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`k-tab ${tab === t.id ? 'active' : ''}`}>{t.l}</button>
          ))}
        </div>

        <div className="k-surface" style={{ overflow: 'hidden' }}>
          <table className="k-table" style={{ width: '100%' }}>
            <thead><tr>
              <th>ID</th><th>Customer</th><th>Subject</th><th>Severity</th><th>Status</th><th>Linked</th><th>Received</th>
            </tr></thead>
            <tbody>
              {COMPLAINTS.map(c => (
                <tr key={c.id} style={{ cursor: 'pointer' }}>
                  <td className="mono" style={{ fontSize: 11.5 }}>{c.id}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 26, height: 26, borderRadius: 4, background: c.color, color: 'white', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>{c.customer.split(' ')[0].slice(0, 3).toUpperCase()}</div>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{c.customer}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{c.contact} · via {c.via}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: 12.5 }}>{c.subject}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Batch: {c.batch}</div>
                  </td>
                  <td>
                    <span className="k-chip" style={{
                      background: c.severity === 'critical' ? 'rgba(220,38,38,0.10)' : c.severity === 'high' ? 'rgba(234,88,12,0.10)' : c.severity === 'medium' ? 'rgba(245,158,11,0.12)' : 'rgba(100,116,139,0.12)',
                      color: c.severity === 'critical' ? '#b91c1c' : c.severity === 'high' ? '#9a3412' : c.severity === 'medium' ? '#92400e' : 'var(--text-muted)',
                    }}>{c.severity}</span>
                  </td>
                  <td>
                    <span className="k-chip" style={{
                      background: c.status === 'closed' ? 'var(--success-100)' : 'var(--bg-subtle)',
                      color: c.status === 'closed' ? 'var(--success-700)' : 'var(--text)',
                    }}>{c.status}</span>
                  </td>
                  <td>
                    {c.linked
                      ? <span className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>→ {c.linked}</span>
                      : <button className="k-btn k-btn-secondary k-btn-sm" style={{ height: 22 }} onClick={() => kToast('NCR drafted from complaint — review & submit')}>Link / Create NCR</button>}
                  </td>
                  <td style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{c.received}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          <Card title="Intake channels">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { c: 'Public web form', url: 'kaenal.app/complaints/precision-auto', volume: '47 / mo', ok: true },
                { c: 'Customer portal (Volvo, Bosch, BMW)', url: 'Authenticated EDI', volume: '24 / mo', ok: true },
                { c: 'Email parser', url: 'complaints@precision-auto.com', volume: '18 / mo', ok: true },
                { c: 'Phone (logged manually)', url: '+91 20 4567 8900', volume: '4 / mo', ok: true },
                { c: 'Customer extranet API', url: 'oauth-connected', volume: '12 / mo', ok: true },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
                  <Icon name="send" size={14} style={{ color: 'var(--accent)' }}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{r.c}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{r.url}</div>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.volume}</span>
                  <span className="k-chip" style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}>Active</span>
                </div>
              ))}
            </div>
          </Card>
          <Card title="SLA matrix">
            <table style={{ width: '100%', fontSize: 12.5 }}>
              <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '6px 0', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Severity</th>
                <th style={{ textAlign: 'left', padding: '6px 0', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Acknowledge</th>
                <th style={{ textAlign: 'left', padding: '6px 0', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>8D required</th>
                <th style={{ textAlign: 'left', padding: '6px 0', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Close target</th>
              </tr></thead>
              <tbody>
                {[
                  { s: 'Critical (safety, field failure)', a: '< 1 hr', d: 'Auto-create within 4 hr', c: '14 days' },
                  { s: 'High (line stop at customer)', a: '< 4 hr', d: 'Within 24 hr', c: '21 days' },
                  { s: 'Medium', a: '< 24 hr', d: 'Optional', c: '45 days' },
                  { s: 'Low', a: '< 48 hr', d: 'Not required', c: '90 days' },
                ].map(r => (
                  <tr key={r.s} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 0', fontWeight: 600 }}>{r.s}</td>
                    <td style={{ padding: '8px 0' }} className="mono">{r.a}</td>
                    <td style={{ padding: '8px 0' }}>{r.d}</td>
                    <td style={{ padding: '8px 0' }} className="mono">{r.c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>

      {intake && <IntakeForm onClose={() => setIntake(false)}/>}
    </div>
  );
}

function IntakeForm({ onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-xl)', width: 560, maxHeight: '90vh', overflow: 'auto', padding: 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Icon name="alert" size={20} style={{ color: '#dc2626' }}/>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Log a customer complaint</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Auto-routes by severity. Acknowledgment sent to customer immediately.</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Customer</label>
            <select className="k-input"><option>AB Volvo Group</option><option>Robert Bosch</option><option>BMW</option><option>Daimler Truck</option></select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Severity</label>
            <select className="k-input" defaultValue="high"><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Batch / serial</label>
            <input className="k-input" placeholder="PA-VLV-3041"/>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Subject</label>
            <input className="k-input" placeholder="Brief description"/>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Detail</label>
            <textarea className="k-input" rows={4} style={{ height: 90, padding: 10 }}/>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Attachments</label>
            <div style={{ padding: 14, border: '2px dashed var(--border-strong)', borderRadius: 6, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              Drop photos, customer emails, or 8D PDF · or click to upload
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="k-btn k-btn-secondary">Cancel</button>
          <button className="k-btn k-btn-primary"><Icon name="check" size={12}/> Log complaint & auto-create NCR</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ECN — Engineering Change Notice
// ─────────────────────────────────────────────────────────────
function ECNWorkbench({ setRoute }) {
  const [view, setView] = React.useState('list');
  return (
    <div>
      <PageHeader
        title="Engineering Change Notices"
        description="Multi-stage approval workflow for design, process, and tooling changes. Auto-revises affected documents."
        actions={
          <>
            <Segmented size="sm" value={view} onChange={setView} options={[{value:'list',label:'List'},{value:'kanban',label:'Kanban'}]}/>
            <button className="k-btn k-btn-primary" onClick={() => kToast('New ECN drafted — ECN-2026-0090 created')}><Icon name="plus" size={13}/> New ECN</button>
          </>
        }
      />
      <div style={{ padding: '20px 28px 32px' }}>
        {view === 'list' ? <ECNList/> : <ECNKanban/>}
      </div>
    </div>
  );
}

function ECNList() {
  return (
    <div className="k-surface" style={{ overflow: 'hidden' }}>
      <table className="k-table" style={{ width: '100%' }}>
        <thead><tr>
          <th>ECN ID</th><th>Title</th><th>Type</th><th>Stage</th><th>Affected</th><th>Risk</th><th>Owner</th><th>Target</th>
        </tr></thead>
        <tbody>
          {[
            { id: 'ECN-2026-0184', t: 'Update weld penetration spec for Volvo VBR-3041 from 5.0–7.0mm to 5.5–7.0mm', tp: 'Design', s: 'cab-approval', stl: 'CAB approval', step: 4, of: 6, eff: 18, risk: 'med', owner: 'u1', target: 'Jun 12' },
            { id: 'ECN-2026-0183', t: 'Replace MIG with TIG on bracket DTR-201 inner seam', tp: 'Process', s: 'risk-review', stl: 'Risk review', step: 3, of: 6, eff: 47, risk: 'high', owner: 'u4', target: 'Jul 04' },
            { id: 'ECN-2026-0182', t: 'New torque value 28 → 32 Nm on assembly BHS-12 fastener', tp: 'Process', s: 'docs', stl: 'Doc revision', step: 5, of: 6, eff: 8, risk: 'low', owner: 'u2', target: 'May 28' },
            { id: 'ECN-2026-0181', t: 'Tooling rev for new pin diameter on fixture F-2-204', tp: 'Tooling', s: 'pilot', stl: 'Pilot run', step: 6, of: 6, eff: 4, risk: 'low', owner: 'u3', target: 'May 22' },
            { id: 'ECN-2026-0180', t: 'Supplier change — bushing from Vendor A to Vendor B (cost reduction)', tp: 'Material', s: 'ppap', stl: 'PPAP', step: 4, of: 6, eff: 12, risk: 'high', owner: 'u4', target: 'Aug 01' },
          ].map(e => (
            <tr key={e.id}>
              <td className="mono" style={{ fontSize: 11.5 }}>{e.id}</td>
              <td style={{ fontSize: 12.5, fontWeight: 500, maxWidth: 360 }}>{e.t}</td>
              <td><span className="k-chip" style={{ background: 'var(--bg-subtle)' }}>{e.tp}</span></td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 80, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${(e.step / e.of) * 100}%`, height: '100%', background: 'var(--accent)' }}/>
                  </div>
                  <span style={{ fontSize: 11 }}>{e.stl}</span>
                </div>
              </td>
              <td className="mono" style={{ fontSize: 11.5 }}>{e.eff} docs</td>
              <td>
                <span className="k-chip" style={{
                  background: e.risk === 'high' ? 'rgba(220,38,38,0.10)' : e.risk === 'med' ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.10)',
                  color: e.risk === 'high' ? '#b91c1c' : e.risk === 'med' ? '#92400e' : 'var(--success-700)',
                }}>{e.risk}</span>
              </td>
              <td><Avatar user={e.owner} size={26}/></td>
              <td style={{ fontSize: 11.5 }}>{e.target}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ECNKanban() {
  const cols = [
    { id: 'draft', l: 'Draft', count: 4, color: '#64748b' },
    { id: 'feasibility', l: 'Feasibility', count: 3, color: '#7c3aed' },
    { id: 'risk-review', l: 'Risk review', count: 2, color: '#f59e0b' },
    { id: 'cab', l: 'CAB approval', count: 2, color: '#2563eb' },
    { id: 'pilot', l: 'Pilot', count: 1, color: '#0d9488' },
    { id: 'impl', l: 'Implementation', count: 4, color: '#16a34a' },
    { id: 'closed', l: 'Closed', count: 18, color: '#94a3b8' },
  ];
  const cards = {
    draft: [{ id: 'ECN-2026-0186', t: 'New paint spec', risk: 'low' }, { id: 'ECN-2026-0187', t: 'Add fixture for VBR-3041', risk: 'med' }],
    feasibility: [{ id: 'ECN-2026-0185', t: 'Move Line 4 to robotic weld', risk: 'high' }],
    'risk-review': [{ id: 'ECN-2026-0183', t: 'MIG → TIG on DTR-201', risk: 'high' }],
    cab: [{ id: 'ECN-2026-0184', t: 'Update weld pen. spec', risk: 'med' }, { id: 'ECN-2026-0180', t: 'Supplier change bushing', risk: 'high' }],
    pilot: [{ id: 'ECN-2026-0181', t: 'Tooling rev pin dia', risk: 'low' }],
    impl: [{ id: 'ECN-2026-0182', t: 'Torque 28→32 Nm', risk: 'low' }],
    closed: [],
  };
  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
      {cols.map(c => (
        <div key={c.id} style={{ flex: '0 0 240px', background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)', padding: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color }}/>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{c.l}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{c.count}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(cards[c.id] || []).map(card => (
              <div key={card.id} style={{ padding: 10, background: 'var(--surface)', borderRadius: 6, border: '1px solid var(--border)', borderLeft: `3px solid ${card.risk === 'high' ? '#dc2626' : card.risk === 'med' ? '#f59e0b' : '#22c55e'}` }}>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{card.id}</div>
                <div style={{ fontSize: 12, fontWeight: 500, marginTop: 2 }}>{card.t}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { TrainingMatrix, CalibrationManagement, CustomerComplaints, ECNWorkbench });
