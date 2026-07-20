// Kaenal — Full-page Notifications Center

function NotificationsCenter({ setRoute, setNcr, set8d, setAudit, setCapa, setInspection }) {
  const [notifs, setNotifs] = React.useState(NOTIFICATIONS);
  const [filter, setFilter] = React.useState('all');
  const [category, setCategory] = React.useState('all');
  const [selected, setSelected] = React.useState(new Set());

  const filtered = notifs.filter(n => {
    if (filter === 'unread' && n.read) return false;
    if (filter === 'starred' && !n.starred) return false;
    if (category !== 'all' && n.target.kind !== category) return false;
    return true;
  });

  const unreadCount = notifs.filter(n => !n.read).length;
  const allFiltered = filter === 'all' && category === 'all';

  const markAllRead = () => setNotifs(n => n.map(x => ({ ...x, read: true })));
  const toggleRead = (id) => setNotifs(n => n.map(x => x.id === id ? { ...x, read: !x.read } : x));
  const toggleSelect = (id) => {
    setSelected(s => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelected(new Set(filtered.map(n => n.id)));
  const clearSelection = () => setSelected(new Set());
  const bulkMarkRead = () => {
    setNotifs(n => n.map(x => selected.has(x.id) ? { ...x, read: true } : x));
    clearSelection();
  };
  const bulkDelete = () => {
    setNotifs(n => n.filter(x => !selected.has(x.id)));
    clearSelection();
  };

  const openItem = (target) => {
    if (target.kind === 'ncr') { setNcr(target.id); setRoute('ncr-detail'); }
    else if (target.kind === '8d') { set8d(target.id); setRoute('8d-detail'); }
    else if (target.kind === 'audit') { setAudit(target.id); setRoute('audit-detail'); }
    else if (target.kind === 'capa') { setCapa(target.id); setRoute('capa-detail'); }
    else if (target.kind === 'inspection') { setInspection(target.id); setRoute('inspection-detail'); }
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)' }}>
      {/* Sidebar */}
      <div style={{ width: 240, borderRight: '1px solid var(--border)', background: 'var(--surface)', padding: '20px 0', overflowY: 'auto', flexShrink: 0 }}>
        <div style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Inbox</h2>
          <span className="k-chip" style={{ background: 'var(--accent)', color: 'white' }}>{unreadCount}</span>
        </div>

        <NotifNavItem icon="bell" label="All" count={notifs.length} active={filter === 'all' && category === 'all'}
          onClick={() => { setFilter('all'); setCategory('all'); }}/>
        <NotifNavItem icon="bell" label="Unread" count={unreadCount} active={filter === 'unread'}
          onClick={() => { setFilter('unread'); setCategory('all'); }}/>
        <NotifNavItem icon="star" label="Starred" count={notifs.filter(n => n.starred).length} active={filter === 'starred'}
          onClick={() => { setFilter('starred'); setCategory('all'); }}/>

        <div style={{ padding: '14px 16px 6px', fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>By type</div>
        <NotifNavItem icon="clipboard" label="Inspections" count={notifs.filter(n => n.target.kind === 'inspection').length} active={category === 'inspection'}
          onClick={() => { setCategory('inspection'); setFilter('all'); }}/>
        <NotifNavItem icon="alert" label="NCRs" count={notifs.filter(n => n.target.kind === 'ncr').length} active={category === 'ncr'}
          onClick={() => { setCategory('ncr'); setFilter('all'); }}/>
        <NotifNavItem icon="brain" label="8Ds" count={notifs.filter(n => n.target.kind === '8d').length} active={category === '8d'}
          onClick={() => { setCategory('8d'); setFilter('all'); }}/>
        <NotifNavItem icon="audit" label="Audits" count={notifs.filter(n => n.target.kind === 'audit').length} active={category === 'audit'}
          onClick={() => { setCategory('audit'); setFilter('all'); }}/>
        <NotifNavItem icon="capa" label="CAPAs" count={notifs.filter(n => n.target.kind === 'capa').length} active={category === 'capa'}
          onClick={() => { setCategory('capa'); setFilter('all'); }}/>
        <NotifNavItem icon="doc" label="Documents" count={notifs.filter(n => n.target.kind === 'document').length} active={category === 'document'}
          onClick={() => { setCategory('document'); setFilter('all'); }}/>
        <NotifNavItem icon="award" label="Training" count={notifs.filter(n => n.target.kind === 'training').length} active={category === 'training'}
          onClick={() => { setCategory('training'); setFilter('all'); }}/>

        <div style={{ padding: '16px 16px 0', marginTop: 14, borderTop: '1px solid var(--border)' }}>
          <button onClick={() => setRoute('settings')} className="k-btn k-btn-secondary" style={{ width: '100%', justifyContent: 'flex-start' }}>
            <Icon name="settings" size={13}/> Notification settings
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <PageHeader
          title="Notifications"
          description={`${filtered.length} ${filter === 'unread' ? 'unread' : filter === 'starred' ? 'starred' : 'total'} · ${unreadCount} unread overall`}
          actions={
            <>
              {selected.size > 0 ? (
                <>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selected.size} selected</span>
                  <button onClick={bulkMarkRead} className="k-btn k-btn-secondary"><Icon name="check" size={13}/> Mark read</button>
                  <button onClick={bulkDelete} className="k-btn k-btn-secondary"><Icon name="trash" size={13}/> Delete</button>
                  <button onClick={clearSelection} className="k-btn-plain" style={{ padding: 6 }}><Icon name="x" size={14}/></button>
                </>
              ) : (
                <>
                  <button onClick={markAllRead} className="k-btn k-btn-secondary" disabled={unreadCount === 0}>
                    <Icon name="check" size={13}/> Mark all read
                  </button>
                  <button className="k-btn k-btn-secondary" onClick={() => kToast('Up to date — no new notifications')}><Icon name="refresh" size={13}/> Refresh</button>
                </>
              )}
            </>
          }
        />

        {/* Toolbar */}
        <div style={{ padding: '12px 28px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
            onChange={e => e.target.checked ? selectAll() : clearSelection()}/>
          <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
            <Icon name="search" size={13}/>
            <input className="k-input" placeholder="Search notifications…" style={{ paddingLeft: 32, height: 30, fontSize: 12.5 }}/>
            <span style={{ position: 'absolute', left: 10, top: 8, color: 'var(--text-muted)' }}><Icon name="search" size={13}/></span>
          </div>
          <Segmented size="sm" value="newest" onChange={() => {}} options={[
            { value: 'newest', label: 'Newest' },
            { value: 'priority', label: 'Priority' },
          ]}/>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
              <Icon name="check" size={32}/>
              <div style={{ marginTop: 12, fontSize: 14 }}>You're all caught up</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>No notifications match this filter.</div>
            </div>
          ) : (
            filtered.map(n => (
              <NotifRowFull key={n.id} n={n}
                selected={selected.has(n.id)}
                onSelect={() => toggleSelect(n.id)}
                onClick={() => { toggleRead(n.id); openItem(n.target); }}
                onToggleRead={() => toggleRead(n.id)}
                onStar={() => setNotifs(nn => nn.map(x => x.id === n.id ? { ...x, starred: !x.starred } : x))}
                onDelete={() => setNotifs(nn => nn.filter(x => x.id !== n.id))}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function NotifNavItem({ icon, label, count, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', padding: '8px 16px',
      display: 'flex', alignItems: 'center', gap: 10,
      background: active ? 'var(--accent-soft)' : 'transparent',
      color: active ? 'var(--accent)' : 'var(--text)',
      borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
      border: 'none', textAlign: 'left', cursor: 'pointer',
      fontSize: 13, fontWeight: active ? 600 : 500,
    }}>
      <Icon name={icon} size={14}/>
      <span style={{ flex: 1 }}>{label}</span>
      {count > 0 && <span style={{ fontSize: 11, color: active ? 'var(--accent)' : 'var(--text-muted)' }}>{count}</span>}
    </button>
  );
}

function NotifRowFull({ n, selected, onSelect, onClick, onToggleRead, onStar, onDelete }) {
  const actor = n.actorId ? userById(n.actorId) : null;
  return (
    <div style={{
      padding: '12px 28px', borderBottom: '1px solid var(--border)',
      background: n.read ? 'transparent' : 'rgba(37,99,235,0.04)',
      display: 'flex', alignItems: 'flex-start', gap: 12,
    }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
      onMouseLeave={(e) => e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(37,99,235,0.04)'}
    >
      <input type="checkbox" checked={selected} onChange={onSelect} onClick={e => e.stopPropagation()}/>
      <button onClick={(e) => { e.stopPropagation(); onStar(); }} className="k-btn-plain" style={{ padding: 4, color: n.starred ? '#f59e0b' : 'var(--text-muted)' }}>
        <Icon name="star" size={14}/>
      </button>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {actor ? (
          <Avatar user={actor} size={36}/>
        ) : (
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: n.color + '22', color: n.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={n.icon} size={16}/>
          </div>
        )}
        <div style={{
          position: 'absolute', bottom: -2, right: -2,
          width: 18, height: 18, borderRadius: '50%',
          background: n.color, border: '2px solid var(--surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
        }}>
          <Icon name={n.icon} size={10}/>
        </div>
      </div>
      <div onClick={onClick} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 13.5, fontWeight: n.read ? 500 : 700 }}>{n.title}</span>
          {!n.read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }}/>}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 4 }}>{n.body}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span><Icon name="clock" size={11}/> {n.time}</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>{n.target.id}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={(e) => { e.stopPropagation(); onToggleRead(); }} className="k-btn-plain" style={{ padding: 6 }} title={n.read ? 'Mark unread' : 'Mark read'}>
          <Icon name={n.read ? 'eye' : 'check'} size={14}/>
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="k-btn-plain" style={{ padding: 6 }} title="Delete">
          <Icon name="trash" size={14}/>
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { NotificationsCenter });
