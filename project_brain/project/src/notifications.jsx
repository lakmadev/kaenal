// Kaenal — Notifications panel + Cmd+K command palette

function NotificationsPanel({ open, onClose, onOpenItem, onSeeAll }) {
  const [notifs, setNotifs] = React.useState(NOTIFICATIONS);
  const [filter, setFilter] = React.useState('all');

  const filtered = notifs.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'mentions') return n.type === 'mention';
    if (filter === 'assigned') return n.type === 'assignment' || n.type === 'approval';
    return true;
  });

  const unreadCount = notifs.filter(n => !n.read).length;
  const markAllRead = () => setNotifs(n => n.map(x => ({ ...x, read: true })));
  const toggleRead = (id) => setNotifs(n => n.map(x => x.id === id ? { ...x, read: !x.read } : x));

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 99 }}/>
      <div style={{
        position: 'fixed', top: 56, right: 18, width: 420,
        maxHeight: 'calc(100vh - 80px)', overflowY: 'auto',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        boxShadow: '0 10px 40px rgba(15,23,42,0.18), 0 4px 12px rgba(15,23,42,0.08)',
        zIndex: 100, display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="bell" size={16}/>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Notifications</h3>
            {unreadCount > 0 && (
              <span style={{ background: '#dc2626', color: 'white', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10 }}>{unreadCount}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={markAllRead} className="k-btn-plain" style={{ fontSize: 11.5, color: 'var(--accent)', padding: '4px 8px' }}>Mark all read</button>
            <button onClick={onClose} className="k-btn-plain" style={{ padding: 4 }}><Icon name="x" size={14}/></button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ padding: '10px 16px 0', display: 'flex', gap: 4 }}>
          {[
            { id: 'all', label: 'All' },
            { id: 'unread', label: `Unread (${unreadCount})` },
            { id: 'mentions', label: 'Mentions' },
            { id: 'assigned', label: 'Assigned' },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              style={{
                padding: '4px 10px', fontSize: 11.5, fontWeight: 500,
                borderRadius: 'var(--r-sm)',
                background: filter === f.id ? 'var(--accent-soft)' : 'transparent',
                color: filter === f.id ? 'var(--accent)' : 'var(--text-muted)',
                border: 'none', cursor: 'pointer',
              }}>{f.label}</button>
          ))}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {filtered.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              <Icon name="check" size={28}/>
              <div style={{ marginTop: 8 }}>You're all caught up</div>
            </div>
          )}
          {filtered.map(n => (
            <NotificationRow key={n.id} n={n}
              onClick={() => { toggleRead(n.id); onOpenItem(n.target); onClose(); }}
              onToggleRead={() => toggleRead(n.id)}/>
          ))}
        </div>

        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={onSeeAll} className="k-btn-plain" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
            See all notifications →
          </button>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{notifs.length} total</span>
        </div>
      </div>
    </>
  );
}

function NotificationRow({ n, onClick, onToggleRead }) {
  const actor = n.actorId ? userById(n.actorId) : null;
  return (
    <div onClick={onClick} style={{
      padding: '12px 16px', borderLeft: n.read ? '3px solid transparent' : `3px solid ${n.color}`,
      background: n.read ? 'transparent' : 'var(--accent-soft)',
      cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start',
      transition: 'background 120ms',
    }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
      onMouseLeave={(e) => e.currentTarget.style.background = n.read ? 'transparent' : 'var(--accent-soft)'}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {actor ? (
          <Avatar user={actor} size={32}/>
        ) : (
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: n.color + '22', color: n.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={n.icon} size={15}/>
          </div>
        )}
        <div style={{
          position: 'absolute', bottom: -2, right: -2,
          width: 16, height: 16, borderRadius: '50%',
          background: n.color, border: '2px solid var(--surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
        }}>
          <Icon name={n.icon} size={9}/>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: n.read ? 500 : 600, marginBottom: 2, lineHeight: 1.35 }}>{n.title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: 4 }}>{n.body}</div>
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{n.time}</div>
      </div>
      {!n.read && (
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: n.color, marginTop: 6, flexShrink: 0 }}/>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMMAND PALETTE — fuzzy search across entities + quick actions
// ─────────────────────────────────────────────────────────────
function CommandPalette({ open, onClose, onCreate, setRoute, setNcr, set8d, setInspection, setAudit, setCapa, onToggleTheme, onOpenAI }) {
  const [query, setQuery] = React.useState('');
  const [selectedIdx, setSelectedIdx] = React.useState(0);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    if (open) {
      setQuery(''); setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Build searchable index
  const allItems = React.useMemo(() => {
    const items = [];
    // Quick actions
    QUICK_ACTIONS.forEach(a => items.push({ ...a, search: a.label.toLowerCase() }));
    // NCRs
    NCRS.slice(0, 12).forEach(n => items.push({
      id: 'ncr-' + n.id, kind: 'entity', entityType: 'ncr',
      label: n.title, sublabel: n.id, icon: 'alert',
      search: (n.id + ' ' + n.title + ' ncr').toLowerCase(),
      action: () => { setNcr(n.id); setRoute('ncr-detail'); },
    }));
    // 8Ds
    EIGHT_D_LIST.forEach(d => items.push({
      id: '8d-' + d.id, kind: 'entity', entityType: '8d',
      label: d.title, sublabel: d.id, icon: 'brain',
      search: (d.id + ' ' + d.title + ' 8d').toLowerCase(),
      action: () => { set8d(d.id); setRoute('8d-detail'); },
    }));
    // Inspections
    INSPECTIONS.slice(0, 8).forEach(ins => items.push({
      id: 'ins-' + ins.id, kind: 'entity', entityType: 'inspection',
      label: ins.title, sublabel: ins.id, icon: 'clipboard',
      search: (ins.id + ' ' + ins.title + ' inspection').toLowerCase(),
      action: () => { setInspection && setInspection(ins.id); setRoute('inspection-detail'); },
    }));
    // Audits
    AUDITS.forEach(a => items.push({
      id: 'aud-' + a.id, kind: 'entity', entityType: 'audit',
      label: a.title, sublabel: a.id, icon: 'audit',
      search: (a.id + ' ' + a.title + ' audit').toLowerCase(),
      action: () => { setAudit && setAudit(a.id); setRoute('audit-detail'); },
    }));
    // CAPAs
    CAPAS.forEach(c => items.push({
      id: 'capa-' + c.id, kind: 'entity', entityType: 'capa',
      label: c.title, sublabel: c.id, icon: 'capa',
      search: (c.id + ' ' + c.title + ' capa').toLowerCase(),
      action: () => { setCapa && setCapa(c.id); setRoute('capa-detail'); },
    }));
    return items;
  }, []);

  const results = React.useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) {
      // show defaults: top quick actions + recent
      return allItems.filter(i => i.kind === 'action' || i.kind === 'nav').slice(0, 12);
    }
    return allItems.filter(i => i.search.includes(q)).slice(0, 30);
  }, [query, allItems]);

  // Group results
  const grouped = React.useMemo(() => {
    const groups = { action: [], nav: [], entity: [] };
    results.forEach(r => {
      const key = r.kind || 'entity';
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    return groups;
  }, [results]);

  const flatResults = [...(grouped.action || []), ...(grouped.nav || []), ...(grouped.entity || [])];

  const runItem = (item) => {
    if (item.action) {
      if (typeof item.action === 'function') {
        item.action();
      } else if (item.action.startsWith('create:')) {
        onCreate(item.action.slice(7));
      } else if (item.action === 'toggle:theme') {
        onToggleTheme && onToggleTheme();
      } else if (item.action === 'open:ai') {
        onOpenAI && onOpenAI();
      } else if (item.action === 'auth:signout') {
        localStorage.removeItem('k_signed_in');
        window.location.reload();
      }
    } else if (item.route) {
      setRoute(item.route);
    }
    onClose();
  };

  const handleKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, flatResults.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); flatResults[selectedIdx] && runItem(flatResults[selectedIdx]); }
    if (e.key === 'Escape') onClose();
  };

  if (!open) return null;

  let runningIdx = -1;
  const renderGroup = (label, items) => {
    if (!items || items.length === 0) return null;
    return (
      <div key={label}>
        <div style={{ padding: '8px 16px 4px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em' }}>{label}</div>
        {items.map(item => {
          runningIdx++;
          const isSelected = runningIdx === selectedIdx;
          const myIdx = runningIdx;
          return (
            <button key={item.id}
              onClick={() => runItem(item)}
              onMouseEnter={() => setSelectedIdx(myIdx)}
              style={{
                width: '100%', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12,
                background: isSelected ? 'var(--accent-soft)' : 'transparent',
                border: 'none', textAlign: 'left', cursor: 'pointer',
                color: isSelected ? 'var(--accent)' : 'var(--text)',
              }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6,
                background: isSelected ? 'var(--accent)' : 'var(--bg-subtle)',
                color: isSelected ? 'white' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={item.icon} size={14}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</div>
                {item.sublabel && (
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{item.sublabel}</div>
                )}
              </div>
              {item.shortcut && (
                <div style={{ display: 'flex', gap: 2, fontSize: 10, fontFamily: 'var(--font-mono)' }}>
                  <kbd style={{ padding: '2px 5px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 3 }}>⌘</kbd>
                  <kbd style={{ padding: '2px 5px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 3 }}>{item.shortcut}</kbd>
                </div>
              )}
              {!item.shortcut && <Icon name="arrowRight" size={14} className=""/>}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)', zIndex: 200 }}/>
      <div style={{
        position: 'fixed', top: '15vh', left: '50%', transform: 'translateX(-50%)',
        width: 'min(640px, 92vw)', background: 'var(--surface)',
        border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
        boxShadow: '0 25px 50px rgba(15,23,42,0.25)',
        zIndex: 201, display: 'flex', flexDirection: 'column', maxHeight: '70vh',
      }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="search" size={18} className=""/>
          <input ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
            onKeyDown={handleKey}
            placeholder="Search NCRs, 8Ds, audits, CAPAs · or run a command…"
            style={{
              flex: 1, fontSize: 16, border: 'none', outline: 'none', background: 'transparent',
              color: 'var(--text)', padding: '4px 0',
            }}/>
          <kbd style={{ fontSize: 10, fontFamily: 'var(--font-mono)', padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-subtle)' }}>ESC</kbd>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0 8px' }}>
          {flatResults.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No results for "{query}"
            </div>
          )}
          {renderGroup('Quick actions', grouped.action)}
          {renderGroup('Navigation', grouped.nav)}
          {renderGroup('Records', grouped.entity)}
        </div>

        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, color: 'var(--text-muted)' }}>
          <span><kbd style={kbdStyle}>↑</kbd><kbd style={kbdStyle}>↓</kbd> navigate</span>
          <span><kbd style={kbdStyle}>↵</kbd> select</span>
          <span><kbd style={kbdStyle}>esc</kbd> close</span>
          <span style={{ marginLeft: 'auto' }}>{flatResults.length} results</span>
        </div>
      </div>
    </>
  );
}

const kbdStyle = {
  fontFamily: 'var(--font-mono)', fontSize: 10,
  padding: '1px 5px', border: '1px solid var(--border)',
  borderRadius: 3, background: 'var(--bg-subtle)', marginRight: 3,
};

Object.assign(window, { NotificationsPanel, CommandPalette });
