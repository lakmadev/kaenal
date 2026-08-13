// Kaenal — App shell: Sidebar, TopBar, and main layout

const NAV = [
{ id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
{ id: 'quicklog', label: 'Quick-Log', icon: 'zap' },
{ id: 'inspections', label: 'Inspections', icon: 'clipboard', badge: 2, children: [
  { id: 'inspections', label: 'All Inspections' },
  { id: 'inspections-templates', label: 'Templates' },
  { id: 'inspections-schedule', label: 'Schedule' },
  { id: 'mobile', label: 'Mobile App' }]
},
{ id: 'ncr', label: 'Non-Conformities', icon: 'alert', badgeAccent: 'danger', badge: 3, children: [
  { id: 'ncr', label: 'All NCRs' },
  { id: 'ncr-mine', label: 'My Assignments' },
  { id: 'ncr-overdue', label: 'Overdue' }]
},
{ id: '8d', label: '8D Reports', icon: 'brain', children: [
  { id: '8d', label: 'Active' },
  { id: '8d-completed', label: 'Completed' },
  { id: '8d-templates', label: 'Templates' }]
},
{ id: 'audits', label: 'Audits', icon: 'audit', children: [
  { id: 'audits', label: 'All Audits' },
  { id: 'audits-mine', label: 'My Audits' },
  { id: 'audits-schedule', label: 'Schedule' }]
},
{ id: 'capa', label: 'CAPA', icon: 'capa', badgeAccent: 'warn', badge: 2, children: [
  { id: 'capa', label: 'All CAPAs' },
  { id: 'capa-mine', label: 'My CAPAs' },
  { id: 'capa-overdue', label: 'At Risk' }]
},
{ id: 'documents', label: 'Documents', icon: 'doc' },
{ id: 'graph', label: 'Knowledge graph', icon: 'gitBranch' },
{ id: 'predictive', label: 'Predictive risk', icon: 'trending' },
{ id: 'pqe', label: 'Quality Engine', icon: 'sparkles', badge: 2, badgeAccent: 'danger' },
{ id: '_divider_supply', divider: true, label: 'Supply chain' },
{ id: 'suppliers', label: 'Suppliers', icon: 'truck', children: [
  { id: 'suppliers', label: 'All suppliers' },
  { id: 'suppliers-scorecards', label: 'Scorecards' },
  { id: 'suppliers-risk', label: 'Risk matrix' }]
},
{ id: 'ppap', label: 'PPAP submissions', icon: 'package' },
{ id: 'scar', label: 'SCAR & chargebacks', icon: 'alert' },
{ id: '_divider_qms', divider: true, label: 'Quality system' },
{ id: 'training', label: 'Training & competency', icon: 'award' },
{ id: 'calibration', label: 'Calibration', icon: 'tool' },
{ id: 'complaints', label: 'Customer complaints', icon: 'chat' },
{ id: 'ecn', label: 'Engineering changes', icon: 'gitBranch' },
{ id: 'risk', label: 'Risk register', icon: 'shield' },
{ id: 'fmea', label: 'FMEA workbench', icon: 'brain' },
{ id: 'spc', label: 'SPC charts', icon: 'reports' },
{ id: 'msa', label: 'MSA / Gauge R&R', icon: 'target' },
{ id: '_divider_platform', divider: true, label: 'Platform' },
{ id: 'ai-governance', label: 'AI Governance', icon: 'sparkles' },
{ id: 'dev-platform', label: 'Developer Platform', icon: 'code' },
{ id: 'multi-tenancy', label: 'Multi-tenancy', icon: 'building' },
{ id: 'pricing', label: 'Plans & add-ons', icon: 'package' },
{ id: 'reports', label: 'Reports', icon: 'reports', children: [
  { id: 'reports', label: 'My Reports' },
  { id: 'reports-dashboards', label: 'Dashboards' },
  { id: 'report-builder', label: 'Builder' }]
},
{ id: 'notifications', label: 'Notifications', icon: 'bell' },
{ id: '_divider2', divider: true, label: 'Design patterns' },
{ id: 'empty-states', label: 'Empty states', icon: 'sparkles' },
{ id: 'skeletons', label: 'Loading skeletons', icon: 'clock' },
{ id: '_divider', divider: true, label: 'External' },
{ id: 'supplier', label: 'Supplier Portal', icon: 'truck', external: true },
{ id: 'pdf-designer', label: 'PDF Templates', icon: 'pen', adminOnly: true }];


// Responsive: true when the viewport is phone/tablet-narrow.
function useIsMobile(bp = 860) {
  const q = `(max-width: ${bp}px)`;
  const [m, setM] = React.useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  React.useEffect(() => {
    const mq = window.matchMedia(q);
    const h = (e) => setM(e.matches);
    setM(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [q]);
  return m;
}

const Sidebar = ({ collapsed: collapsedProp, onToggle, route, setRoute, mobile, open, onClose }) => {
  const [expanded, setExpanded] = React.useState({ inspections: true, ncr: true, '8d': true, audits: true, capa: true, reports: true });
  const ent = useEntitlements();
  const role = useRole();
  const navItems = visibleNav(NAV, role);
  const activeRoot = route.split('/')[0];
  // In the mobile drawer the sidebar is always full-width (never the 72px mini rail).
  const collapsed = mobile ? false : collapsedProp;

  const asideStyle = mobile ? {
    width: 272,
    background: 'var(--sidebar-bg)', color: 'var(--sidebar-fg)',
    display: 'flex', flexDirection: 'column', flexShrink: 0,
    borderRight: '1px solid rgba(255,255,255,0.04)',
    height: '100vh', position: 'fixed', top: 0, left: 0, zIndex: 70,
    transform: open ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform 240ms cubic-bezier(0.4,0,0.2,1)',
    boxShadow: open ? '0 18px 50px rgba(0,0,0,0.45)' : 'none',
  } : {
    width: collapsed ? 72 : 260,
    background: 'var(--sidebar-bg)', color: 'var(--sidebar-fg)',
    display: 'flex', flexDirection: 'column',
    transition: 'width 200ms ease-in-out', flexShrink: 0,
    borderRight: '1px solid rgba(255,255,255,0.04)',
    height: '100vh', alignSelf: 'flex-start', zIndex: 20, overflowY: 'auto',
  };

  return (
    <aside style={asideStyle}>
      {/* Brand */}
      <div style={{ height: 56, display: 'flex', alignItems: 'center', padding: collapsed ? '0' : '0 20px', justifyContent: collapsed ? 'center' : 'flex-start', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ color: 'var(--sidebar-accent)' }}>
          <Icon name="logo" size={26} stroke={1.75} />
        </div>
        {!collapsed &&
        <div style={{ color: 'white', fontWeight: 700, fontSize: 16, letterSpacing: '0.08em' }}>KAENAL</div>
        }
        {mobile &&
        <button onClick={onClose} title="Close menu" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 6, borderRadius: 'var(--r-md)', color: 'rgba(203,213,225,0.8)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
          <Icon name="x" size={18} stroke={2} />
        </button>
        }
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: collapsed ? '12px 8px' : '12px 12px' }}>
        {navItems.map((item) => {
          if (item.divider) {
            if (collapsed) return <div key={item.id} style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '10px 8px' }} />;
            return (
              <div key={item.id} style={{ padding: '14px 12px 6px', fontSize: 10, fontWeight: 700, color: 'rgba(203,213,225,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{item.label}</div>);

          }
          const isActive = activeRoot === item.id;
          const isExpanded = expanded[item.id] && !collapsed && item.children;
          const itemLocked = isRouteLocked(item.id, ent);
          return (
            <div key={item.id}>
              <button
                onClick={() => {
                  if (item.children && !collapsed) setExpanded((e) => ({ ...e, [item.id]: !e[item.id] }));
                  setRoute(item.id);
                }}
                title={collapsed ? item.label : ''}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: 10, padding: collapsed ? '10px 0' : '9px 10px',
                  width: '100%', justifyContent: collapsed ? 'center' : 'flex-start',
                  borderRadius: 'var(--r-md)', marginBottom: 2,
                  color: isActive ? 'var(--sidebar-fg-active)' : 'var(--sidebar-fg)',
                  background: isActive ? 'var(--sidebar-active-bg)' : 'transparent',
                  position: 'relative', fontSize: 13, fontWeight: 500,
                  borderLeft: isActive && !collapsed ? `3px solid var(--sidebar-accent)` : '3px solid transparent',
                  paddingLeft: collapsed ? 0 : 10
                }}
                onMouseEnter={(e) => {if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';}}
                onMouseLeave={(e) => {if (!isActive) e.currentTarget.style.background = 'transparent';}}>

                <Icon name={item.icon} size={18} stroke={1.75} />
                {!collapsed && <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>}
                {!collapsed && item.badge &&
                <span style={{
                  background: item.badgeAccent === 'danger' ? '#dc2626' : 'rgba(255,255,255,0.14)',
                  color: item.badgeAccent === 'danger' ? 'white' : 'var(--sidebar-fg-active)', fontSize: 10, fontWeight: 700,
                  padding: '1px 6px', borderRadius: 'var(--r-full)', minWidth: 18, textAlign: 'center'
                }}>{item.badge}</span>
                }
                {!collapsed && itemLocked &&
                <Icon name="lock" size={12} stroke={2} style={{ color: 'rgba(203,213,225,0.55)' }} title="Add-on — not in your plan" />
                }
                {!collapsed && item.children &&
                <Icon name="chevronDown" size={14} stroke={2} className={isExpanded ? '' : ''} />
                }
              </button>
              {isExpanded && item.children.map((c) =>
              <button key={c.id}
              onClick={() => setRoute(c.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                padding: '7px 12px 7px 42px',
                fontSize: 12.5,
                textAlign: 'left',
                color: route === c.id ? 'var(--sidebar-fg-active)' : 'rgba(203,213,225,0.75)',
                background: route === c.id ? 'rgba(255,255,255,0.04)' : 'transparent',
                borderRadius: 'var(--r-md)',
                marginBottom: 1
              }}
              onMouseEnter={(e) => {if (route !== c.id) e.currentTarget.style.color = 'white';}}
              onMouseLeave={(e) => {if (route !== c.id) e.currentTarget.style.color = 'rgba(203,213,225,0.75)';}}>
                <span style={{ flex: 1 }}>{c.label}</span>
                {isRouteLocked(c.id, ent) && <Icon name="lock" size={11} stroke={2} style={{ color: 'rgba(203,213,225,0.5)' }} />}
              </button>
              )}
            </div>);

        })}
      </nav>

      {/* Bottom */}
      <div style={{ padding: collapsed ? 8 : 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={() => setRoute('settings')}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: collapsed ? '10px 0' : '9px 10px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: 'var(--sidebar-fg)', fontSize: 13, borderRadius: 'var(--r-md)'
          }}>
          <Icon name="settings" size={18} stroke={1.75} />
          {!collapsed && <span>Settings</span>}
        </button>
        {!collapsed &&
        <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--r-md)', fontSize: 11, color: 'rgba(203,213,225,0.7)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="pulse-dot" style={{ background: '#22c55e' }} />
            <span>All systems operational</span>
          </div>
        }
      </div>
    </aside>);

};

const TopBar = ({ onToggleSidebar, breadcrumbs, onToggleTheme, theme, onOpenAI, aiOpen, onOpenCmd, onOpenNotifs, aiProminence, openCreate, liveMode, onToggleLive, onSignOut, setRoute, mobile }) => {
  const [profileOpen, setProfileOpen] = React.useState(false);
  const roleId = useRole();
  const role = roleById(roleId);
  const profileRef = React.useRef(null);
  React.useEffect(() => {
    if (!profileOpen) return;
    const onDocClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setProfileOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [profileOpen]);
  const go = (route) => { setProfileOpen(false); setRoute && setRoute(route); };
  return (
    <header style={{
      height: 56, borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center',
      padding: '0 20px', gap: 16, background: 'var(--surface)',
      position: 'sticky', top: 0, zIndex: 15
    }}>
      <button onClick={onToggleSidebar} className="k-btn-plain" style={{ padding: 8, borderRadius: 'var(--r-md)', display: 'flex' }} title={mobile ? 'Open menu' : 'Toggle sidebar'}>
        <Icon name={mobile ? 'menu' : 'panelLeft'} size={18} stroke={1.75} />
      </button>

      <nav style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, flex: 1, minWidth: 0 }}>
        {breadcrumbs.map((b, i) =>
        <React.Fragment key={i}>
            {i > 0 && <Icon name="chevronRight" size={14} stroke={1.5} className="" />}
            <button onClick={b.route && setRoute ? () => setRoute(b.route) : b.onClick}
          style={{
            color: i === breadcrumbs.length - 1 ? 'var(--text)' : 'var(--text-muted)',
            fontWeight: i === breadcrumbs.length - 1 ? 600 : 400,
            padding: '4px 6px', borderRadius: 'var(--r-sm)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            maxWidth: 280,
            cursor: (b.route && setRoute) || b.onClick ? 'pointer' : 'default'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            {b.label}</button>
          </React.Fragment>
        )}
      </nav>

      <button onClick={onOpenCmd} style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        height: 38, padding: '0 8px 0 14px',
        border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
        background: 'var(--bg-subtle)', color: 'var(--text-muted)',
        fontSize: 13, width: 400, maxWidth: '40vw'
      }}>
        <Icon name="search" size={16} stroke={1.75} />
        <span style={{ flex: 1, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} data-comment-anchor="13e6cc719d-span-224-9">Search inspections, NCRs, 8Ds…</span>
        <kbd style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', padding: '3px 7px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-muted)', flexShrink: 0 }}>⌘K</kbd>
      </button>

      {openCreate && <QuickCreateButton onCreate={openCreate} />}

      {onToggleLive && <LiveModeButton live={liveMode} onToggle={onToggleLive} />}

      {aiProminence !== 'quiet' &&
      <button onClick={onOpenAI} title="AI Assistant"
      style={{
        height: 34, padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: 6,
        background: aiOpen ? 'var(--accent)' : 'var(--accent-soft)',
        color: aiOpen ? 'var(--surface)' : 'var(--text)',
        border: `1px solid ${aiOpen ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--r-md)', fontSize: 13, fontWeight: 500
      }}>
          <Icon name="sparkles" size={15} stroke={2} />
          <span>AI</span>
          {aiProminence === 'front' && <span style={{ fontSize: 10, padding: '1px 5px', background: 'rgba(255,255,255,0.25)', borderRadius: 4, fontWeight: 600 }}>ON</span>}
        </button>
      }

      <button onClick={onOpenNotifs} className="k-btn-icon k-btn-plain" style={{ position: 'relative', borderRadius: 'var(--r-md)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} title="Notifications">
        <Icon name="bell" size={17} stroke={1.75} />
        <span style={{ position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: 'var(--danger-500)', border: '2px solid var(--surface)', color: 'white', fontSize: 9.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>5</span>
      </button>

      <button onClick={onToggleTheme} className="k-btn-icon k-btn-plain" style={{ borderRadius: 'var(--r-md)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} title="Toggle theme">
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} stroke={1.75} />
      </button>

      <div ref={profileRef} style={{ position: 'relative', paddingLeft: 8, borderLeft: '1px solid var(--border)' }}>
        <button
          onClick={() => setProfileOpen(o => !o)}
          aria-haspopup="menu"
          aria-expanded={profileOpen}
          title="Account"
          className="k-btn-plain"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '4px 8px 4px 4px', borderRadius: 'var(--r-md)',
            background: profileOpen ? 'var(--bg-subtle)' : 'transparent',
            border: `1px solid ${profileOpen ? 'var(--border)' : 'transparent'}`,
            cursor: 'pointer'
          }}>
          <Avatar user="u1" size={30} />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, textAlign: 'left' }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Manjunath K.</span>
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{role.label}</span>
          </div>
          <Icon name="chevronDown" size={14} stroke={1.75} style={{ color: 'var(--text-muted)', marginLeft: 2 }} />
        </button>

        {profileOpen && (
          <div role="menu" style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            width: 312,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)',
            boxShadow: '0 12px 32px rgba(15,23,42,0.16), 0 4px 10px rgba(15,23,42,0.06)',
            overflow: 'hidden',
            zIndex: 50
          }}>
            {/* Identity header */}
            <div style={{ padding: '14px 16px 12px', display: 'flex', gap: 12, alignItems: 'center', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
              <Avatar user="u1" size={44} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Manjunath Kumar</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>m.kumar@precision-auto.com</div>
                <div style={{ marginTop: 5, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-soft)', padding: '2px 7px', borderRadius: 999, border: '1px solid var(--border)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: '#16a34a' }}></span>
                  {role.label} · Pune-1
                </div>
              </div>
            </div>

            {/* Quick facts */}
            <div style={{ padding: '10px 16px', fontSize: 11.5, color: 'var(--text-muted)', display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 6, columnGap: 12, borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, color: 'var(--text-muted)' }}>Tenant</div>
                <div style={{ color: 'var(--text)', fontWeight: 500 }}>Precision Auto</div>
              </div>
              <div>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, color: 'var(--text-muted)' }}>Plant</div>
                <div style={{ color: 'var(--text)', fontWeight: 500 }}>Pune-1 (lead)</div>
              </div>
              <div>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, color: 'var(--text-muted)' }}>Open items</div>
                <div style={{ color: 'var(--text)', fontWeight: 500 }}>14 NCRs · 3 CAPAs</div>
              </div>
              <div>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, color: 'var(--text-muted)' }}>MFA</div>
                <div style={{ color: 'var(--text)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="check" size={11} stroke={2.5} style={{ color: '#16a34a' }} /> Enabled
                </div>
              </div>
            </div>

            {/* Menu */}
            <div style={{ padding: 6 }}>
              {[
                { label: 'Your profile', icon: 'user', hint: 'Name, photo, contact info', onClick: () => go('settings') },
                { label: 'Account settings', icon: 'settings', hint: 'Notifications, language, MFA', onClick: () => go('settings') },
                { label: 'My assignments', icon: 'clipboard', hint: '14 open items', onClick: () => go('ncr-mine') },
                { label: 'Keyboard shortcuts', icon: 'command', hint: '⌘K · ⌘I · ⌘D', onClick: () => { setProfileOpen(false); } },
              ].map(item => (
                <button key={item.label} onClick={item.onClick} role="menuitem"
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 'var(--r-sm)',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--text)', textAlign: 'left'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                  <Icon name={item.icon} size={15} stroke={1.75} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500 }}>{item.label}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{item.hint}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Role switcher (demo control — in production the role comes from the session) */}
            <div style={{ borderTop: '1px solid var(--border)', padding: 6 }}>
              <div style={{ padding: '6px 10px 4px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="key" size={11} stroke={2} /> View as role
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '2px 8px 6px' }}>
                {ROLE_ORDER.map(rid => {
                  const r = roleById(rid); const active = rid === roleId;
                  return (
                    <button key={rid} onClick={() => { setRole(rid); }} title={r.desc} role="menuitemradio" aria-checked={active}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px',
                        borderRadius: 'var(--r-full)', cursor: 'pointer', fontSize: 11.5, fontWeight: 600,
                        color: active ? 'white' : 'var(--text)',
                        background: active ? r.color : 'var(--bg-subtle)',
                        border: `1px solid ${active ? r.color : 'var(--border)'}`
                      }}>
                      <span style={{ width: 6, height: 6, borderRadius: 999, background: active ? 'white' : r.color }}></span>
                      {r.short}
                    </button>
                  );
                })}
              </div>
              <div style={{ padding: '0 10px 6px', fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.4 }}>{role.desc}</div>
            </div>

            {/* Workspace switcher */}
            <div style={{ borderTop: '1px solid var(--border)', padding: 6 }}>
              <div style={{ padding: '6px 10px 4px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, color: 'var(--text-muted)' }}>Switch workspace</div>
              {[
                { name: 'Precision Auto', sub: 'Production · 4 plants', active: true },
                { name: 'Precision Auto — Sandbox', sub: 'Test env', active: false },
              ].map(w => (
                <button key={w.name} onClick={() => setProfileOpen(false)} role="menuitem"
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 10px', borderRadius: 'var(--r-sm)',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--text)', textAlign: 'left'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ width: 22, height: 22, borderRadius: 5, background: w.active ? 'var(--accent)' : 'var(--bg-subtle)', color: w.active ? 'white' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, border: '1px solid var(--border)', flexShrink: 0 }}>
                    {w.name.split(' ').map(s => s[0]).slice(0,2).join('')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500 }}>{w.name}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{w.sub}</div>
                  </div>
                  {w.active && <Icon name="check" size={13} stroke={2.25} style={{ color: 'var(--accent)' }} />}
                </button>
              ))}
            </div>

            {/* Sign out */}
            <div style={{ borderTop: '1px solid var(--border)', padding: 6 }}>
              <button onClick={() => { setProfileOpen(false); onSignOut && onSignOut(); }} role="menuitem"
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 'var(--r-sm)',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--danger-500, #dc2626)', textAlign: 'left', fontWeight: 500, fontSize: 12.5
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(220,38,38,0.08)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <Icon name="logOut" size={15} stroke={1.75} />
                <span style={{ flex: 1 }}>Sign out</span>
                <kbd style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', padding: '2px 5px', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)' }}>⇧⌘Q</kbd>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>);

};

const PageHeader = ({ title, description, meta, actions }) =>
<div style={{ padding: '24px 28px 0', display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', margin: 0, marginBottom: 4 }}>{title}</h1>
      {description && <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>{description}</p>}
      {meta}
    </div>
    {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{actions}</div>}
  </div>;


Object.assign(window, { Sidebar, TopBar, PageHeader, NAV, useIsMobile });
