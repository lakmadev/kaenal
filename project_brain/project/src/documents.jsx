// Kaenal — Documents library: folders, versions, approvals, compliance matrix

const FOLDERS = [
  { id: 'all', name: 'All Documents', count: 1247, icon: 'folder' },
  { id: 'qm', name: 'Quality Manual', count: 12, icon: 'shield', color: '#2563eb' },
  { id: 'sop', name: 'SOPs', count: 384, icon: 'fileText', color: '#0d9488' },
  { id: 'wi', name: 'Work Instructions', count: 612, icon: 'tool', color: '#ea580c' },
  { id: 'forms', name: 'Forms & Templates', count: 156, icon: 'clipboard', color: '#7c3aed' },
  { id: 'fmea', name: 'FMEA / Control Plans', count: 41, icon: 'target', color: '#dc2626' },
  { id: 'audit', name: 'Audit Reports', count: 67, icon: 'shieldCheck', color: '#16a34a' },
  { id: 'training', name: 'Training Records', count: 287, icon: 'award', color: '#f59e0b' },
];

const DOCS = [
  { id: 'D-001', name: 'Welding Process Control Plan – Line 3', type: 'pdf', folder: 'fmea', version: '4.2', status: 'approved', owner: 'u-sarah', approver: 'u-priya', updated: '2 days ago', size: '2.4 MB', expires: '2026-09-15', frameworks: ['IATF 16949', 'ISO 9001'], reviews: 3 },
  { id: 'D-002', name: 'CMM Calibration SOP', type: 'pdf', folder: 'sop', version: '7.1', status: 'approved', owner: 'u-marcus', approver: 'u-priya', updated: '5 days ago', size: '892 KB', expires: '2026-12-31', frameworks: ['IATF 16949'], reviews: 2 },
  { id: 'D-003', name: 'Operator WI – Hub Assembly', type: 'docx', folder: 'wi', version: '2.0', status: 'pending', owner: 'u-jorge', approver: 'u-sarah', updated: '6 hours ago', size: '1.1 MB', expires: '2027-03-01', frameworks: ['IATF 16949'], reviews: 1 },
  { id: 'D-004', name: 'Internal Audit Report Q1 2026', type: 'pdf', folder: 'audit', version: '1.0', status: 'approved', owner: 'u-priya', approver: 'u-david', updated: '2 weeks ago', size: '4.7 MB', expires: '—', frameworks: ['IATF 16949', 'ISO 14001'], reviews: 5 },
  { id: 'D-005', name: 'Customer Complaint Form', type: 'docx', folder: 'forms', version: '3.4', status: 'approved', owner: 'u-sarah', approver: 'u-priya', updated: '1 month ago', size: '124 KB', expires: '—', frameworks: ['IATF 16949'], reviews: 0 },
  { id: 'D-006', name: 'Quality Manual', type: 'pdf', folder: 'qm', version: '12.0', status: 'approved', owner: 'u-david', approver: 'u-david', updated: '3 months ago', size: '8.2 MB', expires: '2027-01-01', frameworks: ['IATF 16949', 'ISO 9001', 'ISO 14001'], reviews: 12 },
  { id: 'D-007', name: 'PFMEA – Brake Caliper', type: 'xlsx', folder: 'fmea', version: '6.3', status: 'review', owner: 'u-marcus', approver: 'u-priya', updated: '3 days ago', size: '1.8 MB', expires: '2026-08-20', frameworks: ['IATF 16949'], reviews: 4 },
  { id: 'D-008', name: 'Forklift Operation Training', type: 'pdf', folder: 'training', version: '2.1', status: 'approved', owner: 'u-jorge', approver: 'u-sarah', updated: '1 week ago', size: '3.2 MB', expires: '2026-07-15', frameworks: ['ISO 45001'], reviews: 2 },
  { id: 'D-009', name: 'Supplier Quality Agreement Template', type: 'docx', folder: 'forms', version: '1.5', status: 'draft', owner: 'u-sarah', approver: '—', updated: '4 hours ago', size: '78 KB', expires: '—', frameworks: ['IATF 16949'], reviews: 0 },
  { id: 'D-010', name: 'Heat Treatment Process Spec', type: 'pdf', folder: 'sop', version: '5.0', status: 'approved', owner: 'u-marcus', approver: 'u-priya', updated: '2 months ago', size: '1.4 MB', expires: '2026-06-01', frameworks: ['IATF 16949', 'ISO 9001'], reviews: 3, expiringSoon: true },
  { id: 'D-011', name: 'Visual Inspection WI – Paint', type: 'docx', folder: 'wi', version: '3.2', status: 'approved', owner: 'u-jorge', approver: 'u-priya', updated: '1 week ago', size: '672 KB', expires: '2026-11-30', frameworks: ['IATF 16949'], reviews: 1 },
  { id: 'D-012', name: 'Layered Process Audit Checklist', type: 'xlsx', folder: 'forms', version: '2.0', status: 'approved', owner: 'u-priya', approver: 'u-david', updated: '5 days ago', size: '212 KB', expires: '—', frameworks: ['IATF 16949'], reviews: 2 },
];

const DocsList = ({ setRoute, setDoc, openCreate, onUpload }) => {
  const [folder, _setFolder] = React.useState('all');
  const [view, setView] = React.useState('list'); // list | grid | matrix
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [selected, setSelected] = React.useState(new Set());
  const [smart, setSmart] = React.useState(null);      // expiring | review | starred | recent | null
  const [framework, setFramework] = React.useState(null); // compliance framework filter
  const setFolder = (id) => { _setFolder(id); setSmart(null); setFramework(null); };

  const STARRED = ['D-001', 'D-006', 'D-007', 'D-012'];
  const matchesSmart = (d) => {
    if (!smart) return true;
    if (smart === 'expiring') return d.expires !== '—' && d.expires <= '2026-12-31';
    if (smart === 'review') return d.status === 'review' || d.status === 'pending';
    if (smart === 'starred') return STARRED.includes(d.id);
    if (smart === 'recent') return /hour|day/.test(d.updated);
    return true;
  };

  const filtered = DOCS.filter(d =>
    (folder === 'all' || d.folder === folder) &&
    (statusFilter === 'all' || d.status === statusFilter) &&
    matchesSmart(d) &&
    (!framework || d.frameworks.includes(framework)) &&
    (!search || d.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)' }} className="fade-in">
      {/* Folder sidebar */}
      <div style={{ width: 240, borderRight: '1px solid var(--border)', background: 'var(--surface)', overflowY: 'auto', padding: '16px 12px', flexShrink: 0 }}>
        <div className="k-overline" style={{ padding: '0 8px 8px' }}>Library</div>
        {FOLDERS.map(f => (
          <button key={f.id} onClick={() => setFolder(f.id)} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            width: '100%', padding: '8px 10px',
            borderRadius: 'var(--r-md)',
            background: folder === f.id ? 'var(--accent-soft)' : 'transparent',
            color: folder === f.id ? 'var(--accent)' : 'var(--text)',
            fontSize: 13, fontWeight: 500, marginBottom: 1,
          }}>
            <Icon name={f.icon} size={15} stroke={1.75}/>
            <span style={{ flex: 1, textAlign: 'left' }}>{f.name}</span>
            <span style={{ fontSize: 11, color: 'var(--text-subtle)', fontWeight: 600 }}>{f.count}</span>
          </button>
        ))}

        <div className="k-overline" style={{ padding: '20px 8px 8px' }}>Smart Views</div>
        {[
          { id: 'expiring', label: 'Expiring soon', icon: 'clock', count: 8, color: 'var(--warning-600)' },
          { id: 'review', label: 'Pending my review', icon: 'eye', count: 5, color: 'var(--info-600)' },
          { id: 'starred', label: 'Starred', icon: 'star', count: 12, color: 'var(--warning-500)' },
          { id: 'recent', label: 'Recently viewed', icon: 'history', count: 24, color: 'var(--text-muted)' },
        ].map(s => (
          <button key={s.id} onClick={() => { setSmart(v => v === s.id ? null : s.id); setFramework(null); }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', borderRadius: 'var(--r-md)', fontSize: 13, background: smart === s.id ? 'var(--accent-soft)' : 'transparent', color: smart === s.id ? 'var(--accent)' : 'var(--text)', fontWeight: smart === s.id ? 600 : 400 }}>
            <span style={{ color: smart === s.id ? 'var(--accent)' : s.color }}><Icon name={s.icon} size={14}/></span>
            <span style={{ flex: 1, textAlign: 'left' }}>{s.label}</span>
            <span style={{ fontSize: 11, color: 'var(--text-subtle)', fontWeight: 600 }}>{s.count}</span>
          </button>
        ))}

        <div className="k-overline" style={{ padding: '20px 8px 8px' }}>Compliance</div>
        {['IATF 16949', 'ISO 9001', 'ISO 14001', 'ISO 45001'].map(f => (
          <button key={f} onClick={() => { setFramework(v => v === f ? null : f); setSmart(null); }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', borderRadius: 'var(--r-md)', fontSize: 13, background: framework === f ? 'var(--accent-soft)' : 'transparent', color: framework === f ? 'var(--accent)' : 'var(--text)', fontWeight: framework === f ? 600 : 400 }}>
            <Icon name="shieldCheck" size={14} stroke={1.75}/>
            <span style={{ flex: 1, textAlign: 'left' }}>{f}</span>
          </button>
        ))}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <PageHeader
          title={smart ? ({ expiring: 'Expiring soon', review: 'Pending my review', starred: 'Starred', recent: 'Recently viewed' })[smart] : framework ? framework : (FOLDERS.find(f => f.id === folder)?.name || 'All Documents')}
          subtitle={`${filtered.length} of ${DOCS.length} documents · ${selected.size > 0 ? `${selected.size} selected` : 'Click to preview, dbl-click to open'}`}
          actions={
            <>
              <button onClick={onUpload} className="k-btn k-btn-ghost"><Icon name="upload" size={14}/>Upload</button>
              <button className="k-btn k-btn-primary" onClick={() => openCreate && openCreate('document')}><Icon name="plus" size={14}/>New document</button>
            </>
          }
        />

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
            <Icon name="search" size={14} className="" />
            <input className="k-input" placeholder="Search documents…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 34 }}/>
            <div style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-subtle)', pointerEvents: 'none' }}><Icon name="search" size={14}/></div>
          </div>
          <Segmented size="sm" value={statusFilter} onChange={setStatusFilter} options={[
            { value: 'all', label: 'All' }, { value: 'approved', label: 'Approved' }, { value: 'review', label: 'Review' }, { value: 'pending', label: 'Pending' }, { value: 'draft', label: 'Draft' },
          ]}/>
          <div style={{ flex: 1 }}/>
          <Segmented size="sm" value={view} onChange={setView} options={[
            { value: 'list', icon: 'list' }, { value: 'grid', icon: 'grid' }, { value: 'matrix', icon: 'table' },
          ]}/>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: 'var(--bg)' }}>
          {selected.size > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: 'var(--r-md)', marginBottom: 14, color: 'var(--accent)', fontSize: 13, fontWeight: 500 }}>
              <Icon name="check" size={14}/> {selected.size} selected
              <div style={{ flex: 1 }}/>
              <button className="k-btn k-btn-sm k-btn-ghost" onClick={() => kToast(`Download started — ${selected.size} document${selected.size > 1 ? 's' : ''} (.zip)`)}><Icon name="download" size={12}/>Download</button>
              <button className="k-btn k-btn-sm k-btn-ghost" onClick={() => kToast(`Share link copied for ${selected.size} document${selected.size > 1 ? 's' : ''}`)}><Icon name="users" size={12}/>Share</button>
              <button className="k-btn k-btn-sm k-btn-ghost" onClick={() => kToast('Pick a destination folder to move the selection')}><Icon name="folder" size={12}/>Move</button>
              <button onClick={() => setSelected(new Set())} className="k-btn-icon k-btn-plain"><Icon name="x" size={14}/></button>
            </div>
          )}

          {view === 'list' && (
            <DocList docs={filtered} selected={selected} setSelected={setSelected} setRoute={setRoute} setDoc={setDoc}/>
          )}
          {view === 'grid' && (
            <DocGrid docs={filtered} setRoute={setRoute} setDoc={setDoc}/>
          )}
          {view === 'matrix' && (
            <ComplianceMatrix docs={filtered}/>
          )}
        </div>
      </div>
    </div>
  );
};

const DOC_ICON = { pdf: 'filePdf', docx: 'fileText', xlsx: 'fileXls', img: 'fileImg' };
const DOC_COLOR = { pdf: '#dc2626', docx: '#2563eb', xlsx: '#16a34a', img: '#7c3aed' };

const DocList = ({ docs, selected, setSelected, setRoute, setDoc }) => {
  const toggleAll = (e) => {
    if (e.target.checked) setSelected(new Set(docs.map(d => d.id)));
    else setSelected(new Set());
  };
  const toggle = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="k-surface" style={{ overflow: 'hidden' }}>
      <table className="k-table">
        <thead>
          <tr>
            <th style={{ width: 36 }}><input type="checkbox" onChange={toggleAll} style={{ accentColor: 'var(--accent)' }}/></th>
            <th>Name</th>
            <th style={{ width: 70 }}>Ver.</th>
            <th style={{ width: 110 }}>Status</th>
            <th style={{ width: 130 }}>Owner</th>
            <th style={{ width: 110 }}>Approver</th>
            <th style={{ width: 110 }}>Updated</th>
            <th style={{ width: 110 }}>Expires</th>
            <th style={{ width: 130 }}>Frameworks</th>
            <th style={{ width: 36 }}></th>
          </tr>
        </thead>
        <tbody>
          {docs.map(d => (
            <tr key={d.id} onClick={() => { setDoc(d.id); setRoute('document-detail'); }} style={{ cursor: 'pointer' }}>
              <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={selected.has(d.id)} onChange={() => toggle(d.id)} style={{ accentColor: 'var(--accent)' }}/></td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ color: DOC_COLOR[d.type] }}><Icon name={DOC_ICON[d.type]} size={20} stroke={1.5}/></div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{d.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.id} · {d.size} {d.expiringSoon && <span style={{ color: 'var(--warning-600)', marginLeft: 6, fontWeight: 600 }}>● Expiring</span>}</div>
                  </div>
                </div>
              </td>
              <td className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>v{d.version}</td>
              <td><DocStatus status={d.status}/></td>
              <td><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Avatar user={d.owner} size={22}/><span style={{ fontSize: 12 }}>{userById(d.owner)?.name?.split(' ')[0]}</span></div></td>
              <td style={{ fontSize: 12 }}>{d.approver === '—' ? <span style={{ color: 'var(--text-subtle)' }}>—</span> : <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Avatar user={d.approver} size={22}/><span>{userById(d.approver)?.name?.split(' ')[0]}</span></div>}</td>
              <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.updated}</td>
              <td style={{ fontSize: 12, color: d.expiringSoon ? 'var(--warning-600)' : 'var(--text-muted)', fontWeight: d.expiringSoon ? 600 : 400 }}>{d.expires}</td>
              <td>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {d.frameworks.slice(0, 2).map(f => (
                    <span key={f} className="k-chip" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', fontSize: 10, padding: '2px 6px', height: 18 }}>{f.replace(/IATF |ISO /, '')}</span>
                  ))}
                  {d.frameworks.length > 2 && <span style={{ fontSize: 10, color: 'var(--text-subtle)', alignSelf: 'center' }}>+{d.frameworks.length - 2}</span>}
                </div>
              </td>
              <td onClick={e => e.stopPropagation()}><button className="k-btn-icon k-btn-plain"><Icon name="more" size={14}/></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const DocGrid = ({ docs, setRoute, setDoc }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
    {docs.map(d => (
      <button key={d.id} onClick={() => { setDoc(d.id); setRoute('document-detail'); }}
        className="k-surface" style={{ padding: 16, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 12, transition: 'all 120ms', cursor: 'pointer' }}
        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = 'var(--border)'; }}
      >
        <div style={{ height: 100, background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: DOC_COLOR[d.type] }}>
          <Icon name={DOC_ICON[d.type]} size={42} stroke={1.5}/>
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>v{d.version} · {d.size} · {d.updated}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <DocStatus status={d.status}/>
          <Avatar user={d.owner} size={20}/>
        </div>
      </button>
    ))}
  </div>
);

const ComplianceMatrix = ({ docs }) => {
  const frameworks = ['IATF 16949', 'ISO 9001', 'ISO 14001', 'ISO 45001'];
  const folders = FOLDERS.filter(f => f.id !== 'all');
  return (
    <div className="k-surface" style={{ overflow: 'auto' }}>
      <table className="k-table" style={{ minWidth: 800 }}>
        <thead>
          <tr>
            <th>Document Category</th>
            {frameworks.map(f => <th key={f} style={{ textAlign: 'center', width: 130 }}>{f}</th>)}
            <th style={{ textAlign: 'center', width: 100 }}>Coverage</th>
          </tr>
        </thead>
        <tbody>
          {folders.map(folder => {
            const cat = docs.filter(d => d.folder === folder.id);
            const cov = (fw) => {
              const count = cat.filter(d => d.frameworks.includes(fw)).length;
              return { count, total: cat.length };
            };
            const totalCov = frameworks.reduce((acc, fw) => acc + (cov(fw).count > 0 ? 1 : 0), 0);
            return (
              <tr key={folder.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ color: folder.color, padding: 6, background: folder.color + '15', borderRadius: 'var(--r-sm)' }}><Icon name={folder.icon} size={14}/></div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{folder.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cat.length} docs in this slice</div>
                    </div>
                  </div>
                </td>
                {frameworks.map(fw => {
                  const c = cov(fw);
                  const has = c.count > 0;
                  return (
                    <td key={fw} style={{ textAlign: 'center' }}>
                      {has ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 'var(--r-full)', background: 'var(--success-100)', color: 'var(--success-700)', fontSize: 12, fontWeight: 600 }}>
                          <Icon name="check" size={12} stroke={2.5}/> {c.count}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-subtle)', fontSize: 12 }}>—</span>
                      )}
                    </td>
                  );
                })}
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 60, height: 6, background: 'var(--bg-subtle)', borderRadius: 'var(--r-full)', overflow: 'hidden' }}>
                      <div style={{ width: `${(totalCov/frameworks.length)*100}%`, height: '100%', background: totalCov === frameworks.length ? 'var(--success-500)' : 'var(--accent)', transition: 'all 200ms' }}/>
                    </div>
                    <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{Math.round((totalCov/frameworks.length)*100)}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const DocStatus = ({ status }) => {
  const map = {
    approved: { label: 'Approved', bg: 'var(--success-100)', fg: 'var(--success-700)' },
    review: { label: 'In Review', bg: 'var(--info-50)', fg: 'var(--info-600)' },
    pending: { label: 'Pending', bg: 'var(--warning-100)', fg: 'var(--warning-700)' },
    draft: { label: 'Draft', bg: 'var(--bg-subtle)', fg: 'var(--text-muted)' },
  };
  const s = map[status] || map.draft;
  return <span className="k-chip" style={{ background: s.bg, color: s.fg }}>{s.label}</span>;
};

const DocDetail = ({ id, setRoute }) => {
  const doc = DOCS.find(d => d.id === id) || DOCS[0];
  const [tab, setTab] = React.useState('preview');
  const versions = [
    { v: doc.version, date: doc.updated, by: doc.owner, note: 'Annual revision — updated tolerance bands per CR-2026-018', current: true },
    { v: '4.1', date: '4 months ago', by: 'u-marcus', note: 'Added micrograph criteria for porosity classification' },
    { v: '4.0', date: '11 months ago', by: 'u-sarah', note: 'Initial 4.x release post-FMEA review' },
    { v: '3.7', date: '1 year ago', by: 'u-marcus', note: 'Minor wording cleanup' },
  ];

  return (
    <div className="fade-in">
      <PageHeader
        title={doc.name}
        subtitle={<><span className="mono">{doc.id}</span> · v{doc.version} · {doc.size}</>}
        breadcrumbs={[{ label: 'Documents', onClick: () => setRoute('documents') }]}
        actions={
          <>
            <DocStatus status={doc.status}/>
            <button className="k-btn k-btn-ghost" onClick={() => kToast(`Download started — ${doc.name}.${doc.type}`)}><Icon name="download" size={14}/>Download</button>
            <button className="k-btn k-btn-ghost" onClick={() => kToast('Share link copied to clipboard')}><Icon name="users" size={14}/>Share</button>
            <button className="k-btn k-btn-primary" onClick={() => kToast(`Checked out for editing — v${doc.version} locked`)}><Icon name="edit" size={14}/>Edit</button>
          </>
        }
      />

      <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        <div className="k-surface" style={{ overflow: 'hidden' }}>
          <div className="k-tabs" style={{ padding: '0 16px' }}>
            <button className={`k-tab ${tab==='preview'?'active':''}`} onClick={() => setTab('preview')}><Icon name="eye" size={13}/>Preview</button>
            <button className={`k-tab ${tab==='versions'?'active':''}`} onClick={() => setTab('versions')}><Icon name="history" size={13}/>Versions <span style={{ fontSize: 10, padding: '1px 6px', background: 'var(--bg-subtle)', borderRadius: 'var(--r-full)', marginLeft: 4 }}>{versions.length}</span></button>
            <button className={`k-tab ${tab==='approvals'?'active':''}`} onClick={() => setTab('approvals')}><Icon name="shieldCheck" size={13}/>Approvals</button>
            <button className={`k-tab ${tab==='links'?'active':''}`} onClick={() => setTab('links')}><Icon name="link" size={13}/>Linked records</button>
          </div>

          <div style={{ padding: 20 }}>
            {tab === 'preview' && (
              <div style={{ background: '#f3f4f6', borderRadius: 'var(--r-lg)', minHeight: 480, padding: 32, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: 'white', padding: 32, borderRadius: 4, boxShadow: 'var(--shadow-sm)', maxWidth: 700, margin: '0 auto', width: '100%' }}>
                  <div style={{ borderBottom: '2px solid #1f2937', paddingBottom: 12, marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#1f2937' }}>{doc.name}</div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Document {doc.id} · Revision {doc.version} · Effective: {doc.updated}</div>
                    </div>
                    <div style={{ width: 50, height: 50, background: '#1f2937', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, borderRadius: 4 }}>P</div>
                  </div>
                  <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 0 }}>1. Purpose</h3>
                    <p>This control plan defines the inspection methodology and acceptance criteria for the welding process used in production of brake hub assemblies on Line 3, in accordance with IATF 16949:2016 §8.5.1.</p>
                    <h3 style={{ fontSize: 14, fontWeight: 700 }}>2. Scope</h3>
                    <p>Applies to all weld operations performed on stations W-301, W-302, and W-303, including operator setup, in-process inspection, and end-of-line CMM verification.</p>
                    <h3 style={{ fontSize: 14, fontWeight: 700 }}>3. Critical Characteristics</h3>
                    <ul style={{ paddingLeft: 18 }}>
                      <li>Weld penetration depth: 4.5 ± 0.3 mm</li>
                      <li>Visual: no porosity exceeding ASTM E390 grade 3</li>
                      <li>Tensile strength: ≥ 480 MPa per AWS D1.1</li>
                    </ul>
                    <div style={{ display: 'flex', gap: 6, marginTop: 16, padding: '8px 12px', background: '#fef3c7', borderRadius: 4, fontSize: 11 }}>
                      <Icon name="alert" size={12}/> This is a controlled document. Printed copies are uncontrolled. Verify revision before use.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'versions' && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {versions.map((v, i) => (
                  <div key={v.v} style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: i < versions.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        padding: '4px 10px', borderRadius: 'var(--r-sm)',
                        background: v.current ? 'var(--accent)' : 'var(--bg-subtle)',
                        color: v.current ? 'white' : 'var(--text-muted)',
                        fontWeight: 700, fontSize: 12, fontFamily: 'var(--font-mono)',
                      }}>v{v.v}</div>
                      {i < versions.length - 1 && <div style={{ flex: 1, width: 2, background: 'var(--border)' }}/>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Avatar user={v.by} size={20}/>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{userById(v.by)?.name}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· {v.date}</span>
                        {v.current && <span className="k-chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>Current</span>}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{v.note}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button className="k-btn k-btn-sm k-btn-ghost"><Icon name="eye" size={11}/>View</button>
                        <button className="k-btn k-btn-sm k-btn-ghost"><Icon name="copy" size={11}/>Compare to current</button>
                        {!v.current && <button className="k-btn k-btn-sm k-btn-ghost"><Icon name="refresh" size={11}/>Restore</button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'approvals' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { stage: 'Author', user: 'u-sarah', status: 'done', date: '4 days ago', label: 'Drafted' },
                  { stage: 'Tech Reviewer', user: 'u-marcus', status: 'done', date: '3 days ago', label: 'Reviewed — comments resolved' },
                  { stage: 'Quality Manager', user: 'u-priya', status: 'done', date: '2 days ago', label: 'Approved with e-signature' },
                  { stage: 'Plant Director', user: 'u-david', status: 'pending', date: 'Awaiting', label: 'Pending plant-level sign-off' },
                ].map((a, i, arr) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: a.status === 'done' ? 'var(--success-50)' : a.status === 'pending' ? 'var(--warning-50)' : 'var(--surface)' }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: a.status === 'done' ? 'var(--success-500)' : a.status === 'pending' ? 'var(--warning-500)' : 'var(--bg-subtle)',
                      color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon name={a.status === 'done' ? 'check' : 'clock'} size={14} stroke={2.5}/>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{a.stage}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Avatar user={a.user} size={16}/> {userById(a.user)?.name} · {a.label}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.date}</div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'links' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { type: 'NCR', id: 'NCR-2026-0142', label: 'Linked from non-conformity', icon: 'alert' },
                  { type: '8D', id: '8D-2026-0015', label: 'Cited as containment WI', icon: 'brain' },
                  { type: 'Inspection', id: 'INS-2026-0342', label: 'Used as inspection reference', icon: 'clipboard' },
                  { type: 'Audit', id: 'AUD-2026-Q1', label: 'Sampled in internal audit', icon: 'shieldCheck' },
                ].map(l => (
                  <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
                    <Icon name={l.icon} size={16}/>
                    <div style={{ flex: 1 }}>
                      <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{l.id}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>{l.label}</span>
                    </div>
                    <button className="k-btn k-btn-sm k-btn-ghost">Open <Icon name="arrowRight" size={11}/></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Side */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="k-surface" style={{ padding: 16 }}>
            <div className="k-overline" style={{ marginBottom: 12 }}>Properties</div>
            <PropRow label="Owner"><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Avatar user={doc.owner} size={20}/>{userById(doc.owner)?.name}</div></PropRow>
            <PropRow label="Type">{doc.type.toUpperCase()}</PropRow>
            <PropRow label="Folder">{FOLDERS.find(f => f.id === doc.folder)?.name}</PropRow>
            <PropRow label="Version" mono>v{doc.version}</PropRow>
            <PropRow label="Updated">{doc.updated}</PropRow>
            <PropRow label="Expires" warn={doc.expiringSoon}>{doc.expires}</PropRow>
            <PropRow label="Reviews">{doc.reviews}</PropRow>
          </div>
          <div className="k-surface" style={{ padding: 16 }}>
            <div className="k-overline" style={{ marginBottom: 12 }}>Compliance</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {doc.frameworks.map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--success-50)', borderRadius: 'var(--r-sm)', fontSize: 12 }}>
                  <Icon name="shieldCheck" size={13}/>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="k-surface" style={{ padding: 16 }}>
            <div className="k-overline" style={{ marginBottom: 12 }}>AI Insights</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: 10, background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(219,39,119,0.06))', borderRadius: 'var(--r-md)' }}>
              <div style={{ width: 22, height: 22, borderRadius: 'var(--r-sm)', background: 'linear-gradient(135deg, #6366f1, #db2777)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="sparkles" size={11}/></div>
              <div style={{ fontSize: 12, lineHeight: 1.5 }}>This document expires in <strong>72 days</strong>. Two referenced standards have updates pending. <a href="#" className="k-link">Schedule revision →</a></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PropRow = ({ label, children, mono, warn }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
    <span style={{ color: 'var(--text-muted)' }}>{label}</span>
    <span className={mono ? 'mono' : ''} style={{ fontWeight: 500, color: warn ? 'var(--warning-700)' : 'var(--text)' }}>{children}</span>
  </div>
);

Object.assign(window, { DocsList, DocDetail });
