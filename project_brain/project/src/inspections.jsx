// Kaenal — Inspections list + detail

const InspectionsList = ({ setRoute, setInspection, openCreate }) => {
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [view, setView] = React.useState('list');
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [extraFilters, setExtraFilters] = React.useState({ risk: 'any', template: 'any', inspector: 'any' });
  const [rows, setRows] = React.useState(INSPECTIONS);
  const [rowMenu, setRowMenu] = React.useState(null); // { id, x, y, reassign } of open menu
  const [toast, setToast] = React.useState(null);
  const filterRef = React.useRef(null);
  const rowMenuRef = React.useRef(null);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  React.useEffect(() => {
    if (!filtersOpen) return;
    const close = (e) => {if (filterRef.current && !filterRef.current.contains(e.target)) setFiltersOpen(false);};
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [filtersOpen]);

  React.useEffect(() => {
    if (!rowMenu) return;
    const close = (e) => {if (rowMenuRef.current && !rowMenuRef.current.contains(e.target)) setRowMenu(null);};
    const onKey = (e) => {if (e.key === 'Escape') setRowMenu(null);};
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {document.removeEventListener('mousedown', close);document.removeEventListener('keydown', onKey);};
  }, [rowMenu]);

  const filtered = rows.filter((i) =>
  (statusFilter === 'all' || i.status === statusFilter) && (
  extraFilters.risk === 'any' || i.risk === extraFilters.risk) && (
  extraFilters.template === 'any' || i.template === extraFilters.template) && (
  extraFilters.inspector === 'any' || i.inspectorId === extraFilters.inspector) && (
  search === '' || i.title.toLowerCase().includes(search.toLowerCase()) || i.id.toLowerCase().includes(search.toLowerCase()))
  );

  const activeFilterCount = (extraFilters.risk !== 'any' ? 1 : 0) + (extraFilters.template !== 'any' ? 1 : 0) + (extraFilters.inspector !== 'any' ? 1 : 0);
  const uniqueTemplates = [...new Set(INSPECTIONS.map((i) => i.template))];
  const uniqueInspectors = [...new Set(INSPECTIONS.map((i) => i.inspectorId))];

  // ——— Row actions ———
  const duplicateInspection = (id) => {
    const src = rows.find((r) => r.id === id);
    if (!src) return;
    const nextNum = Math.max(...rows.map((r) => parseInt(String(r.id).slice(-4), 10) || 0)) + 1;
    const newId = `INS-2026-${String(nextNum).padStart(4, '0')}`;
    const copy = { ...src, id: newId, title: src.title.replace(/\s*\(copy\)$/, '') + ' (copy)', status: 'scheduled', findings: 0, completed: undefined };
    setRows((rs) => {const idx = rs.findIndex((r) => r.id === id);const out = [...rs];out.splice(idx + 1, 0, copy);return out;});
    setToast(`Duplicated → ${newId}`);
  };
  const deleteInspection = (id) => {
    setRows((rs) => rs.filter((r) => r.id !== id));
    setToast(`${id} deleted`);
  };
  const reassignInspection = (id, inspectorId) => {
    setRows((rs) => rs.map((r) => r.id === id ? { ...r, inspectorId } : r));
    setToast(`Reassigned to ${userById(inspectorId).name.split(' ')[0]}`);
  };
  const downloadInspectionPDF = (id) => {
    const insp = rows.find((r) => r.id === id);
    if (!insp) return;
    const u = userById(insp.inspectorId);
    const w = window.open('', '_blank');
    if (!w) {setToast('Allow pop-ups to export PDF');return;}
    w.document.write(`<!doctype html><html><head><title>${insp.id}</title>
      <style>body{font:14px -apple-system,Segoe UI,sans-serif;color:#0f172a;padding:48px;max-width:680px;margin:0 auto}
      h1{font-size:20px;margin:0 0 4px}.id{font:600 12px ui-monospace,monospace;color:#2563eb;letter-spacing:.04em}
      table{width:100%;border-collapse:collapse;margin-top:24px}td{padding:10px 0;border-bottom:1px solid #e2e8f0;font-size:13px}
      td:first-child{color:#64748b;width:160px;text-transform:uppercase;font-size:11px;letter-spacing:.05em}
      .hd{border-bottom:2px solid #0f172a;padding-bottom:16px;margin-bottom:8px}</style></head>
      <body><div class="hd"><div class="id">${insp.id}</div><h1>${insp.title}</h1></div>
      <table>
        <tr><td>Template</td><td>${insp.template}</td></tr>
        <tr><td>Inspector</td><td>${u.name} · ${u.role}</td></tr>
        <tr><td>Status</td><td style="text-transform:capitalize">${insp.status.replace('_', ' ')}</td></tr>
        <tr><td>Risk</td><td style="text-transform:capitalize">${insp.risk}</td></tr>
        <tr><td>Findings</td><td>${insp.findings}</td></tr>
        <tr><td>Due</td><td>${insp.due}</td></tr>
        ${insp.completed ? `<tr><td>Completed</td><td>${insp.completed}</td></tr>` : ''}
      </table>
      <script>window.onload=function(){window.print();}<\/script></body></html>`);
    w.document.close();
    setToast(`Generating PDF — ${insp.id}`);
  };

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }} className="fade-in">
      <PageHeader title="Inspections" description="Manage audits, process checks, and safety walks"
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
                  <button className="k-btn-plain" style={{ fontSize: 11, color: 'var(--text-muted)' }} onClick={() => setExtraFilters({ risk: 'any', template: 'any', inspector: 'any' })}>Reset</button>
                </div>
                <FilterField label="Risk">
                  <select className="k-input" value={extraFilters.risk} onChange={(e) => setExtraFilters((f) => ({ ...f, risk: e.target.value }))}>
                    <option value="any">Any</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </FilterField>
                <FilterField label="Template">
                  <select className="k-input" value={extraFilters.template} onChange={(e) => setExtraFilters((f) => ({ ...f, template: e.target.value }))}>
                    <option value="any">Any</option>
                    {uniqueTemplates.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </FilterField>
                <FilterField label="Inspector">
                  <select className="k-input" value={extraFilters.inspector} onChange={(e) => setExtraFilters((f) => ({ ...f, inspector: e.target.value }))}>
                    <option value="any">Any</option>
                    {uniqueInspectors.map((id) => <option key={id} value={id}>{userById(id).name}</option>)}
                  </select>
                </FilterField>
              </div>
            }
          </div>
          <button className="k-btn k-btn-ghost" onClick={() => downloadInspectionsCSV(filtered)}><Icon name="download" size={14} />Export</button>
          <button className="k-btn k-btn-primary" onClick={() => openCreate && openCreate('inspection')}><Icon name="plus" size={14} />New Inspection</button>
        </>} />
      

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', position: 'relative' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <input className="k-input" placeholder="Search by ID or title…" value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ paddingLeft: 34 }} />
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)', pointerEvents: 'none', display: 'inline-flex' }}>
            <Icon name="search" size={14} />
          </span>
        </div>
        <Segmented value={statusFilter} onChange={setStatusFilter} options={[
        { value: 'all', label: 'All' }, { value: 'scheduled', label: 'Scheduled' },
        { value: 'in_progress', label: 'In Progress' }, { value: 'completed', label: 'Completed' }]
        } />
        <div style={{ marginLeft: 'auto' }}>
          <Segmented value={view} onChange={setView} size="sm" options={[
          { value: 'list', icon: 'list', label: '' }, { value: 'grid', icon: 'grid', label: '' }]
          } />
        </div>
      </div>

      {view === 'list' ?
      <div className="k-surface" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="k-table">
          <thead>
            <tr>
              <th style={{ width: 130 }}>ID</th>
              <th>Title</th>
              <th style={{ width: 160 }}>Template</th>
              <th style={{ width: 140 }}>Inspector</th>
              <th style={{ width: 120 }}>Status</th>
              <th style={{ width: 90 }}>Risk</th>
              <th style={{ width: 80 }}>Findings</th>
              <th style={{ width: 100 }}>Due</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => {
              const u = userById(i.inspectorId);
              const overdue = i.status !== 'completed' && new Date(i.due) < new Date('2026-04-19');
              return (
                <tr key={i.id} style={{ cursor: 'pointer' }} onClick={() => {setInspection(i.id);setRoute('inspection-detail');}}>
                  <td><span className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>{i.id}</span></td>
                  <td style={{ fontWeight: 500 }}>{i.title}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i.template}</td>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar user={u} size={22} /><span style={{ fontSize: 12 }}>{u.name.split(' ')[0]} {u.name.split(' ')[1]?.[0]}.</span></div></td>
                  <td><StatusBadge status={i.status} /></td>
                  <td><RiskBadge risk={i.risk} /></td>
                  <td>{i.findings > 0 ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: i.findings >= 3 ? 'var(--danger-600)' : 'var(--warning-600)', fontWeight: 600, fontSize: 12 }}><Icon name="alert" size={12} />{i.findings}</span> : <span style={{ color: 'var(--text-subtle)' }}>—</span>}</td>
                  <td style={{ color: overdue ? 'var(--danger-600)' : 'var(--text-muted)', fontSize: 12, fontWeight: overdue ? 600 : 400 }}>{i.due}</td>
                  <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'right' }}>
                    <button
                      className="k-btn-plain"
                      style={{ padding: 4, background: rowMenu && rowMenu.id === i.id ? 'var(--bg-subtle)' : 'transparent', borderRadius: 'var(--r-sm)' }}
                      aria-haspopup="menu"
                      aria-expanded={!!(rowMenu && rowMenu.id === i.id)}
                      title="Row actions"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (rowMenu && rowMenu.id === i.id) {setRowMenu(null);return;}
                        const r = e.currentTarget.getBoundingClientRect();
                        setRowMenu({ id: i.id, x: r.right, y: r.bottom + 4 });
                      }}>
                      <Icon name="more" size={16} />
                    </button>
                  </td>
                </tr>);

            })}
          </tbody>
        </table>
      </div> :

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {filtered.map((i) => {
          const u = userById(i.inspectorId);
          const overdue = i.status !== 'completed' && new Date(i.due) < new Date('2026-04-19');
          return (
            <button key={i.id} className="k-surface" onClick={() => {setInspection(i.id);setRoute('inspection-detail');}}
            style={{ padding: 16, textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>{i.id}</span>
                <StatusBadge status={i.status} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, minHeight: 38 }}>{i.title}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{i.template}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <Avatar user={u} size={20} /><span>{u.name}</span>
              </div>
              <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5 }}>
                <RiskBadge risk={i.risk} />
                {i.findings > 0 ?
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: i.findings >= 3 ? 'var(--danger-600)' : 'var(--warning-600)', fontWeight: 600 }}><Icon name="alert" size={12} />{i.findings} findings</span> :
                <span style={{ color: 'var(--text-subtle)' }}>No findings</span>}
                <span style={{ color: overdue ? 'var(--danger-600)' : 'var(--text-muted)', fontWeight: overdue ? 600 : 400, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="calendar" size={11} />{i.due}</span>
              </div>
            </button>);

        })}
      </div>
      }

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
        <span>Showing {filtered.length} of {rows.length} inspections</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="k-btn k-btn-ghost k-btn-sm" disabled style={{ opacity: 0.45, cursor: 'default' }} title="No previous page"><Icon name="chevronLeft" size={12} /></button>
          <button className="k-btn k-btn-primary k-btn-sm" style={{ minWidth: 28 }} aria-current="page" aria-disabled="true">1</button>
          <button className="k-btn k-btn-ghost k-btn-sm" disabled style={{ opacity: 0.45, cursor: 'default' }} title="No next page"><Icon name="chevronRight" size={12} /></button>
        </div>
      </div>

      {rowMenu && (() => {
        const insp = rows.find((x) => x.id === rowMenu.id);
        if (!insp) return null;
        if (rowMenu.reassign) {
          return (
            <div ref={rowMenuRef} role="menu" style={{
              position: 'fixed', top: rowMenu.y, left: rowMenu.x, transform: 'translateX(-100%)', zIndex: 200,
              minWidth: 220, maxHeight: 320, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-lg)', padding: 6,
              display: 'flex', flexDirection: 'column', gap: 1
            }}>
              <button onClick={(e) => {e.stopPropagation();setRowMenu((m) => ({ ...m, reassign: false }));}}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <Icon name="arrowLeft" size={13} />Reassign inspector
              </button>
              <div style={{ height: 1, background: 'var(--border)', margin: '2px 0 4px' }}></div>
              {USERS.filter((u) => /Engineer|Inspector|Manager/.test(u.role)).map((u) =>
              <button key={u.id} role="menuitem"
              onClick={(e) => {e.stopPropagation();reassignInspection(rowMenu.id, u.id);setRowMenu(null);}}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '6px 9px', border: 'none', background: 'transparent', borderRadius: 'var(--r-sm)', cursor: 'pointer', color: 'var(--text)', fontSize: 12.5, textAlign: 'left' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                  <Avatar user={u} size={22} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{u.role}</div>
                  </div>
                  {u.id === insp.inspectorId && <Icon name="check" size={13} stroke={2.25} style={{ color: 'var(--accent)' }} />}
                </button>
              )}
            </div>);

        }
        const items = [
        { label: 'Open inspection', icon: 'eye', onClick: () => {setInspection(rowMenu.id);setRoute('inspection-detail');setRowMenu(null);} },
        { label: 'Edit details', icon: 'edit', onClick: () => {setInspection(rowMenu.id);setRoute('inspection-detail');setRowMenu(null);} },
        { label: 'Download PDF', icon: 'download', onClick: () => {downloadInspectionPDF(rowMenu.id);setRowMenu(null);} },
        { label: 'Duplicate', icon: 'copy', onClick: () => {duplicateInspection(rowMenu.id);setRowMenu(null);} },
        { label: 'Reassign inspector', icon: 'user', onClick: () => setRowMenu((m) => ({ ...m, reassign: true })) }];

        return (
          <div ref={rowMenuRef} role="menu" style={{
            position: 'fixed', top: rowMenu.y, left: rowMenu.x, transform: 'translateX(-100%)', zIndex: 200,
            minWidth: 196, background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-lg)', padding: 6,
            display: 'flex', flexDirection: 'column', gap: 1
          }}>
            <div style={{ padding: '4px 9px 6px', fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{insp.id}</div>
            {items.map((a) =>
            <button key={a.label} role="menuitem"
            onClick={(e) => {e.stopPropagation();a.onClick();}}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '7px 9px', border: 'none', background: 'transparent', borderRadius: 'var(--r-sm)', cursor: 'pointer', color: 'var(--text)', fontSize: 12.5, textAlign: 'left' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <Icon name={a.icon} size={14} stroke={1.75} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{a.label}</span>
                {a.label === 'Reassign inspector' && <Icon name="chevronRight" size={13} style={{ color: 'var(--text-subtle)' }} />}
              </button>
            )}
            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }}></div>
            <button role="menuitem"
            onClick={(e) => {e.stopPropagation();if (window.confirm(`Delete ${insp.id}? This cannot be undone.`)) deleteInspection(rowMenu.id);setRowMenu(null);}}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '7px 9px', border: 'none', background: 'transparent', borderRadius: 'var(--r-sm)', cursor: 'pointer', color: 'var(--danger-600)', fontSize: 12.5, textAlign: 'left', fontWeight: 500 }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(220,38,38,0.08)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <Icon name="trash" size={14} stroke={1.75} style={{ flexShrink: 0 }} />
              Delete
            </button>
          </div>);

      })()}

      {toast &&
      <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--text)', color: 'var(--bg)', padding: '10px 16px', borderRadius: 'var(--r-md)', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, zIndex: 300, boxShadow: 'var(--shadow-lg)', animation: 'slideUpToast 200ms ease-out' }}>
          <Icon name="check" size={14} stroke={2.5} />{toast}
        </div>
      }
    </div>);

};

const InspectionDetail = ({ id, setRoute, setNcr }) => {
  const [tab, setTab] = React.useState('overview');
  const base = INSPECTIONS.find((i) => i.id === id) || INSPECTIONS[0];
  const [insp, setInsp] = React.useState(base);
  React.useEffect(() => {setInsp(INSPECTIONS.find((i) => i.id === id) || INSPECTIONS[0]);}, [id]);
  const [editOpen, setEditOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef(null);
  React.useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e) => {if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);};
    const onEsc = (e) => {if (e.key === 'Escape') setMenuOpen(false);};
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {document.removeEventListener('mousedown', onDocClick);document.removeEventListener('keydown', onEsc);};
  }, [menuOpen]);
  const [form, setForm] = React.useState(base);
  const [toast, setToast] = React.useState(null);
  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);
  const openEdit = () => {setForm(insp);setEditOpen(true);};
  const saveEdit = () => {
    setInsp(form);
    // persist back to the shared dataset so the list reflects the change
    const i = INSPECTIONS.findIndex((x) => x.id === insp.id);
    if (i >= 0) INSPECTIONS[i] = { ...INSPECTIONS[i], ...form };
    setEditOpen(false);
    setToast('Inspection updated');
  };
  const u = userById(insp.inspectorId);
  const template = INSPECTION_TEMPLATE;
  const responses = INSPECTION_RESPONSES;

  return (
    <div style={{ padding: '20px 28px 28px', display: 'flex', flexDirection: 'column', gap: 16 }} className="fade-in">
      <button onClick={() => setRoute('inspections')} className="k-btn-plain" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '4px 0', alignSelf: 'flex-start', color: 'var(--text-muted)' }}>
        <Icon name="arrowLeft" size={14} />Back to Inspections
      </button>

      {/* Header */}
      <div className="k-surface" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{insp.id}</span>
              <StatusBadge status={insp.status} />
              <RiskBadge risk={insp.risk} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: 0, marginBottom: 8 }}>{insp.title}</h1>
            <div style={{ display: 'flex', gap: 18, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Icon name="clipboard" size={13} />{insp.template}</span>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Icon name="mapPin" size={13} />{insp.area}</span>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Avatar user={u} size={16} /> {u.name}</span>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Icon name="calendar" size={13} />Completed {insp.completed || '—'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
            <button className="k-btn k-btn-ghost" onClick={() => downloadInspectionPDFDetail(insp)}><Icon name="download" size={14} />PDF</button>
            <button className="k-btn k-btn-ghost" onClick={openEdit}><Icon name="edit" size={14} />Edit</button>
            <button className="k-btn k-btn-icon k-btn-ghost" aria-haspopup="menu" aria-expanded={menuOpen}
            title="More actions"
            onClick={(e) => {e.stopPropagation();setMenuOpen((v) => !v);}}>
              <Icon name="more" size={16} />
            </button>
            {menuOpen &&
            <div ref={menuRef} role="menu" style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 200,
              minWidth: 208, background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-lg)', padding: 6,
              display: 'flex', flexDirection: 'column', gap: 1
            }}>
                <div style={{ padding: '4px 9px 6px', fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{insp.id}</div>
                {[
              { label: 'Edit details', icon: 'edit', onClick: () => {setMenuOpen(false);openEdit();} },
              { label: 'Download PDF', icon: 'download', onClick: () => {setMenuOpen(false);downloadInspectionPDFDetail(insp);} },
              { label: 'Duplicate', icon: 'copy', onClick: () => {setMenuOpen(false);setToast('Duplicated inspection');} },
              { label: 'Create NCR from findings', icon: 'alert', onClick: () => {setMenuOpen(false);setNcr(FINDINGS[0]?.ncrId || 'NCR-2026-0089');setRoute('ncr-detail');} }].
              map((a) =>
              <button key={a.label} role="menuitem"
              onClick={(e) => {e.stopPropagation();a.onClick();}}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '7px 9px', border: 'none', background: 'transparent', borderRadius: 'var(--r-sm)', cursor: 'pointer', color: 'var(--text)', fontSize: 12.5, textAlign: 'left' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <Icon name={a.icon} size={14} stroke={1.75} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{a.label}</span>
                  </button>
              )}
                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }}></div>
                <button role="menuitem"
              onClick={(e) => {e.stopPropagation();setMenuOpen(false);if (window.confirm(`Delete ${insp.id}? This cannot be undone.`)) {setRoute('inspections');}}}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '7px 9px', border: 'none', background: 'transparent', borderRadius: 'var(--r-sm)', cursor: 'pointer', color: 'var(--danger-600)', fontSize: 12.5, textAlign: 'left', fontWeight: 500 }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(220,38,38,0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                  <Icon name="trash" size={14} stroke={1.75} style={{ flexShrink: 0 }} />
                  Delete
                </button>
              </div>
            }
          </div>
        </div>

        {/* Score bar */}
        {insp.score != null &&
        <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
            <div>
              <div className="k-overline">Overall score</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 24, fontWeight: 700 }} className="mono">{insp.score}</span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>/ 100</span>
              </div>
              <div style={{ height: 6, background: 'var(--bg-subtle)', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${insp.score}%`, background: insp.score >= 90 ? 'var(--success-500)' : insp.score >= 70 ? 'var(--warning-500)' : 'var(--danger-500)' }} />
              </div>
            </div>
            <div>
              <div className="k-overline">Findings</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--danger-600)', marginTop: 4 }} className="mono">{insp.findings}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>2 critical · 1 major</div>
            </div>
            <div>
              <div className="k-overline">Duration</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }} className="mono">2h 15m</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>09:32 → 11:47</div>
            </div>
            <div>
              <div className="k-overline">Linked NCRs</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                {['NCR-2026-0089', 'NCR-2026-0091'].map((n) =>
              <button key={n} onClick={() => {setNcr(n);setRoute('ncr-detail');}}
              style={{ fontSize: 11, padding: '3px 8px', background: 'var(--accent-soft)', color: 'var(--accent)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {n}
                  </button>
              )}
              </div>
            </div>
          </div>
        }
      </div>

      {/* Tabs */}
      <div className="k-tabs">
        {['overview', 'findings', 'media', 'history'].map((t) =>
        <button key={t} className={`k-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
            {t === 'findings' && <span style={{ background: 'var(--danger-100)', color: 'var(--danger-700)', fontSize: 10, padding: '1px 6px', borderRadius: 'var(--r-full)', fontWeight: 700 }}>{FINDINGS.length}</span>}
          </button>
        )}
      </div>

      {tab === 'overview' &&
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {template.sections.map((sec, si) => {
            const passCount = sec.items.filter((it) => responses[it.id]?.value === 'pass' || typeof responses[it.id]?.value === 'number' && responses[it.id].value >= 3).length;
            const failCount = sec.items.filter((it) => responses[it.id]?.value === 'fail').length;
            return (
              <div key={sec.id} className="k-surface" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{si + 1}</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{sec.title}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, fontSize: 12 }}>
                      {failCount > 0 && <span style={{ color: 'var(--danger-600)', fontWeight: 600 }}>{failCount} failed</span>}
                      <span style={{ color: 'var(--text-muted)' }}>{sec.items.length} items</span>
                    </div>
                  </div>
                  <div>
                    {sec.items.map((item, idx) => {
                    const r = responses[item.id] || {};
                    const isPassFail = item.type === 'pass_fail';
                    const passed = r.value === 'pass';
                    const failed = r.value === 'fail';
                    return (
                      <div key={item.id} style={{ padding: '12px 20px', borderBottom: idx < sec.items.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                          <div style={{ color: 'var(--text-subtle)', fontSize: 11, fontFamily: 'var(--font-mono)', width: 24, flexShrink: 0, paddingTop: 2 }}>{idx + 1}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: r.notes ? 6 : 0 }}>
                              {item.label}
                              {item.required && <span style={{ color: 'var(--danger-500)', marginLeft: 4 }}>*</span>}
                            </div>
                            {r.notes &&
                          <div style={{ padding: '8px 10px', background: failed ? 'var(--danger-50)' : 'var(--bg-subtle)', borderRadius: 'var(--r-sm)', fontSize: 12, color: 'var(--text-muted)', borderLeft: failed ? '3px solid var(--danger-500)' : '3px solid var(--border-strong)' }}>
                                {r.notes}
                              </div>
                          }
                            {r.photos > 0 &&
                          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                                {[...Array(r.photos)].map((_, i) =>
                            <div key={i} style={{
                              width: 48, height: 36, borderRadius: 'var(--r-sm)',
                              background: `linear-gradient(135deg, #cbd5e1, #94a3b8)`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: 'white'
                            }}><Icon name="camera" size={14} stroke={1.5} /></div>
                            )}
                              </div>
                          }
                          </div>
                          <div style={{ flexShrink: 0 }}>
                            {isPassFail &&
                          <div style={{ display: 'flex', gap: 4 }}>
                                <div style={{ padding: '6px 10px', borderRadius: 'var(--r-sm)', fontSize: 12, fontWeight: 600, background: passed ? 'var(--success-100)' : 'var(--bg-subtle)', color: passed ? 'var(--success-700)' : 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  {passed && <Icon name="check" size={12} stroke={3} />}<span>Pass</span>
                                </div>
                                <div style={{ padding: '6px 10px', borderRadius: 'var(--r-sm)', fontSize: 12, fontWeight: 600, background: failed ? 'var(--danger-100)' : 'var(--bg-subtle)', color: failed ? 'var(--danger-700)' : 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  {failed && <Icon name="x" size={12} stroke={3} />}<span>Fail</span>
                                </div>
                              </div>
                          }
                            {item.type === 'score' && r.value &&
                          <div style={{ display: 'flex', gap: 2 }}>
                                {[1, 2, 3, 4, 5].map((n) => <div key={n} style={{ width: 14, height: 14, background: n <= r.value ? 'var(--warning-500)' : 'var(--border)', borderRadius: 2 }} />)}
                              </div>
                          }
                            {item.type === 'number' && <span className="mono" style={{ fontSize: 14, fontWeight: 600, color: r.value > 1 ? 'var(--danger-600)' : 'var(--text)' }}>{r.value}%</span>}
                            {item.type === 'textarea' && r.value && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>✎ Written</span>}
                            {item.type === 'photo' && r.photos && <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="camera" size={11} />{r.photos}</span>}
                          </div>
                        </div>);

                  })}
                  </div>
                </div>);

          })}

            {/* Signature */}
            <div className="k-surface" style={{ padding: 20, display: 'flex', gap: 20, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div className="k-overline">Inspector signature</div>
                <div style={{ fontFamily: 'Dancing Script, cursive', fontSize: 30, color: 'var(--accent)', marginTop: 4 }}>Rafael Costa</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Signed 2026-04-15 11:47 · Plant A</div>
              </div>
              <Icon name="shield" size={40} stroke={1.5} className="" />
            </div>
          </div>

          {/* Metadata */}
          <div className="k-surface" style={{ padding: 18, alignSelf: 'flex-start', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <MetaRow label="Status"><StatusBadge status={insp.status} /></MetaRow>
            <MetaRow label="Inspector"><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar user={u} size={22} /><span style={{ fontSize: 13 }}>{u.name}</span></div></MetaRow>
            <MetaRow label="Template"><span style={{ fontSize: 13 }}>{insp.template}</span></MetaRow>
            <MetaRow label="Location"><span style={{ fontSize: 13, display: 'inline-flex', gap: 4, alignItems: 'center' }}><Icon name="mapPin" size={12} />{insp.area}</span></MetaRow>
            <MetaRow label="Scheduled"><span className="mono" style={{ fontSize: 12 }}>2026-04-15 09:00</span></MetaRow>
            <MetaRow label="Started"><span className="mono" style={{ fontSize: 12 }}>2026-04-15 09:32</span></MetaRow>
            <MetaRow label="Completed"><span className="mono" style={{ fontSize: 12 }}>2026-04-15 11:47</span></MetaRow>
            <MetaRow label="Tags">
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {['monthly', 'iatf', 'weld'].map((t) => <span key={t} style={{ fontSize: 11, padding: '2px 8px', background: 'var(--bg-subtle)', borderRadius: 'var(--r-full)', color: 'var(--text-muted)' }}>{t}</span>)}
              </div>
            </MetaRow>
          </div>
        </div>
      }

      {tab === 'findings' &&
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {FINDINGS.map((f, i) => {
          const item = template.sections.flatMap((s) => s.items).find((it) => it.id === f.itemId);
          return (
            <div key={f.id} className="k-surface" style={{ padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{
                  width: 40, height: 40, borderRadius: 'var(--r-md)',
                  background: f.severity === 'critical' ? 'var(--danger-100)' : 'var(--warning-100)',
                  color: f.severity === 'critical' ? 'var(--danger-600)' : 'var(--warning-700)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}><Icon name="alert" size={18} /></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Finding #{i + 1}</span>
                      <RiskBadge risk={f.severity} />
                      {f.ncrId && <button onClick={() => {setNcr(f.ncrId);setRoute('ncr-detail');}} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 600 }}>→ {f.ncrId}</button>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Item: {item?.label}</div>
                    <div style={{ fontSize: 13 }}>{f.observation}</div>
                    {f.photos && <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                      {[...Array(f.photos)].map((_, i) => <div key={i} style={{ width: 64, height: 48, borderRadius: 'var(--r-sm)', background: 'linear-gradient(135deg, #cbd5e1, #64748b)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}><Icon name="camera" size={16} stroke={1.5} /></div>)}
                    </div>}
                  </div>
                </div>
              </div>);

        })}
        </div>
      }

      {tab === 'media' &&
      <div className="k-surface" style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            {[...Array(9)].map((_, i) =>
          <div key={i} style={{ aspectRatio: '4/3', borderRadius: 'var(--r-md)', background: `linear-gradient(135deg, ${['#cbd5e1', '#94a3b8', '#64748b'][i % 3]}, ${['#94a3b8', '#64748b', '#475569'][i % 3]})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexDirection: 'column', gap: 4 }}>
                <Icon name="camera" size={24} stroke={1.5} />
                <span style={{ fontSize: 10, opacity: 0.8 }}>IMG_{String(i + 1).padStart(4, '0')}.jpg</span>
              </div>
          )}
          </div>
        </div>
      }

      {tab === 'history' && <HistoryTimeline />}

      {editOpen &&
      <div onMouseDown={(e) => {if (e.target === e.currentTarget) setEditOpen(false);}}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '8vh 16px' }}>
          <div className="k-surface" style={{ width: 'min(520px, 100%)', padding: 0, boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', maxHeight: '84vh' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div className="mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>{insp.id}</div>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: '2px 0 0' }}>Edit inspection</h2>
              </div>
              <button className="k-btn k-btn-icon k-btn-ghost" onClick={() => setEditOpen(false)} title="Close"><Icon name="x" size={16} /></button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="k-overline">Title</span>
                <input className="k-input" value={form.title || ''} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span className="k-overline">Status</span>
                  <select className="k-input" value={form.status || 'scheduled'} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                    {['scheduled', 'in_progress', 'completed'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span className="k-overline">Risk</span>
                  <select className="k-input" value={form.risk || 'low'} onChange={(e) => setForm((f) => ({ ...f, risk: e.target.value }))}>
                    {['critical', 'high', 'medium', 'low'].map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="k-overline">Area</span>
                <input className="k-input" value={form.area || ''} onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="k-overline">Due date</span>
                <input type="date" className="k-input" value={form.due || ''} onChange={(e) => setForm((f) => ({ ...f, due: e.target.value }))} />
              </label>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="k-btn k-btn-ghost" onClick={() => setEditOpen(false)}>Cancel</button>
              <button className="k-btn k-btn-primary" onClick={saveEdit}><Icon name="check" size={14} />Save changes</button>
            </div>
          </div>
        </div>
      }

      {toast &&
      <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--text)', color: 'var(--bg)', padding: '10px 16px', borderRadius: 'var(--r-md)', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, zIndex: 500, boxShadow: 'var(--shadow-lg)', animation: 'slideUpToast 200ms ease-out' }}>
          <Icon name="check" size={14} stroke={2.5} />{toast}
        </div>
      }
    </div>);

};

const MetaRow = ({ label, children }) =>
<div>
    <div className="k-overline" style={{ marginBottom: 4 }}>{label}</div>
    <div>{children}</div>
  </div>;


const HistoryTimeline = () => {
  const events = [
  { actor: 'u7', text: 'signed and completed inspection', time: '2026-04-15 11:47', icon: 'check', color: 'var(--success-500)' },
  { actor: 'u7', text: 'generated Finding #3 on Station 3B amperage drift', time: '2026-04-15 11:41', icon: 'alert', color: 'var(--danger-500)' },
  { actor: 'u7', text: 'generated Finding #2 on torque wrench calibration', time: '2026-04-15 10:28', icon: 'alert', color: 'var(--warning-500)' },
  { actor: 'u7', text: 'generated Finding #1 on wire feed speed', time: '2026-04-15 10:15', icon: 'alert', color: 'var(--danger-500)' },
  { actor: 'u7', text: 'started inspection', time: '2026-04-15 09:32', icon: 'play', color: 'var(--accent)' },
  { actor: 'u1', text: 'scheduled inspection', time: '2026-04-14 16:05', icon: 'calendar', color: 'var(--text-muted)' }];

  return (
    <div className="k-surface" style={{ padding: 24 }}>
      <div style={{ position: 'relative', paddingLeft: 20 }}>
        <div style={{ position: 'absolute', left: 10, top: 8, bottom: 8, width: 2, background: 'var(--border)' }} />
        {events.map((e, i) => {
          const u = userById(e.actor);
          return (
            <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 18, position: 'relative' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: e.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: -20, flexShrink: 0, zIndex: 2, border: '3px solid var(--surface)' }}>
                <Icon name={e.icon} size={10} stroke={2.5} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13 }}><span style={{ fontWeight: 600 }}>{u.name}</span> <span style={{ color: 'var(--text-muted)' }}>{e.text}</span></div>
                <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{e.time}</div>
              </div>
            </div>);

        })}
      </div>
    </div>);

};

Object.assign(window, { InspectionsList, InspectionDetail, MetaRow, HistoryTimeline });

const FilterField = ({ label, children }) =>
<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span className="k-overline">{label}</span>
    {children}
  </div>;


function downloadInspectionsCSV(rows) {
  const header = ['ID', 'Title', 'Template', 'Inspector', 'Status', 'Risk', 'Findings', 'Due'];
  const data = rows.map((i) => {
    const u = userById(i.inspectorId);
    return [i.id, i.title, i.template, u?.name || '', i.status, i.risk, i.findings, i.due];
  });
  const escape = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = [header, ...data].map((r) => r.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;a.download = `inspections-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}