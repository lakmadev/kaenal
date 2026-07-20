// Kaenal — Reports builder

const REPORT_TEMPLATES = [
  { id: 'r1', name: 'Quality KPI Dashboard', desc: 'PPM, FPY, scrap rate, top defects — auto-refreshed weekly', icon: 'lineChart', color: '#2563eb', uses: 142 },
  { id: 'r2', name: 'NCR Aging & Trend', desc: 'Open NCRs by age bucket, severity, area, supplier', icon: 'barChart', color: '#dc2626', uses: 89 },
  { id: 'r3', name: 'Audit Readiness Pack', desc: 'IATF 16949 evidence rolled up by clause', icon: 'shieldCheck', color: '#16a34a', uses: 67 },
  { id: 'r4', name: 'Supplier Scorecard', desc: 'PPM, on-time delivery, NCR rate by supplier', icon: 'building', color: '#7c3aed', uses: 54 },
  { id: 'r5', name: 'Cost of Poor Quality', desc: 'Scrap, rework, warranty, complaint cost trends', icon: 'pieChart', color: '#ea580c', uses: 38 },
  { id: 'r6', name: 'Training Compliance', desc: 'Certifications expiring, gap analysis by role', icon: 'award', color: '#f59e0b', uses: 22 },
];

const SAVED_REPORTS = [
  { id: 's1', name: 'Weekly Plant Manager Brief', template: 'Quality KPI Dashboard', schedule: 'Mondays 7:00 AM', recipients: 4, lastRun: '2 days ago', format: 'pdf', owner: 'u-priya' },
  { id: 's2', name: 'NCR Aging — Stamping Cell', template: 'NCR Aging & Trend', schedule: 'Daily 6:00 AM', recipients: 2, lastRun: '6 hours ago', format: 'pdf', owner: 'u-marcus' },
  { id: 's3', name: 'Q1 IATF Surveillance Pack', template: 'Audit Readiness Pack', schedule: 'On-demand', recipients: 0, lastRun: '3 weeks ago', format: 'pdf', owner: 'u-david' },
  { id: 's4', name: 'Supplier QBR Pack', template: 'Supplier Scorecard', schedule: 'Quarterly', recipients: 8, lastRun: '5 weeks ago', format: 'xlsx', owner: 'u-sarah' },
  { id: 's5', name: 'COPQ Monthly Roll-up', template: 'Cost of Poor Quality', schedule: '1st of month', recipients: 3, lastRun: '11 days ago', format: 'pdf', owner: 'u-david' },
];

const ReportsHub = ({ setRoute, setReport }) => {
  const [tab, setTab] = React.useState('saved');
  const [runningId, setRunningId] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const [menuId, setMenuId] = React.useState(null);
  React.useEffect(() => {
    if (!menuId) return;
    const close = () => setMenuId(null);
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    return () => { window.removeEventListener('click', close); window.removeEventListener('scroll', close, true); };
  }, [menuId]);
  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);
  const runReport = (r) => {
    if (runningId) return;
    setRunningId(r.id);
    setToast(`Running \u201c${r.name}\u201d\u2026`);
    setTimeout(() => {
      setRunningId(null);
      setToast(`${r.format === 'pdf' ? 'PDF' : 'XLSX'} ready \u2014 ${r.name}`);
    }, 1600);
  };
  return (
    <div className="fade-in">
      <PageHeader
        title="Reports"
        subtitle="Build, schedule, and share quality intelligence"
        actions={
          <>
            <button className="k-btn k-btn-ghost" onClick={() => setToast('Choose a .krpt template file to import')}><Icon name="upload" size={14}/>Import template</button>
            <button onClick={() => { setReport('new'); setRoute('report-builder'); }} className="k-btn k-btn-primary"><Icon name="plus" size={14}/>New report</button>
          </>
        }
      />
      <div style={{ padding: '0 24px', borderBottom: '1px solid var(--border)' }}>
        <div className="k-tabs">
          <button className={`k-tab ${tab==='saved'?'active':''}`} onClick={() => setTab('saved')}><Icon name="fileText" size={13}/>Saved reports <span style={{ fontSize: 10, padding: '1px 6px', background: 'var(--bg-subtle)', borderRadius: 'var(--r-full)', marginLeft: 4 }}>{SAVED_REPORTS.length}</span></button>
            <button className={`k-tab ${tab==='templates'?'active':''}`} onClick={() => setTab('templates')}><Icon name="copy" size={13}/>Templates</button>
            <button className={`k-tab ${tab==='scheduled'?'active':''}`} onClick={() => setTab('scheduled')}><Icon name="clock" size={13}/>Scheduled runs</button>
        </div>
      </div>
      <div style={{ padding: 24 }}>
        {tab === 'templates' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {REPORT_TEMPLATES.map(t => (
              <button key={t.id} onClick={() => { setReport(t.id); setRoute('report-builder'); }}
                className="k-surface" style={{ padding: 18, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 'var(--r-md)', background: t.color + '15', color: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={t.icon} size={20} stroke={1.75}/>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t.desc}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-subtle)' }}>
                  <Icon name="users" size={11}/>{t.uses} teams use this
                </div>
              </button>
            ))}
          </div>
        )}
        {tab === 'saved' && (
          <div className="k-surface" style={{ overflow: 'hidden' }}>
            <table className="k-table">
              <thead><tr><th>Report</th><th>Template</th><th>Schedule</th><th>Last run</th><th>Recipients</th><th>Owner</th><th></th></tr></thead>
              <tbody>
                {SAVED_REPORTS.map(r => (
                  <tr key={r.id} onClick={() => { setReport(r.id); setRoute('report-builder'); }} style={{ cursor: 'pointer' }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ color: r.format === 'pdf' ? '#dc2626' : '#16a34a' }}><Icon name={r.format === 'pdf' ? 'filePdf' : 'fileXls'} size={18} stroke={1.5}/></div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }} className="mono">{r.id.toUpperCase()}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.template}</td>
                    <td><span className="k-chip" style={{ background: r.schedule === 'On-demand' ? 'var(--bg-subtle)' : 'var(--info-50)', color: r.schedule === 'On-demand' ? 'var(--text-muted)' : 'var(--info-600)' }}>{r.schedule}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.lastRun}</td>
                    <td style={{ fontSize: 12 }}>{r.recipients > 0 ? `${r.recipients} people` : <span style={{ color: 'var(--text-subtle)' }}>—</span>}</td>
                    <td><Avatar user={r.owner} size={22}/></td>
                    <td onClick={e => e.stopPropagation()} style={{ verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'flex-end' }}>
                      <button className="k-btn k-btn-sm k-btn-ghost" disabled={runningId === r.id} onClick={() => runReport(r)} style={{ minWidth: 64, justifyContent: 'center' }}>
                        {runningId === r.id
                          ? <><Icon name="refresh" size={11} className="k-spin"/>Running</>
                          : <><Icon name="eye" size={11}/>Run</>}
                      </button>
                      <div style={{ position: 'relative' }}>
                        <button className="k-btn-icon k-btn-plain" onClick={(e) => {
                          e.stopPropagation();
                          if (menuId && menuId.id === r.id) { setMenuId(null); return; }
                          const b = e.currentTarget.getBoundingClientRect();
                          setMenuId({ id: r.id, top: b.bottom + 4, left: b.right - 168 });
                        }}><Icon name="more" size={14}/></button>
                        {menuId && menuId.id === r.id &&
                          <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', top: menuId.top, left: menuId.left, width: 168, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-lg)', padding: 4, zIndex: 200 }}>
                            {[
                              { label: 'Open in builder', icon: 'edit', act: () => { setReport(r.id); setRoute('report-builder'); } },
                              { label: 'Run now', icon: 'eye', act: () => runReport(r) },
                              { label: 'Duplicate', icon: 'copy', act: () => setToast(`Duplicated \u201c${r.name}\u201d`) },
                              { label: 'Share\u2026', icon: 'users', act: () => setToast(`Share link copied`) },
                              { sep: true },
                              { label: 'Delete', icon: 'trash', danger: true, act: () => setToast(`Deleted \u201c${r.name}\u201d`) },
                            ].map((m, i) => m.sep
                              ? <div key={i} style={{ height: 1, background: 'var(--border)', margin: '4px 0' }}/>
                              : <button key={i} onClick={() => { setMenuId(null); m.act(); }} className="k-menu-item" style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 9px', border: 'none', background: 'none', borderRadius: 'var(--r-sm)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', textAlign: 'left', color: m.danger ? 'var(--danger-600, #dc2626)' : 'var(--text)' }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                                  <Icon name={m.icon} size={13}/>{m.label}
                                </button>
                            )}
                          </div>}
                      </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'scheduled' && (
          <div className="k-surface" style={{ padding: 20 }}>
            <div className="k-overline" style={{ marginBottom: 14 }}>Next 7 days</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { when: 'Today, 6:00 PM', name: 'NCR Aging — Stamping Cell', recipients: 2 },
                { when: 'Tomorrow, 7:00 AM', name: 'Daily Quality Brief', recipients: 5 },
                { when: 'Mon Apr 28, 7:00 AM', name: 'Weekly Plant Manager Brief', recipients: 4 },
                { when: 'Wed Apr 30, 9:00 AM', name: 'Supplier Scorecard — Bharat Forge', recipients: 3 },
                { when: 'Fri May 2, 4:00 PM', name: 'Layered Process Audit Compilation', recipients: 6 },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 12, borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 'var(--r-md)', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="clock" size={18}/></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.when} · {s.recipients} recipients</div>
                  </div>
                  <button className="k-btn k-btn-sm k-btn-ghost">Edit</button>
                  <button className="k-btn k-btn-sm k-btn-ghost">Run now</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {toast &&
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--text)', color: 'var(--bg)', padding: '10px 16px', borderRadius: 'var(--r-md)', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, boxShadow: 'var(--shadow-lg)', zIndex: 60 }}>
          <Icon name={runningId ? 'refresh' : 'check'} size={14} stroke={2.5} className={runningId ? 'k-spin' : ''}/>{toast}
        </div>
      }
    </div>
  );
};

const FIELD_LIBRARY = [
  { group: 'Metrics', items: [
    { id: 'ppm', label: 'Defect PPM', type: 'metric', icon: 'hash' },
    { id: 'fpy', label: 'First-Pass Yield', type: 'metric', icon: 'target' },
    { id: 'scrap', label: 'Scrap rate $', type: 'metric', icon: 'pieChart' },
    { id: 'ncrcount', label: 'Open NCR count', type: 'metric', icon: 'alert' },
    { id: 'mttd', label: 'Mean time to detect', type: 'metric', icon: 'clock' },
    { id: 'mttr', label: 'Mean time to resolve', type: 'metric', icon: 'refresh' },
  ]},
  { group: 'Dimensions', items: [
    { id: 'area', label: 'Area / cell', type: 'dim', icon: 'layers' },
    { id: 'product', label: 'Product family', type: 'dim', icon: 'package' },
    { id: 'shift', label: 'Shift', type: 'dim', icon: 'sun' },
    { id: 'supplier', label: 'Supplier', type: 'dim', icon: 'building' },
    { id: 'severity', label: 'Severity', type: 'dim', icon: 'alert' },
  ]},
  { group: 'Visuals', items: [
    { id: 'kpi', label: 'KPI Tile', type: 'viz', icon: 'hash' },
    { id: 'line', label: 'Trend line', type: 'viz', icon: 'lineChart' },
    { id: 'bar', label: 'Bar chart', type: 'viz', icon: 'barChart' },
    { id: 'pie', label: 'Pareto / Pie', type: 'viz', icon: 'pieChart' },
    { id: 'table', label: 'Data table', type: 'viz', icon: 'table' },
    { id: 'heatmap', label: 'Heatmap', type: 'viz', icon: 'grid' },
    { id: 'text', label: 'Text block', type: 'viz', icon: 'type' },
  ]},
];

const ReportBuilder = ({ id, setRoute }) => {
  const [tiles, setTiles] = React.useState(() => ([
    { id: 't1', viz: 'kpi', metric: 'ppm', label: 'Defect PPM', value: '247', delta: '-12%', col: 1, row: 1, w: 1, h: 1 },
    { id: 't2', viz: 'kpi', metric: 'fpy', label: 'First-Pass Yield', value: '94.7%', delta: '+0.8%', col: 2, row: 1, w: 1, h: 1 },
    { id: 't3', viz: 'kpi', metric: 'ncrcount', label: 'Open NCRs', value: '23', delta: '+4', col: 3, row: 1, w: 1, h: 1, danger: true },
    { id: 't4', viz: 'kpi', metric: 'scrap', label: 'Scrap $/unit', value: '$1.42', delta: '-18%', col: 4, row: 1, w: 1, h: 1 },
    { id: 't5', viz: 'line', metric: 'ppm', label: 'Defect PPM trend (90d)', col: 1, row: 2, w: 2, h: 2 },
    { id: 't6', viz: 'bar', metric: 'severity', label: 'NCR by severity', col: 3, row: 2, w: 2, h: 2 },
    { id: 't7', viz: 'table', label: 'Top 5 defect types', col: 1, row: 4, w: 4, h: 1 },
  ]));
  const [draft, setDraft] = React.useState(null);
  const [name, setName] = React.useState(id === 'new' ? 'Untitled report' : (REPORT_TEMPLATES.find(t => t.id === id)?.name || SAVED_REPORTS.find(t => t.id === id)?.name || 'Quality KPI Dashboard'));
  const [editingName, setEditingName] = React.useState(false);
  const [showSchedule, setShowSchedule] = React.useState(false);

  const removeTile = (tid) => setTiles(t => t.filter(x => x.id !== tid));

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)' }}>
      {/* Header */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)' }}>
        <button onClick={() => setRoute('reports')} className="k-btn-icon k-btn-plain"><Icon name="arrowLeft" size={16}/></button>
        {editingName ? (
          <input autoFocus value={name} onChange={e => setName(e.target.value)} onBlur={() => setEditingName(false)} onKeyDown={e => e.key === 'Enter' && setEditingName(false)} className="k-input" style={{ width: 320, height: 32 }}/>
        ) : (
          <div onClick={() => setEditingName(true)} style={{ fontSize: 16, fontWeight: 700, cursor: 'text', display: 'flex', alignItems: 'center', gap: 6 }}>
            {name} <Icon name="edit" size={12} className="" stroke={1.5}/>
          </div>
        )}
        <span className="k-chip" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>Draft · auto-saved</span>
        <div style={{ flex: 1 }}/>
        <Segmented size="sm" value="design" onChange={() => {}} options={[
          { value: 'design', icon: 'edit', label: 'Design' },
          { value: 'preview', icon: 'eye', label: 'Preview' },
          { value: 'data', icon: 'database', label: 'Data' },
        ]}/>
        <button onClick={() => setShowSchedule(true)} className="k-btn k-btn-ghost"><Icon name="clock" size={14}/>Schedule</button>
        <button className="k-btn k-btn-ghost" onClick={() => kToast('Share link copied — view-only access')}><Icon name="users" size={14}/>Share</button>
        <button className="k-btn k-btn-primary" onClick={() => kToast(`Published — “${name}” is live for subscribers`)}><Icon name="check" size={14}/>Publish</button>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Field library */}
        <div style={{ width: 240, borderRight: '1px solid var(--border)', background: 'var(--surface)', overflowY: 'auto', padding: 14 }}>
          <div className="k-overline" style={{ marginBottom: 8 }}>Drag onto canvas</div>
          {FIELD_LIBRARY.map(grp => (
            <div key={grp.group} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>{grp.group}</div>
              {grp.items.map(it => (
                <div key={it.id} draggable onDragStart={e => e.dataTransfer.setData('it', JSON.stringify(it))}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 'var(--r-md)', cursor: 'grab', fontSize: 12, marginBottom: 1 }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Icon name={it.icon} size={13} stroke={1.75}/>
                  <span style={{ flex: 1 }}>{it.label}</span>
                  <Icon name="drag" size={12} stroke={1.5}/>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Canvas */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24, background: 'var(--bg)' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto', background: 'var(--surface)', borderRadius: 'var(--r-xl)', boxShadow: 'var(--shadow-sm)', padding: 24 }}>
            {/* Report header */}
            <div style={{ marginBottom: 18, paddingBottom: 16, borderBottom: '2px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                <Icon name="logo" size={14}/>KAENAL · Reports · {new Date().toLocaleDateString()}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Plant: Pune-1 · Period: Last 90 days · Generated by AI assistant</div>
            </div>

            {/* Filter bar */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {[
                { l: 'Time range', v: 'Last 90 days', icon: 'calendar' },
                { l: 'Plant', v: 'Pune-1', icon: 'building' },
                { l: 'Product family', v: 'All', icon: 'package' },
                { l: 'Shift', v: 'All', icon: 'sun' },
              ].map(f => (
                <div key={f.l} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px', border: '1px solid var(--border)', borderRadius: 'var(--r-full)', fontSize: 12 }}>
                  <Icon name={f.icon} size={11}/>
                  <span style={{ color: 'var(--text-muted)' }}>{f.l}:</span>
                  <strong>{f.v}</strong>
                  <Icon name="chevronDown" size={10}/>
                </div>
              ))}
              <button className="k-btn k-btn-sm k-btn-ghost" onClick={() => kToast('Pick a field to filter by — drag from the library')}><Icon name="plus" size={11}/>Filter</button>
            </div>

            {/* Tile grid */}
            <div
              onDragOver={e => { e.preventDefault(); }}
              onDrop={e => {
                e.preventDefault();
                try {
                  const it = JSON.parse(e.dataTransfer.getData('it'));
                  const newTile = { id: 't' + Date.now(), viz: it.type === 'viz' ? it.id : 'kpi', metric: it.id, label: it.label, value: '—', col: 1, row: 99, w: 2, h: 1 };
                  setTiles(t => [...t, newTile]);
                } catch(err) {}
              }}
              style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
                minHeight: 600, padding: 12, borderRadius: 'var(--r-md)',
                border: '1.5px dashed var(--border)',
              }}>
              {tiles.map(t => (
                <Tile key={t.id} tile={t} onRemove={removeTile}/>
              ))}
            </div>
          </div>
        </div>

        {/* Inspector */}
        <div style={{ width: 280, borderLeft: '1px solid var(--border)', background: 'var(--surface)', overflowY: 'auto', padding: 18 }}>
          <div className="k-overline" style={{ marginBottom: 12 }}>Report properties</div>
          <Field label="Format">
            <Segmented size="sm" value="pdf" onChange={() => {}} options={[{value:'pdf',label:'PDF'},{value:'xlsx',label:'XLSX'},{value:'web',label:'Web'}]}/>
          </Field>
          <Field label="Page size">
            <select className="k-input"><option>A4 portrait</option><option>A4 landscape</option><option>Letter</option></select>
          </Field>
          <Field label="Auto-refresh">
            <Segmented size="sm" value="off" onChange={() => {}} options={[{value:'off',label:'Off'},{value:'1h',label:'1h'},{value:'1d',label:'Daily'}]}/>
          </Field>

          <div className="k-overline" style={{ margin: '20px 0 12px' }}>Branding</div>
          <Field label="Logo">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
              <div style={{ width: 32, height: 32, borderRadius: 'var(--r-sm)', background: '#2563eb', color: 'white', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>P</div>
              <div style={{ flex: 1, fontSize: 12 }}>company-logo.png</div>
              <button className="k-btn-icon k-btn-plain" onClick={() => kToast('Logo options — replace or remove')}><Icon name="more" size={12}/></button>
            </div>
          </Field>
          <Field label="Theme color">
            <div style={{ display: 'flex', gap: 6 }}>
              {['#2563eb', '#0d9488', '#7c3aed', '#dc2626', '#16a34a'].map((c, i) => (
                <div key={c} style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: i === 0 ? '2px solid var(--text)' : '2px solid transparent', outline: '1px solid var(--border)' }}/>
              ))}
            </div>
          </Field>

          <div className="k-overline" style={{ margin: '20px 0 12px' }}>AI assistance</div>
          <button className="k-btn k-btn-ghost" onClick={() => kToast('Executive summary generated — 3-paragraph narrative added')} style={{ width: '100%', justifyContent: 'flex-start', height: 'auto', padding: 10, gap: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 22, height: 22, borderRadius: 'var(--r-sm)', background: 'linear-gradient(135deg, #6366f1, #db2777)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="sparkles" size={11}/></div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Generate executive summary</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>Add a 3-paragraph narrative.</div>
            </div>
          </button>
        </div>
      </div>

      {showSchedule && <ScheduleModal onClose={() => setShowSchedule(false)} reportName={name}/>}
    </div>
  );
};

const Tile = ({ tile, onRemove }) => {
  const span = `span ${tile.w || 1} / span ${tile.h || 1}`;
  return (
    <div style={{
      gridColumn: span, gridRow: tile.h > 1 ? `span ${tile.h}` : 'auto',
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-md)', padding: 12, position: 'relative',
      minHeight: tile.viz === 'kpi' ? 80 : 200,
      display: 'flex', flexDirection: 'column',
    }} className="tile-hover">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{tile.label}</div>
        <button onClick={() => onRemove(tile.id)} style={{ width: 20, height: 20, color: 'var(--text-subtle)', opacity: 0.5 }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = 1} onMouseLeave={(e) => e.currentTarget.style.opacity = 0.5}>
          <Icon name="x" size={11}/>
        </button>
      </div>
      {tile.viz === 'kpi' && (
        <div>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>{tile.value}</div>
          <div style={{ fontSize: 12, color: tile.danger ? 'var(--danger-600)' : 'var(--success-600)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Icon name={tile.delta?.startsWith('-') ? 'arrowUp' : 'arrowDown'} size={11}/>{tile.delta} vs prev
          </div>
        </div>
      )}
      {tile.viz === 'line' && <SparkLine/>}
      {tile.viz === 'bar' && <BarMini/>}
      {tile.viz === 'table' && <MiniTable/>}
      {tile.viz === 'pie' && <PieMini/>}
      {tile.viz === 'heatmap' && <HeatMini/>}
    </div>
  );
};

const SparkLine = () => (
  <svg viewBox="0 0 200 100" preserveAspectRatio="none" style={{ flex: 1, width: '100%' }}>
    <defs>
      <linearGradient id="sparkGr" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25"/><stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/>
      </linearGradient>
    </defs>
    <path d="M0,70 L20,55 L40,62 L60,40 L80,48 L100,30 L120,38 L140,25 L160,28 L180,15 L200,20 L200,100 L0,100 Z" fill="url(#sparkGr)"/>
    <path d="M0,70 L20,55 L40,62 L60,40 L80,48 L100,30 L120,38 L140,25 L160,28 L180,15 L200,20" stroke="var(--accent)" strokeWidth="2" fill="none"/>
  </svg>
);

const BarMini = () => (
  <svg viewBox="0 0 200 100" preserveAspectRatio="none" style={{ flex: 1, width: '100%' }}>
    {[60, 80, 45, 70, 30, 90, 55].map((h, i) => (
      <rect key={i} x={i*28+5} y={100-h} width="22" height={h} rx="2" fill={['#dc2626','#ea580c','#f59e0b','#16a34a','#2563eb','#7c3aed','#0d9488'][i]} fillOpacity="0.85"/>
    ))}
  </svg>
);

const MiniTable = () => (
  <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse', flex: 1 }}>
    <thead><tr style={{ color: 'var(--text-muted)' }}>
      <th style={{ textAlign: 'left', padding: '6px 4px', borderBottom: '1px solid var(--border)' }}>Defect</th>
      <th style={{ textAlign: 'right', padding: '6px 4px', borderBottom: '1px solid var(--border)' }}>Count</th>
      <th style={{ textAlign: 'right', padding: '6px 4px', borderBottom: '1px solid var(--border)' }}>%</th>
    </tr></thead>
    <tbody>
      {[['Weld porosity', 47, 32], ['Dimensional', 38, 26], ['Surface', 24, 16], ['Hardness', 19, 13], ['Coating', 13, 9]].map(([n, c, p]) => (
        <tr key={n}><td style={{ padding: '5px 4px' }}>{n}</td><td style={{ textAlign: 'right' }}>{c}</td><td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{p}%</td></tr>
      ))}
    </tbody>
  </table>
);

const PieMini = () => (
  <svg viewBox="0 0 100 100" style={{ flex: 1 }}>
    <circle cx="50" cy="50" r="40" fill="#16a34a"/>
    <path d="M50,50 L90,50 A40,40 0 0,1 50,90 Z" fill="#dc2626"/>
    <path d="M50,50 L50,90 A40,40 0 0,1 14,67 Z" fill="#f59e0b"/>
    <circle cx="50" cy="50" r="22" fill="var(--surface)"/>
  </svg>
);

const HeatMini = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, flex: 1 }}>
    {Array.from({ length: 28 }).map((_, i) => {
      const v = (Math.sin(i * 1.3) + 1) / 2;
      return <div key={i} style={{ background: `rgba(37,99,235,${0.1 + v * 0.7})`, borderRadius: 2 }}/>;
    })}
  </div>
);

const ScheduleModal = ({ onClose, reportName }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={onClose}>
    <div className="k-surface" onClick={e => e.stopPropagation()} style={{ width: 540, padding: 24, boxShadow: 'var(--shadow-xl)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: 'var(--r-md)', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="clock" size={16}/></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>Schedule report</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{reportName}</div>
        </div>
        <button onClick={onClose} className="k-btn-icon k-btn-plain"><Icon name="x" size={14}/></button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Frequency">
          <Segmented value="weekly" onChange={() => {}} options={[{value:'daily',label:'Daily'},{value:'weekly',label:'Weekly'},{value:'monthly',label:'Monthly'},{value:'quarterly',label:'Qtrly'}]}/>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Day"><select className="k-input"><option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option><option>Friday</option></select></Field>
          <Field label="Time"><input className="k-input" type="time" defaultValue="07:00"/></Field>
        </div>
        <Field label="Recipients">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 8, border: '1px solid var(--border)', borderRadius: 'var(--r-md)', minHeight: 40 }}>
            {['u-david','u-priya','u-sarah','u-marcus'].map(u => (
              <span key={u} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px 4px 4px', background: 'var(--accent-soft)', borderRadius: 'var(--r-full)', fontSize: 12 }}>
                <Avatar user={u} size={18}/>{userById(u)?.name?.split(' ')[0]}
                <button style={{ width: 14, height: 14, color: 'var(--text-muted)' }}><Icon name="x" size={10}/></button>
              </span>
            ))}
            <input placeholder="Add person or email…" style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, minWidth: 120, fontSize: 12 }}/>
          </div>
        </Field>
        <Field label="Delivery channels">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[{l:'Email',i:'mail',on:true},{l:'Slack #quality-ops',i:'plug',on:true},{l:'Microsoft Teams',i:'plug',on:false},{l:'Push to SharePoint',i:'cloud',on:false}].map(c => (
              <label key={c.l} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked={c.on} style={{ accentColor: 'var(--accent)' }}/>
                <Icon name={c.i} size={14}/><span style={{ fontSize: 13 }}>{c.l}</span>
              </label>
            ))}
          </div>
        </Field>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
        <button onClick={onClose} className="k-btn k-btn-ghost">Cancel</button>
        <button onClick={onClose} className="k-btn k-btn-primary"><Icon name="check" size={14}/>Schedule</button>
      </div>
    </div>
  </div>
);

Object.assign(window, { ReportsHub, ReportBuilder });
