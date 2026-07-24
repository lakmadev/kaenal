// Kaenal — NCR list (table + kanban) + detail

const NCRList = ({ setRoute, setNcr, openCreate, route = 'ncr' }) => {
  const [view, setView] = React.useState('list');
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [extraFilters, setExtraFilters] = React.useState({ priority: 'any', source: 'any', risk: 'any', owner: 'any' });
  const filterRef = React.useRef(null);
  const ME_ID = 'u2';

  React.useEffect(() => {
    if (!filtersOpen) return;
    const close = (e) => {if (filterRef.current && !filterRef.current.contains(e.target)) setFiltersOpen(false);};
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [filtersOpen]);

  const isMine = route === 'ncr-mine';
  const isOverdue = route === 'ncr-overdue';
  const scoped = NCRS.filter((n) =>
  (!isMine || n.ownerId === ME_ID) && (
  !isOverdue || n.sla === 'breached' || n.sla === 'at_risk')
  );

  const filtered = scoped.filter((n) =>
  (statusFilter === 'all' || n.status === statusFilter) && (
  extraFilters.priority === 'any' || n.priority === extraFilters.priority) && (
  extraFilters.source === 'any' || n.source === extraFilters.source) && (
  extraFilters.risk === 'any' || n.risk === extraFilters.risk) && (
  extraFilters.owner === 'any' || n.ownerId === extraFilters.owner) && (
  search === '' || n.title.toLowerCase().includes(search.toLowerCase()) || n.id.toLowerCase().includes(search.toLowerCase()))
  );

  const activeFilterCount = Object.values(extraFilters).filter((v) => v !== 'any').length;
  const uniqueSources = [...new Set(NCRS.map((n) => n.source))];
  const uniqueOwners = [...new Set(NCRS.map((n) => n.ownerId))];

  const title = isMine ? 'My NCR Assignments' : isOverdue ? 'NCRs — At Risk' : 'Non-Conformities';
  const description = isMine ?
  `Non-conformities assigned to you (${scoped.length})` :
  isOverdue ?
  `${scoped.length} non-conformities with SLA breached or at risk` :
  'Track, investigate, and close quality & safety issues';

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }} className="fade-in">
      <PageHeader title={title} description={description}
      actions={<>
          <div style={{ position: 'relative' }}>
            <button className="k-btn k-btn-ghost" onClick={() => setFiltersOpen((v) => !v)}>
              <Icon name="filter" size={14} />Filters
              {activeFilterCount > 0 && <span style={{ background: 'var(--accent)', color: 'white', fontSize: 10, fontWeight: 700, padding: '0 6px', borderRadius: 'var(--r-full)', minWidth: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{activeFilterCount}</span>}
            </button>
            {filtersOpen &&
            <div ref={filterRef} className="k-surface" style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, padding: 16, minWidth: 280, zIndex: 30, boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Filters</div>
                  <button className="k-btn-plain" style={{ fontSize: 11, color: 'var(--text-muted)' }} onClick={() => setExtraFilters({ priority: 'any', source: 'any', risk: 'any', owner: 'any' })}>Reset</button>
                </div>
                <NcrFilterField label="Priority">
                  <select className="k-input" value={extraFilters.priority} onChange={(e) => setExtraFilters((f) => ({ ...f, priority: e.target.value }))}>
                    <option value="any">Any</option>
                    <option value="critical">Critical</option>
                    <option value="major">Major</option>
                    <option value="minor">Minor</option>
                  </select>
                </NcrFilterField>
                <NcrFilterField label="Risk">
                  <select className="k-input" value={extraFilters.risk} onChange={(e) => setExtraFilters((f) => ({ ...f, risk: e.target.value }))}>
                    <option value="any">Any</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </NcrFilterField>
                <NcrFilterField label="Source">
                  <select className="k-input" value={extraFilters.source} onChange={(e) => setExtraFilters((f) => ({ ...f, source: e.target.value }))}>
                    <option value="any">Any</option>
                    {uniqueSources.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </NcrFilterField>
                <NcrFilterField label="Owner">
                  <select className="k-input" value={extraFilters.owner} onChange={(e) => setExtraFilters((f) => ({ ...f, owner: e.target.value }))}>
                    <option value="any">Any</option>
                    {uniqueOwners.map((id) => <option key={id} value={id}>{userById(id).name}</option>)}
                  </select>
                </NcrFilterField>
              </div>
            }
          </div>
          <button className="k-btn k-btn-ghost" onClick={() => downloadNCRsCSV(filtered)}><Icon name="download" size={14} />Export</button>
          <button className="k-btn k-btn-primary" onClick={() => openCreate && openCreate('ncr')}><Icon name="plus" size={14} />New NCR</button>
        </>} />
      

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', position: 'relative' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <input className="k-input" placeholder="Search NCRs…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 34 }} />
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)', pointerEvents: 'none', display: 'inline-flex' }}><Icon name="search" size={14} /></span>
        </div>
        <Segmented value={statusFilter} onChange={setStatusFilter} options={[
        { value: 'all', label: 'All' }, { value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In Progress' }, { value: 'resolved', label: 'Resolved' }, { value: 'closed', label: 'Closed' }]
        } />
        <div style={{ marginLeft: 'auto' }}>
          <Segmented value={view} onChange={setView} size="sm" options={[
          { value: 'list', icon: 'list', label: '' }, { value: 'kanban', icon: 'layers', label: '' }]
          } />
        </div>
      </div>

      {view === 'list' ?
      <div className="k-surface" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="k-table">
            <thead><tr>
              <th style={{ width: 130 }}>ID</th><th>Title</th>
              <th style={{ width: 110 }}>Source</th>
              <th style={{ width: 90 }}>Priority</th>
              <th style={{ width: 120 }}>Status</th>
              <th style={{ width: 130 }}>Owner</th>
              <th style={{ width: 100 }}>Due</th>
              <th style={{ width: 70 }}>SLA</th>
              <th style={{ width: 90 }}>Linked 8D</th>
            </tr></thead>
            <tbody>
              {filtered.map((n) => {
              const u = userById(n.ownerId);
              const slaColor = n.sla === 'breached' ? 'var(--danger-600)' : n.sla === 'at_risk' ? 'var(--warning-600)' : 'var(--success-600)';
              return (
                <tr key={n.id} style={{ cursor: 'pointer' }} onClick={() => {setNcr(n.id);setRoute('ncr-detail');}}>
                    <td><span className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>{n.id}</span></td>
                    <td style={{ fontWeight: 500, maxWidth: 400 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</div></td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{n.source.replace('_', ' ')}</td>
                    <td><PriorityBadge priority={n.priority} /></td>
                    <td><StatusBadge status={n.status} /></td>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar user={u} size={22} /><span style={{ fontSize: 12 }}>{u.name.split(' ')[0]}</span></div></td>
                    <td style={{ fontSize: 12, color: n.sla === 'breached' ? 'var(--danger-600)' : 'var(--text-muted)', fontWeight: n.sla === 'breached' ? 600 : 400 }}>{n.due}</td>
                    <td><div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: slaColor }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: slaColor }} />
                      {n.sla === 'breached' ? 'Breach' : n.sla === 'at_risk' ? 'At risk' : 'On track'}
                    </div></td>
                    <td>{n.eightDId ? <span className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>{n.eightDId.replace('8D-2026-', '#')}</span> : <span style={{ color: 'var(--text-subtle)' }}>—</span>}</td>
                  </tr>);

            })}
            </tbody>
          </table>
        </div> :

      <Kanban setRoute={setRoute} setNcr={setNcr} scoped={scoped} />
      }
    </div>);

};

const Kanban = ({ setRoute, setNcr, scoped }) => {
  const data = scoped || NCRS;
  const cols = [
  { key: 'open', label: 'Open' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'verified', label: 'Verified' },
  { key: 'closed', label: 'Closed' }];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.length}, minmax(220px, 1fr))`, gap: 12, overflowX: 'auto' }}>
      {cols.map((col) => {
        const items = data.filter((n) => n.status === col.key);
        return (
          <div key={col.key} style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 400 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_STYLES[col.key]?.dot }} />
                <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{col.label}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-subtle)', padding: '1px 7px', borderRadius: 'var(--r-full)' }}>{items.length}</span>
              </div>
              <button className="k-btn-plain" style={{ padding: 2 }}><Icon name="plus" size={14} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((n) => {
                const u = userById(n.ownerId);
                return (
                  <button key={n.id} onClick={() => {setNcr(n.id);setRoute('ncr-detail');}}
                  className="k-surface" style={{ padding: 12, textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{n.id}</span>
                      <PriorityBadge priority={n.priority} />
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.4 }}>{n.title}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                      <Avatar user={u} size={20} />
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="calendar" size={11} />{n.due.slice(5)}</span>
                    </div>
                  </button>);

              })}
            </div>
          </div>);

      })}
    </div>);

};

// —————— NCR Detail ——————

const STATUS_OPTIONS = ['open', 'assigned', 'in_progress', 'resolved', 'verified', 'closed'];
const PRIORITY_OPTIONS = ['minor', 'major', 'critical'];

const NCRDetail = ({ id, setRoute, setNcr, set8d, setInspection }) => {
  const [tab, setTab] = React.useState('details');
  const n = NCRS.find((x) => x.id === id) || NCRS[0];
  const owner = userById(n.ownerId);

  const [statusVal, setStatusVal] = React.useState(n.status);
  const [priorityVal, setPriorityVal] = React.useState(n.priority);
  const [updateOpen, setUpdateOpen] = React.useState(false);
  const [commentOpen, setCommentOpen] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [toast, setToast] = React.useState(null);
  const [comments, setComments] = React.useState([
    { id: 1, user: userById('u1'), text: 'Containment lot ID confirmed against MES — see attached photos.', when: '2h ago' },
    { id: 2, user: userById('u3'), text: 'D4 root-cause walkthrough scheduled tomorrow @ 10:00 with SMT supervisor.', when: '1h ago' }
  ]);

  const updateRef = React.useRef(null);
  React.useEffect(() => { setStatusVal(n.status); setPriorityVal(n.priority); }, [n.id]);
  React.useEffect(() => {
    if (!updateOpen) return;
    const close = (e) => { if (updateRef.current && !updateRef.current.contains(e.target)) setUpdateOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [updateOpen]);
  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const postComment = () => {
    if (!draft.trim()) return;
    setComments((c) => [...c, { id: Date.now(), user: userById('u2'), text: draft.trim(), when: 'just now' }]);
    setDraft('');
    setToast('Comment posted');
  };

  return (
    <div style={{ padding: '20px 28px 28px', display: 'flex', flexDirection: 'column', gap: 16 }} className="fade-in">
      <button onClick={() => setRoute('ncr')} className="k-btn-plain" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '4px 0', alignSelf: 'flex-start', color: 'var(--text-muted)' }}>
        <Icon name="arrowLeft" size={14} />Back to NCRs
      </button>

      <div className="k-surface" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
              <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{n.id}</span>
              <StatusBadge status={statusVal} />
              <PriorityBadge priority={priorityVal} />
              <RiskBadge risk={n.risk} />
              {n.sla === 'at_risk' && <span className="k-chip" style={{ background: 'var(--warning-100)', color: 'var(--warning-700)' }}><Icon name="clock" size={11} />SLA at risk</span>}
              {n.eightDId && <button onClick={() => {set8d(n.eightDId);setRoute('8d-detail');}} style={{ fontSize: 11, padding: '3px 8px', background: 'var(--accent-soft)', color: 'var(--accent)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-mono)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="link" size={11} />{n.eightDId}</button>}
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: 0, marginBottom: 6 }}>{n.title}</h1>
            <div style={{ display: 'flex', gap: 18, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Icon name="mapPin" size={13} />{n.area}</span>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Icon name="calendar" size={13} />Due {n.due}</span>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Icon name="clock" size={13} />Age: {n.age} days</span>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>Source:
                {n.sourceRef ? <button onClick={() => {setInspection(n.sourceRef);setRoute('inspection-detail');}} className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>{n.sourceRef}</button> : <span style={{ textTransform: 'capitalize' }}>{n.source.replace('_', ' ')}</span>}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, position: 'relative' }} ref={updateRef}>
            <button className="k-btn k-btn-ghost" onClick={() => { setCommentOpen((v) => !v); setUpdateOpen(false); }}>
              <Icon name="chat" size={14} />Comment
              <span style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, padding: '0 6px', borderRadius: 'var(--r-full)', minWidth: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{comments.length}</span>
            </button>
            <button className="k-btn k-btn-primary" onClick={() => { setUpdateOpen((v) => !v); setCommentOpen(false); }}>
              <Icon name="edit" size={14} />Update
            </button>
            {updateOpen && (
              <div className="k-surface" style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 30, padding: 14, minWidth: 260, boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Update NCR</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="k-overline">Status</span>
                  <select className="k-input" value={statusVal} onChange={(e) => setStatusVal(e.target.value)}>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="k-overline">Priority</span>
                  <select className="k-input" value={priorityVal} onChange={(e) => setPriorityVal(e.target.value)}>
                    {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 2 }}>
                  <button className="k-btn k-btn-ghost k-btn-sm" onClick={() => { setStatusVal(n.status); setPriorityVal(n.priority); setUpdateOpen(false); }}>Cancel</button>
                  <button className="k-btn k-btn-primary k-btn-sm" onClick={() => { setUpdateOpen(false); setToast('NCR updated · ' + statusVal.replace('_', ' ')); }}>Save changes</button>
                </div>
              </div>
            )}
          </div>
        </div>
        {commentOpen && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="k-overline">Comments · {comments.length}</div>
              <button className="k-btn-plain" style={{ fontSize: 11, color: 'var(--text-muted)' }} onClick={() => setCommentOpen(false)}>Close</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 220, overflowY: 'auto' }}>
              {comments.map((c) => (
                <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <Avatar user={c.user} size={28} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{c.user.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.when}</span>
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.5, marginTop: 2 }}>{c.text}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Avatar user={userById('u2')} size={28} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea className="k-input" rows="2" placeholder="Add a comment… use @ to mention" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postComment(); }} style={{ height: 'auto', padding: 10, resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="k-btn k-btn-ghost k-btn-sm" onClick={() => { setDraft(''); setCommentOpen(false); }}>Cancel</button>
                  <button className="k-btn k-btn-primary k-btn-sm" disabled={!draft.trim()} style={!draft.trim() ? { opacity: 0.5, cursor: 'not-allowed' } : null} onClick={postComment}>Post</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="k-tabs">
        {['details', 'investigation', 'actions', 'history'].map((t) =>
        <button key={t} className={`k-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
        <div>
          {tab === 'details' && <NCRDetails n={n} setRoute={setRoute} setInspection={setInspection} />}
          {tab === 'investigation' && <NCRInvestigation n={n} />}
          {tab === 'actions' && <NCRActions n={n} onToast={setToast} />}
          {tab === 'history' && <HistoryTimeline />}
        </div>
        <div className="k-surface" style={{ padding: 18, alignSelf: 'flex-start', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <MetaRow label="Status"><StatusBadge status={statusVal} /></MetaRow>
          <MetaRow label="Owner"><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar user={owner} size={22} /><span style={{ fontSize: 13 }}>{owner.name}</span></div></MetaRow>
          <MetaRow label="Priority"><PriorityBadge priority={priorityVal} /></MetaRow>
          <MetaRow label="Risk"><RiskBadge risk={n.risk} /></MetaRow>
          <MetaRow label="Category"><span style={{ fontSize: 13 }}>{n.category}</span></MetaRow>
          <MetaRow label="Due date"><span className="mono" style={{ fontSize: 12 }}>{n.due}</span></MetaRow>
          <MetaRow label="SLA">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: n.sla === 'breached' ? 'var(--danger-500)' : n.sla === 'at_risk' ? 'var(--warning-500)' : 'var(--success-500)' }} />
              <span style={{ fontSize: 12, textTransform: 'capitalize' }}>{n.sla.replace('_', ' ')}</span>
            </div>
          </MetaRow>
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--text)', color: 'var(--bg)', padding: '10px 16px', borderRadius: 'var(--r-md)', fontSize: 13, fontWeight: 500, boxShadow: 'var(--shadow-lg)', zIndex: 50, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Icon name="check" size={14} stroke={2.5} />{toast}
        </div>
      )}
    </div>);

};

const NCRDetails = ({ n, setRoute, setInspection }) =>
<div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div className="k-surface" style={{ padding: 20 }}>
      <div className="k-overline" style={{ marginBottom: 8 }}>Description</div>
      <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>{n.description || 'No description provided.'}</p>
    </div>
    {n.sourceRef &&
  <div className="k-surface" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="clipboard" size={18} /></div>
        <div style={{ flex: 1 }}>
          <div className="k-overline">Source</div>
          <div style={{ fontSize: 13, marginTop: 2 }}>Generated from inspection <button className="mono" onClick={() => {setInspection(n.sourceRef);setRoute('inspection-detail');}} style={{ color: 'var(--accent)', fontWeight: 600 }}>{n.sourceRef}</button> — Finding #1</div>
        </div>
      </div>
  }
    <div className="k-surface" style={{ padding: 20 }}>
      <div className="k-overline" style={{ marginBottom: 10 }}>Evidence</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[...Array(3)].map((_, i) =>
      <div key={i} style={{ width: 120, height: 90, borderRadius: 'var(--r-md)', background: `linear-gradient(135deg, #cbd5e1, #64748b)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <Icon name="camera" size={24} stroke={1.5} />
          </div>
      )}
        <div style={{ width: 120, height: 90, borderRadius: 'var(--r-md)', border: '1.5px dashed var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6, color: 'var(--text-muted)' }}>
          <Icon name="paperclip" size={18} />
          <span style={{ fontSize: 11 }}>Attach</span>
        </div>
      </div>
    </div>
    <div className="k-surface" style={{ padding: 20 }}>
      <div className="k-overline" style={{ marginBottom: 10 }}>Impact assessment</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Defect rate</div><div className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger-600)' }}>5.8%</div></div>
        <div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Parts quarantined</div><div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>2,840</div></div>
        <div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cost impact</div><div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>$84k</div></div>
        <div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Regulatory</div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning-700)' }}>IATF gap</div></div>
      </div>
    </div>
  </div>;


const NCRInvestigation = ({ n }) => {
  const [rootCause, setRootCause] = React.useState('Pending — investigation underway via 8D-2026-0015 (currently at D4).');
  const [suggesting, setSuggesting] = React.useState(false);
  const suggest = () => {
    setSuggesting(true);
    setTimeout(() => {
      setRootCause('Solder paste viscosity drift on SMT line 3 caused by ambient humidity excursion (62% RH vs. spec ≤45% RH). Underlying cause: HVAC dehumidifier coil fouled — PM interval was extended in Q3 without verification. Corroborated by 8D-2026-0015 D4 (3 of 5 Whys converge here) and inspection ' + (n.sourceRef || 'INS-2026-0339') + '.');
      setSuggesting(false);
    }, 850);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="k-surface" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Icon name="target" size={18} />
          <div style={{ fontSize: 15, fontWeight: 600 }}>Root cause</div>
          <button className="k-btn k-btn-sm" onClick={suggest} disabled={suggesting} style={{ marginLeft: 'auto', background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(219,39,119,0.15))', color: 'var(--accent)', border: '1px solid var(--border)', opacity: suggesting ? 0.7 : 1, cursor: suggesting ? 'wait' : 'pointer' }}>
            <Icon name="sparkles" size={12} />{suggesting ? 'Thinking…' : 'Suggest with AI'}
          </button>
        </div>
        <textarea className="k-input" rows="3" style={{ height: 'auto', padding: 12 }}
          placeholder="Document the verified root cause…"
          value={rootCause} onChange={(e) => setRootCause(e.target.value)} />
      </div>
      <div className="k-surface" style={{ padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>5 Whys (linked from 8D)</div>
        <FiveWhysInline />
      </div>
    </div>);
};


const NCRActions = ({ n, onToast }) => {
  const groups = [
    { key: 'containment', title: 'Containment Actions', subtitle: 'Immediate — stop the bleed' },
    { key: 'corrective', title: 'Corrective Actions', subtitle: 'Permanent fix' },
    { key: 'preventive', title: 'Preventive Actions', subtitle: 'Prevent recurrence' }
  ];
  const today = new Date().toISOString().slice(0, 10);
  const inDays = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

  const [items, setItems] = React.useState({
    containment: n.containment || [],
    corrective: n.corrective || [],
    preventive: []
  });
  const [adding, setAdding] = React.useState(null);
  const [draft, setDraft] = React.useState({ title: '', owner: 'u2', due: inDays(7) });

  React.useEffect(() => {
    setItems({ containment: n.containment || [], corrective: n.corrective || [], preventive: [] });
    setAdding(null);
  }, [n.id]);

  const startAdd = (key) => {
    setAdding(key);
    setDraft({ title: '', owner: 'u2', due: inDays(7) });
  };
  const submitAdd = () => {
    if (!draft.title.trim()) return;
    setItems((cur) => ({
      ...cur,
      [adding]: [...cur[adding], { id: 'a-' + Date.now(), title: draft.title.trim(), owner: draft.owner, due: draft.due, status: 'pending' }]
    }));
    onToast && onToast('Action added');
    setAdding(null);
  };
  const toggleDone = (groupKey, actionId) => {
    setItems((cur) => ({
      ...cur,
      [groupKey]: cur[groupKey].map((a) => a.id === actionId ? { ...a, status: a.status === 'completed' ? 'pending' : 'completed' } : a)
    }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {groups.map((g) => {
        const list = items[g.key] || [];
        const isAdding = adding === g.key;
        return (
          <div key={g.key} className="k-surface" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{g.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{g.subtitle}</div>
              </div>
              <button className="k-btn k-btn-ghost k-btn-sm" onClick={() => isAdding ? setAdding(null) : startAdd(g.key)}>
                <Icon name={isAdding ? 'x' : 'plus'} size={12} />{isAdding ? 'Cancel' : 'Add'}
              </button>
            </div>
            {isAdding && (
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input className="k-input" autoFocus placeholder="What action will be taken?" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') submitAdd(); if (e.key === 'Escape') setAdding(null); }} />
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                    <span className="k-overline">Owner</span>
                    <select className="k-input" value={draft.owner} onChange={(e) => setDraft((d) => ({ ...d, owner: e.target.value }))}>
                      {USERS.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                    <span className="k-overline">Due</span>
                    <input className="k-input" type="date" value={draft.due} min={today} onChange={(e) => setDraft((d) => ({ ...d, due: e.target.value }))} />
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="k-btn k-btn-ghost k-btn-sm" onClick={() => setAdding(null)}>Cancel</button>
                    <button className="k-btn k-btn-primary k-btn-sm" disabled={!draft.title.trim()} style={!draft.title.trim() ? { opacity: 0.5, cursor: 'not-allowed' } : null} onClick={submitAdd}>Add action</button>
                  </div>
                </div>
              </div>
            )}
            {list.length === 0 && !isAdding ?
              <div style={{ padding: '18px 20px', fontSize: 12, color: 'var(--text-subtle)' }}>No actions yet.</div> :
              list.map((a) => {
                const u = userById(a.owner);
                return (
                  <div key={a.id} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button onClick={() => toggleDone(g.key, a.id)} aria-label={a.status === 'completed' ? 'Mark incomplete' : 'Mark complete'} style={{ width: 20, height: 20, borderRadius: '50%', border: a.status === 'completed' ? 'none' : '2px solid var(--border-strong)', background: a.status === 'completed' ? 'var(--success-500)' : 'transparent', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', padding: 0 }}>
                      {a.status === 'completed' && <Icon name="check" size={12} stroke={3} />}
                    </button>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, textDecoration: a.status === 'completed' ? 'line-through' : 'none', color: a.status === 'completed' ? 'var(--text-muted)' : 'var(--text)' }}>{a.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 10 }}>
                        <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Avatar user={u} size={14} />{u.name}</span>
                        <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Icon name="calendar" size={11} />{a.due}</span>
                      </div>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>);
              })}
          </div>);
      })}
    </div>);
};

const FiveWhysInline = () => {
  const w = EIGHT_D.steps.D4.fiveWhys.filter((x) => x.why);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {w.map((row, i) =>
      <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
          <div style={{ flex: 1, padding: 12, background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>{row.why}</div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>→ {row.answer}</div>
          </div>
        </div>
      )}
    </div>);

};

Object.assign(window, { NCRList, NCRDetail, Kanban, FiveWhysInline });

const NcrFilterField = ({ label, children }) =>
<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span className="k-overline">{label}</span>
    {children}
  </div>;


function downloadNCRsCSV(rows) {
  const header = ['ID', 'Title', 'Source', 'Priority', 'Status', 'Risk', 'Owner', 'Due', 'SLA', 'Linked 8D'];
  const data = rows.map((n) => {
    const u = userById(n.ownerId);
    return [n.id, n.title, n.source, n.priority, n.status, n.risk, u?.name || '', n.due, n.sla, n.eightDId || ''];
  });
  const escape = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = [header, ...data].map((r) => r.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;a.download = `ncrs-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}