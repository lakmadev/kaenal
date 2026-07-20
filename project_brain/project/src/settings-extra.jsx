// Kaenal — Settings extra sub-pages
// Email templates, PDF report templates, SLA config, Categories

// ─────────────────────────────────────────────────────────────
// EMAIL NOTIFICATION TEMPLATE EDITOR
// ─────────────────────────────────────────────────────────────
const EMAIL_TEMPLATES = [
  { id: 'ncr-assigned', name: 'NCR assigned to you', event: 'ncr.assigned', subject: 'NCR {{ncr.id}} — {{ncr.severity}} assigned to you',
    body: 'Hi {{recipient.firstName}},\n\nA new non-conformity has been assigned to you:\n\n• ID: {{ncr.id}}\n• Severity: {{ncr.severity}}\n• Title: {{ncr.title}}\n• Due: {{ncr.dueDate}}\n• Area: {{ncr.area}}\n\nReview and disposition: {{ncr.url}}\n\n— Kaenal',
    lastUsed: '12 min ago', sent24h: 47, active: true },
  { id: 'ncr-critical', name: 'Critical NCR opened in your area', event: 'ncr.critical_opened', subject: '🚨 Critical NCR {{ncr.id}} — immediate action required',
    body: '', lastUsed: '2h ago', sent24h: 3, active: true },
  { id: 'ncr-overdue', name: 'NCR overdue reminder', event: 'ncr.overdue', subject: '⏰ NCR {{ncr.id}} is overdue by {{ncr.overdueDays}} days',
    body: '', lastUsed: '6h ago', sent24h: 8, active: true },
  { id: '8d-phase', name: '8D phase ready for your review', event: '8d.phase_ready', subject: '8D {{eightd.id}} — {{eightd.phase}} ready for your review',
    body: '', lastUsed: 'Yesterday', sent24h: 12, active: true },
  { id: 'inspection-assigned', name: 'Inspection assigned to you', event: 'inspection.assigned', subject: 'Inspection scheduled — {{inspection.title}}',
    body: '', lastUsed: '4h ago', sent24h: 28, active: true },
  { id: 'spc-alarm', name: 'SPC out-of-control', event: 'spc.alarm', subject: 'SPC alarm — {{line}} / {{characteristic}}',
    body: '', lastUsed: '12h ago', sent24h: 4, active: true },
  { id: 'document-approval', name: 'Document approval requested', event: 'document.approval_requested', subject: 'Approval requested: {{document.name}} v{{document.version}}',
    body: '', lastUsed: 'Yesterday', sent24h: 6, active: true },
  { id: 'document-expiring', name: 'Document expiring soon', event: 'document.expiring', subject: '{{document.name}} expires in {{document.daysUntilExpiry}} days',
    body: '', lastUsed: '3 days ago', sent24h: 2, active: true },
  { id: 'audit-upcoming', name: 'Upcoming audit reminder', event: 'audit.upcoming', subject: 'Audit {{audit.title}} starts in {{audit.daysUntilStart}} days',
    body: '', lastUsed: '1 week ago', sent24h: 0, active: true },
  { id: 'capa-due', name: 'CAPA approaching due date', event: 'capa.due_soon', subject: 'CAPA {{capa.id}} due in {{capa.daysUntilDue}} days',
    body: '', lastUsed: '8h ago', sent24h: 5, active: true },
  { id: 'training-expiring', name: 'Training certification expiring', event: 'training.expiring', subject: 'Your {{training.name}} certification expires in {{training.daysUntilExpiry}} days',
    body: '', lastUsed: '2 days ago', sent24h: 1, active: false },
  { id: 'welcome', name: 'New member welcome', event: 'member.invited', subject: 'Welcome to {{org.name}} on Kaenal',
    body: '', lastUsed: 'Yesterday', sent24h: 3, active: true },
];

const AVAILABLE_VARS = {
  recipient: ['firstName', 'lastName', 'email', 'role'],
  ncr: ['id', 'title', 'severity', 'area', 'dueDate', 'overdueDays', 'url'],
  eightd: ['id', 'phase', 'leadName', 'targetDate', 'url'],
  inspection: ['title', 'template', 'dueDate', 'area', 'url'],
  document: ['name', 'version', 'daysUntilExpiry', 'url'],
  audit: ['title', 'standard', 'daysUntilStart', 'url'],
  capa: ['id', 'title', 'daysUntilDue', 'url'],
  org: ['name', 'logo'],
};

function EmailTemplates({ setRoute }) {
  const [selected, setSelected] = React.useState('ncr-assigned');
  const [tpls, setTpls] = React.useState(EMAIL_TEMPLATES);
  const tpl = tpls.find(t => t.id === selected);

  const updateTpl = (patch) => {
    setTpls(prev => prev.map(t => t.id === selected ? { ...t, ...patch } : t));
  };

  const insertVar = (path) => {
    const tag = '{{' + path + '}}';
    updateTpl({ body: (tpl.body || '') + ' ' + tag });
  };

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Left: template list */}
      <div style={{ width: 320, borderRight: '1px solid var(--border)', background: 'var(--bg-subtle)', overflowY: 'auto' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Email templates</h2>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{tpls.length} templates · {tpls.filter(t => t.active).length} active</div>
        </div>
        <div style={{ padding: 8 }}>
          {tpls.map(t => (
            <button key={t.id} onClick={() => setSelected(t.id)} style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '10px 12px', marginBottom: 3, borderRadius: 6,
              background: selected === t.id ? 'var(--surface)' : 'transparent',
              border: selected === t.id ? '1px solid var(--accent)' : '1px solid transparent',
              cursor: 'pointer',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.active ? '#22c55e' : '#94a3b8' }}/>
                <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1 }}>{t.name}</span>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{t.event}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 3 }}>{t.sent24h} sent · last {t.lastUsed}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Right: editor */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{tpl.name}</h2>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{tpl.event}</div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <Toggle on={tpl.active} onChange={(v) => updateTpl({ active: v })}/>
            <span style={{ color: tpl.active ? 'var(--text)' : 'var(--text-muted)' }}>{tpl.active ? 'Active' : 'Disabled'}</span>
          </label>
          <button className="k-btn k-btn-secondary"><Icon name="mail" size={13}/> Send test</button>
          <button className="k-btn k-btn-primary"><Icon name="check" size={13}/> Save</button>
        </div>

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>From</label>
              <input className="k-input" value="Kaenal Quality &lt;noreply@kaenal.app&gt;" readOnly style={{ background: 'var(--bg-subtle)', fontSize: 12.5 }}/>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Subject</label>
              <input className="k-input" value={tpl.subject} onChange={e => updateTpl({ subject: e.target.value })} style={{ fontSize: 13 }}/>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Body</label>
              <textarea className="k-input" value={tpl.body || ''} onChange={e => updateTpl({ body: e.target.value })}
                rows={14}
                style={{ height: 'auto', padding: 12, fontSize: 12.5, lineHeight: 1.6, fontFamily: 'var(--font-mono)', resize: 'vertical', minHeight: 280 }}/>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Plain text. Use {'{{variable}}'} syntax — click variables to insert.</div>
            </div>

            {/* Preview */}
            <div className="k-surface" style={{ padding: 18, marginTop: 18 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 10 }}>Preview</div>
              <div style={{ paddingBottom: 10, borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>From: Kaenal Quality &lt;noreply@kaenal.app&gt;</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>To: priya.iyer@precision-auto.com</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>
                  {tpl.subject
                    .replace('{{ncr.id}}', 'NCR-2026-0142')
                    .replace('{{ncr.severity}}', 'Critical')
                    .replace('{{ncr.overdueDays}}', '3')}
                </div>
              </div>
              <pre style={{ margin: 0, fontFamily: 'inherit', fontSize: 12.5, lineHeight: 1.65, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
{(tpl.body || '— body empty —')
  .replace(/\{\{recipient\.firstName\}\}/g, 'Priya')
  .replace(/\{\{ncr\.id\}\}/g, 'NCR-2026-0142')
  .replace(/\{\{ncr\.severity\}\}/g, 'Critical')
  .replace(/\{\{ncr\.title\}\}/g, 'Weld porosity batch A-7742')
  .replace(/\{\{ncr\.dueDate\}\}/g, '18 May 2026')
  .replace(/\{\{ncr\.area\}\}/g, 'Plant A — Weld Cell 3')
  .replace(/\{\{ncr\.url\}\}/g, 'https://precision-auto.kaenal.app/ncr/NCR-2026-0142')}
              </pre>
            </div>
          </div>

          {/* Variables panel */}
          <div style={{ width: 240, borderLeft: '1px solid var(--border)', background: 'var(--bg-subtle)', overflowY: 'auto', padding: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Available variables</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>Click any variable to insert it at the cursor.</div>
            {Object.entries(AVAILABLE_VARS).map(([group, keys]) => (
              <div key={group} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>{group}</div>
                {keys.map(k => (
                  <button key={k} onClick={() => insertVar(group + '.' + k)} style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '5px 8px', marginBottom: 2, borderRadius: 4,
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)',
                    cursor: 'pointer',
                  }}>{'{{' + group + '.' + k + '}}'}</button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PDF REPORT TEMPLATES
// ─────────────────────────────────────────────────────────────
const PDF_TEMPLATES = [
  { id: 'p1', name: '8D Final Report — Automotive', kind: '8D', uses: 24, modified: '12 Apr 2026', pages: 3, blocks: 14, official: true },
  { id: 'p2', name: '8D Final Report — Pharma (FDA)', kind: '8D', uses: 7, modified: '03 Mar 2026', pages: 5, blocks: 22 },
  { id: 'p3', name: 'NCR Disposition Form', kind: 'NCR', uses: 184, modified: '28 Feb 2026', pages: 1, blocks: 8, official: true },
  { id: 'p4', name: 'IATF Audit Report — Internal', kind: 'Audit', uses: 18, modified: '02 May 2026', pages: 6, blocks: 28, official: true },
  { id: 'p5', name: 'Supplier Audit Report', kind: 'Audit', uses: 9, modified: '15 Apr 2026', pages: 4, blocks: 18 },
  { id: 'p6', name: 'Inspection Summary (Daily)', kind: 'Inspection', uses: 312, modified: '01 May 2026', pages: 2, blocks: 12 },
  { id: 'p7', name: 'CAPA Implementation Plan', kind: 'CAPA', uses: 36, modified: '18 Apr 2026', pages: 3, blocks: 16 },
  { id: 'p8', name: 'Customer Complaint Response', kind: 'NCR', uses: 41, modified: '22 Apr 2026', pages: 2, blocks: 10 },
];

function PdfTemplatesList({ setRoute }) {
  return (
    <SettingsPage title="PDF report templates" subtitle="Branded, block-based PDFs for 8Ds, NCRs, audits, and inspections"
      actions={<>
        <button className="k-btn k-btn-secondary"><Icon name="upload" size={14}/> Import .ktpl</button>
        <button className="k-btn k-btn-primary" onClick={() => setRoute('pdf-designer')}><Icon name="plus" size={14}/> New template</button>
      </>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {PDF_TEMPLATES.map(t => (
          <div key={t.id} className="k-surface k-hoverable" onClick={() => setRoute('pdf-designer')} style={{ padding: 14, cursor: 'pointer' }}>
            <div style={{
              height: 130, marginBottom: 12, borderRadius: 6,
              background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
              border: '1px solid var(--border)',
            }}>
              <div style={{ width: 80, height: 100, background: 'white', boxShadow: '0 2px 8px rgba(15,23,42,0.12)', display: 'flex', flexDirection: 'column', padding: 6, gap: 3, borderRadius: 2 }}>
                <div style={{ height: 6, background: '#2563eb', width: '40%', borderRadius: 1 }}/>
                <div style={{ height: 3, background: '#cbd5e1', width: '80%' }}/>
                <div style={{ height: 3, background: '#cbd5e1', width: '60%' }}/>
                <div style={{ height: 18, background: '#f1f5f9', marginTop: 4 }}/>
                <div style={{ height: 3, background: '#cbd5e1', width: '90%' }}/>
                <div style={{ height: 3, background: '#cbd5e1', width: '70%' }}/>
                <div style={{ height: 3, background: '#cbd5e1', width: '85%' }}/>
              </div>
              {t.official && (
                <span style={{ position: 'absolute', top: 8, left: 8, padding: '3px 7px', background: 'var(--accent)', color: 'white', fontSize: 9.5, fontWeight: 700, borderRadius: 'var(--r-full)', letterSpacing: '0.04em' }}>OFFICIAL</span>
              )}
              <span style={{ position: 'absolute', top: 8, right: 8, padding: '3px 7px', background: 'rgba(15,23,42,0.7)', color: 'white', fontSize: 9.5, fontWeight: 600, borderRadius: 'var(--r-full)' }}>{t.kind}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{t.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
              <span>{t.pages} pages · {t.blocks} blocks</span>
              <span>{t.uses} uses</span>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4 }}>Updated {t.modified}</div>
          </div>
        ))}
      </div>
    </SettingsPage>
  );
}

// ─────────────────────────────────────────────────────────────
// SLA CONFIGURATION
// ─────────────────────────────────────────────────────────────
function SLAConfig() {
  const [tab, setTab] = React.useState('ncr');
  return (
    <SettingsPage title="SLA configuration" subtitle="Severity-driven targets and escalation paths"
      actions={<button className="k-btn k-btn-primary"><Icon name="check" size={14}/> Save changes</button>}>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 18 }}>
        {[
          { id: 'ncr', l: 'NCR', i: 'alert' },
          { id: '8d', l: '8D', i: 'brain' },
          { id: 'audit', l: 'Audit findings', i: 'audit' },
          { id: 'capa', l: 'CAPA', i: 'capa' },
          { id: 'inspections', l: 'Inspections', i: 'clipboard' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 14px', fontSize: 13, fontWeight: 500,
            borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab === t.id ? 'var(--text)' : 'var(--text-muted)',
            marginBottom: -1, display: 'inline-flex', alignItems: 'center', gap: 6,
            border: 'none', background: 'none', cursor: 'pointer',
          }}>
            <Icon name={t.i} size={13}/> {t.l}
          </button>
        ))}
      </div>

      {tab === 'ncr' && <NcrSlaConfig/>}
      {tab === '8d' && <EightDSlaConfig/>}
      {tab === 'audit' && <AuditSlaConfig/>}
      {tab === 'capa' && <CapaSlaConfig/>}
      {tab === 'inspections' && <InspSlaConfig/>}
    </SettingsPage>
  );
}

function SlaSeverityRow({ severity, color, defaults }) {
  const [acknowledge, setAcknowledge] = React.useState(defaults.ack);
  const [contain, setContain] = React.useState(defaults.contain);
  const [resolve, setResolve] = React.useState(defaults.resolve);
  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '14px 8px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: color }}/>
          {severity}
        </span>
      </td>
      <td style={{ padding: '14px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="number" value={acknowledge} onChange={e => setAcknowledge(+e.target.value)} className="k-input" style={{ width: 70, height: 28, fontSize: 12, textAlign: 'right' }}/>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>hours</span>
        </div>
      </td>
      <td style={{ padding: '14px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="number" value={contain} onChange={e => setContain(+e.target.value)} className="k-input" style={{ width: 70, height: 28, fontSize: 12, textAlign: 'right' }}/>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>hours</span>
        </div>
      </td>
      <td style={{ padding: '14px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="number" value={resolve} onChange={e => setResolve(+e.target.value)} className="k-input" style={{ width: 70, height: 28, fontSize: 12, textAlign: 'right' }}/>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>days</span>
        </div>
      </td>
      <td style={{ padding: '14px 8px' }}>
        <select className="k-input" style={{ height: 28, fontSize: 12, width: 160 }} defaultValue={defaults.escalate}>
          <option>Line Supervisor</option>
          <option>Quality Engineer</option>
          <option>Quality Manager</option>
          <option>Plant Director</option>
          <option>VP Quality</option>
        </select>
      </td>
    </tr>
  );
}

function NcrSlaConfig() {
  return (
    <>
      <Card title="NCR severity SLAs" desc="Time-to-acknowledge, contain, and resolve by severity">
        <table style={{ width: '100%' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
              <th style={{ padding: '8px 8px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Severity</th>
              <th style={{ padding: '8px 8px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Acknowledge</th>
              <th style={{ padding: '8px 8px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Containment</th>
              <th style={{ padding: '8px 8px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Resolution</th>
              <th style={{ padding: '8px 8px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Escalate to</th>
            </tr>
          </thead>
          <tbody>
            <SlaSeverityRow severity="Critical" color="#dc2626" defaults={{ ack: 1, contain: 4, resolve: 3, escalate: 'Plant Director' }}/>
            <SlaSeverityRow severity="Major" color="#ea580c" defaults={{ ack: 4, contain: 24, resolve: 7, escalate: 'Quality Manager' }}/>
            <SlaSeverityRow severity="Minor" color="#f59e0b" defaults={{ ack: 24, contain: 72, resolve: 14, escalate: 'Quality Engineer' }}/>
          </tbody>
        </table>
      </Card>

      <Card title="Escalation rules" desc="Automatic escalation when SLAs are breached">
        <Row label="Auto-escalate on breach"><Toggle on={true}/></Row>
        <Row label="Notify on warning (80% of SLA)"><Toggle on={true}/></Row>
        <Row label="Page on-call for Critical breach"><Toggle on={true}/></Row>
        <Row label="Stop after N escalation levels"><input type="number" defaultValue={3} className="k-input" style={{ width: 80 }}/></Row>
        <Row label="Exclude weekends from clock"><Toggle on={false}/></Row>
        <Row label="Exclude shift-off hours" hint="Counts only during local plant working hours"><Toggle on={false}/></Row>
      </Card>

      <Card title="Auto-create 8D" desc="Trigger an 8D automatically based on NCR conditions">
        <Row label="Trigger conditions">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input type="checkbox" defaultChecked style={{ accentColor: 'var(--accent)' }}/>
              All Critical NCRs
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input type="checkbox" defaultChecked style={{ accentColor: 'var(--accent)' }}/>
              Customer complaints (any severity)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input type="checkbox" style={{ accentColor: 'var(--accent)' }}/>
              3+ recurrences of same defect type in 30 days
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input type="checkbox" style={{ accentColor: 'var(--accent)' }}/>
              Cost-of-quality impact &gt; $5,000
            </label>
          </div>
        </Row>
      </Card>
    </>
  );
}

function EightDSlaConfig() {
  return (
    <Card title="8D step SLAs" desc="Default per-step targets (overridable per template)">
      <table style={{ width: '100%' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
            <th style={{ padding: '8px 8px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Step</th>
            <th style={{ padding: '8px 8px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Target days</th>
            <th style={{ padding: '8px 8px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Warn at</th>
            <th style={{ padding: '8px 8px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Approval</th>
          </tr>
        </thead>
        <tbody>
          {[
            ['D1', 'Team formation', 1, 'Optional'],
            ['D2', 'Problem description', 2, 'Required'],
            ['D3', 'Containment', 1, 'Required'],
            ['D4', 'Root cause', 7, 'Required'],
            ['D5', 'Permanent corrective action', 5, 'Required'],
            ['D6', 'Implementation', 14, 'Required'],
            ['D7', 'Prevent recurrence', 30, 'Required'],
            ['D8', 'Team & closure', 7, 'Required'],
          ].map((r, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '12px 8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{r[0]}</div>
                  <span style={{ fontWeight: 600 }}>{r[1]}</span>
                </div>
              </td>
              <td style={{ padding: '12px 8px' }}>
                <input type="number" defaultValue={r[2]} className="k-input" style={{ width: 70, height: 28, fontSize: 12, textAlign: 'right' }}/>
              </td>
              <td style={{ padding: '12px 8px' }}>
                <Segmented size="sm" value="80" onChange={() => {}} options={[{ value: '50', label: '50%' }, { value: '80', label: '80%' }, { value: 'never', label: 'Never' }]}/>
              </td>
              <td style={{ padding: '12px 8px' }}>
                <Segmented size="sm" value={r[3].toLowerCase()} onChange={() => {}} options={[{ value: 'required', label: 'Required' }, { value: 'optional', label: 'Optional' }]}/>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function AuditSlaConfig() {
  return (
    <Card title="Audit finding SLAs">
      <table style={{ width: '100%' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
            <th style={{ padding: '8px 8px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Finding type</th>
            <th style={{ padding: '8px 8px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Containment</th>
            <th style={{ padding: '8px 8px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Root cause</th>
            <th style={{ padding: '8px 8px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Corrective action</th>
            <th style={{ padding: '8px 8px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Effectiveness review</th>
          </tr>
        </thead>
        <tbody>
          {[
            { l: 'Major NC', c: '#dc2626', vals: [7, 21, 30, 60] },
            { l: 'Minor NC', c: '#f59e0b', vals: [14, 30, 45, 90] },
            { l: 'OFI', c: '#2563eb', vals: ['—', '—', 60, '—'] },
          ].map(r => (
            <tr key={r.l} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '14px 8px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: r.c }}/>
                  {r.l}
                </span>
              </td>
              {r.vals.map((v, i) => (
                <td key={i} style={{ padding: '14px 8px' }}>
                  {v === '—' ? <span style={{ color: 'var(--text-muted)' }}>—</span> : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input type="number" defaultValue={v} className="k-input" style={{ width: 70, height: 28, fontSize: 12, textAlign: 'right' }}/>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>days</span>
                    </div>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function CapaSlaConfig() {
  return (
    <Card title="CAPA phase SLAs">
      <Row label="Default total target">
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="number" defaultValue={90} className="k-input" style={{ width: 80, height: 32 }}/>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>days from initiation to effectiveness</span>
        </div>
      </Row>
      <Row label="Initiation → Investigation">
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="number" defaultValue={5} className="k-input" style={{ width: 80, height: 32 }}/>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>days</span>
        </div>
      </Row>
      <Row label="Investigation → Action plan">
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="number" defaultValue={10} className="k-input" style={{ width: 80, height: 32 }}/>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>days</span>
        </div>
      </Row>
      <Row label="Action plan → Implementation">
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="number" defaultValue={30} className="k-input" style={{ width: 80, height: 32 }}/>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>days</span>
        </div>
      </Row>
      <Row label="Implementation → Verification">
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="number" defaultValue={15} className="k-input" style={{ width: 80, height: 32 }}/>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>days</span>
        </div>
      </Row>
      <Row label="Verification → Effectiveness review">
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="number" defaultValue={30} className="k-input" style={{ width: 80, height: 32 }}/>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>days</span>
        </div>
      </Row>
    </Card>
  );
}

function InspSlaConfig() {
  return (
    <Card title="Inspection completion SLAs">
      <Row label="Daily inspections" hint="Inspector has this much time to complete each daily checklist">
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="number" defaultValue={1} className="k-input" style={{ width: 80, height: 32 }}/>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>shift(s) from start</span>
        </div>
      </Row>
      <Row label="Weekly inspections"><div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><input type="number" defaultValue={7} className="k-input" style={{ width: 80, height: 32 }}/><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>days</span></div></Row>
      <Row label="LPA / Layered Process Audits"><div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><input type="number" defaultValue={3} className="k-input" style={{ width: 80, height: 32 }}/><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>days</span></div></Row>
      <Row label="Auto-create finding for fails"><Toggle on={true}/></Row>
      <Row label="Notify supervisor on missed inspection"><Toggle on={true}/></Row>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// CATEGORIES MANAGEMENT
// ─────────────────────────────────────────────────────────────
function Categories() {
  const [tab, setTab] = React.useState('ncr');
  return (
    <SettingsPage title="Categories" subtitle="Taxonomies and dropdown options used across the workspace"
      actions={<button className="k-btn k-btn-primary"><Icon name="plus" size={14}/> Add category</button>}>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 18 }}>
        {[
          { id: 'ncr', l: 'NCR categories', i: 'alert' },
          { id: 'defects', l: 'Defect types', i: 'x' },
          { id: 'inspection', l: 'Inspection types', i: 'clipboard' },
          { id: 'root-cause', l: 'Root cause buckets', i: 'brain' },
          { id: 'areas', l: 'Areas / cells', i: 'mapPin' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 14px', fontSize: 13, fontWeight: 500,
            borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab === t.id ? 'var(--text)' : 'var(--text-muted)',
            marginBottom: -1, display: 'inline-flex', alignItems: 'center', gap: 6,
            border: 'none', background: 'none', cursor: 'pointer',
          }}>
            <Icon name={t.i} size={13}/> {t.l}
          </button>
        ))}
      </div>

      {tab === 'ncr' && <CategoryEditor
        title="NCR categories" desc="Used in the NCR creation wizard"
        items={[
          { l: 'Process', c: '#2563eb', usage: 42 },
          { l: 'Material', c: '#7c3aed', usage: 28 },
          { l: 'Equipment', c: '#f59e0b', usage: 19 },
          { l: 'Supplier', c: '#16a34a', usage: 24 },
          { l: 'Method / Procedure', c: '#ea580c', usage: 14 },
          { l: 'Environment', c: '#0d9488', usage: 6 },
          { l: 'Operator / Training', c: '#dc2626', usage: 12 },
          { l: 'Calibration', c: '#9333ea', usage: 8 },
        ]}
      />}
      {tab === 'defects' && <CategoryEditor
        title="Defect type taxonomy" desc="Used by inspections and NCRs for Pareto analysis"
        items={[
          { l: 'Weld porosity', c: '#dc2626', usage: 47 },
          { l: 'Dimensional drift (OOS)', c: '#ea580c', usage: 31 },
          { l: 'Paint defect — orange peel', c: '#f59e0b', usage: 24 },
          { l: 'Torque out-of-spec', c: '#2563eb', usage: 18 },
          { l: 'Label missing / wrong', c: '#7c3aed', usage: 12 },
          { l: 'Surface scratch / dent', c: '#16a34a', usage: 9 },
          { l: 'Contamination', c: '#0d9488', usage: 7 },
        ]}
      />}
      {tab === 'inspection' && <CategoryEditor
        title="Inspection types"
        items={[
          { l: 'Process Audit', c: '#2563eb', usage: 142 },
          { l: 'Layered Process Audit', c: '#16a34a', usage: 89 },
          { l: 'Daily Safety Walk', c: '#dc2626', usage: 312 },
          { l: '5S Audit', c: '#f59e0b', usage: 56 },
          { l: 'Incoming Goods', c: '#7c3aed', usage: 184 },
          { l: 'Cleanroom Verification', c: '#0d9488', usage: 24 },
          { l: 'Calibration Check', c: '#ea580c', usage: 32 },
        ]}
      />}
      {tab === 'root-cause' && <CategoryEditor
        title="Root cause buckets" desc="Used in 8D D4 — 6M / Fishbone taxonomy"
        items={[
          { l: 'Man (Operator/Training)', c: '#dc2626', usage: 32 },
          { l: 'Machine', c: '#2563eb', usage: 48 },
          { l: 'Material', c: '#7c3aed', usage: 24 },
          { l: 'Method', c: '#16a34a', usage: 28 },
          { l: 'Measurement', c: '#f59e0b', usage: 14 },
          { l: 'Mother Nature (Environment)', c: '#0d9488', usage: 8 },
        ]}
      />}
      {tab === 'areas' && <CategoryEditor
        title="Plants, areas & cells" desc="Physical hierarchy used for scoping inspections, NCRs, and analytics"
        items={[
          { l: 'Plant A · Welding · Cell 1', c: '#2563eb', usage: 187 },
          { l: 'Plant A · Welding · Cell 2', c: '#2563eb', usage: 162 },
          { l: 'Plant A · Welding · Cell 3', c: '#2563eb', usage: 148 },
          { l: 'Plant A · Assembly · Line 1', c: '#7c3aed', usage: 224 },
          { l: 'Plant A · Assembly · Line 2', c: '#7c3aed', usage: 198 },
          { l: 'Plant B · Machining · Cell 1', c: '#16a34a', usage: 142 },
          { l: 'Plant B · Paint Shop', c: '#f59e0b', usage: 88 },
          { l: 'Cleanroom Suite A', c: '#0d9488', usage: 42 },
        ]}
      />}
    </SettingsPage>
  );
}

function CategoryEditor({ title, desc, items }) {
  return (
    <Card title={title} desc={desc}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((it, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
            border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
          }}>
            <span style={{ cursor: 'grab', color: 'var(--text-muted)' }}><Icon name="grip" size={13}/></span>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: it.c, flexShrink: 0 }}/>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{it.l}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{it.usage} uses</span>
            <button className="k-btn-plain" style={{ padding: 6 }}><Icon name="edit" size={13}/></button>
            <button className="k-btn-plain" style={{ padding: 6, color: 'var(--text-muted)' }}><Icon name="trash" size={13}/></button>
          </div>
        ))}
        <button style={{
          padding: '10px 12px', border: '1.5px dashed var(--border-strong)',
          borderRadius: 'var(--r-md)', background: 'transparent',
          color: 'var(--text-muted)', fontSize: 12.5, fontWeight: 500,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer',
        }}>
          <Icon name="plus" size={13}/> Add option
        </button>
      </div>
    </Card>
  );
}

Object.assign(window, { EmailTemplates, PdfTemplatesList, SLAConfig, Categories, SettingsInspectionTemplatesShortcut, SettingsEightDTemplatesShortcut });

function SettingsInspectionTemplatesShortcut({ setRoute }) {
  return (
    <SettingsPage title="Inspection templates" subtitle="Manage reusable checklists, scoring rules, and field configurations"
      actions={<button className="k-btn k-btn-primary" onClick={() => setRoute('inspections-templates')}><Icon name="arrowRight" size={14}/> Open template library</button>}>
      <Card title="Quick stats">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {[
            { l: 'Active templates', v: '6', c: '#2563eb' },
            { l: 'Total uses (YTD)', v: '641', c: '#16a34a' },
            { l: 'Avg completion rate', v: '94%', c: '#9333ea' },
          ].map(k => (
            <div key={k.l} style={{ padding: 14, background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{k.l}</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: k.c }}>{k.v}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, padding: 14, background: 'var(--accent-soft)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon name="info" size={18}/>
          <div style={{ flex: 1, fontSize: 12.5 }}>
            <strong>Templates live in the Inspections module</strong> for drag-drop editing with full-canvas preview.
          </div>
          <button onClick={() => setRoute('inspections-templates')} className="k-btn k-btn-primary">Open library</button>
        </div>
      </Card>
    </SettingsPage>
  );
}

function SettingsEightDTemplatesShortcut({ setRoute }) {
  return (
    <SettingsPage title="8D templates" subtitle="Industry-specific D2 prompts, default team roles, SLA per step"
      actions={<button className="k-btn k-btn-primary" onClick={() => setRoute('8d-templates')}><Icon name="arrowRight" size={14}/> Open 8D template library</button>}>
      <Card title="Quick stats">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {[
            { l: 'Templates', v: '7', c: '#2563eb' },
            { l: '8Ds opened (YTD)', v: '185', c: '#7c3aed' },
            { l: 'On-time closure', v: '78%', c: '#f59e0b' },
          ].map(k => (
            <div key={k.l} style={{ padding: 14, background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{k.l}</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: k.c }}>{k.v}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, padding: 14, background: 'var(--accent-soft)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon name="info" size={18}/>
          <div style={{ flex: 1, fontSize: 12.5 }}>
            <strong>Customize each D-step</strong> with AI prompts, evidence requirements, SLA, and required fields.
          </div>
          <button onClick={() => setRoute('8d-templates')} className="k-btn k-btn-primary">Open library</button>
        </div>
      </Card>
    </SettingsPage>
  );
}
