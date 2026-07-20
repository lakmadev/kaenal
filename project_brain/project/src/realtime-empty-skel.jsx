// Kaenal — Real-time live toast simulation
// Simulates a WebSocket feed: when "live mode" is enabled, periodic toasts
// surface NCRs, SPC alarms, inspections, approvals, etc.

const LIVE_EVENTS = [
  {
    kind: 'ncr', icon: 'alert', color: '#dc2626',
    title: 'Critical NCR assigned to you',
    body: 'NCR-2026-0145 — Weld penetration OOS on Line 2',
    actor: 'u3', actorAction: 'opened by Rafael Costa',
    cta: 'View NCR', target: { kind: 'ncr', id: 'NCR-2026-0145' },
  },
  {
    kind: 'spc', icon: 'alert', color: '#ea580c',
    title: 'SPC out-of-control signal',
    body: 'Line 3 / weld penetration — 7 consecutive points above mean',
    actor: null, actorAction: 'Hexagon CMM integration',
    cta: 'Open SPC', target: { kind: 'inspection', id: 'INS-2026-0341' },
  },
  {
    kind: '8d', icon: 'brain', color: '#7c3aed',
    title: 'D4 root cause approved',
    body: '8D-2026-0015 — Anna Schmidt approved D4 root cause analysis',
    actor: 'u2', actorAction: 'approved D4',
    cta: 'Open 8D', target: { kind: '8d', id: '8D-2026-0015' },
  },
  {
    kind: 'inspection', icon: 'clipboard', color: '#2563eb',
    title: 'Inspection completed',
    body: 'Daily Safety Walk — Line 2 finished by Jorge Martinez — 18 items pass',
    actor: 'u5', actorAction: 'completed inspection',
    cta: 'View', target: { kind: 'inspection', id: 'INS-2026-0341' },
  },
  {
    kind: 'capa', icon: 'capa', color: '#f59e0b',
    title: 'CAPA due in 3 days',
    body: 'CAPA-2026-0042 — Closed-loop SPC implementation — verification phase',
    actor: null, actorAction: 'SLA reminder',
    cta: 'Open CAPA', target: { kind: 'capa', id: 'CAPA-2026-0042' },
  },
  {
    kind: 'document', icon: 'doc', color: '#0d9488',
    title: 'Approval requested',
    body: 'Welding Process Control Plan v4.3 — needs your sign-off',
    actor: 'u4', actorAction: 'requested approval',
    cta: 'Review', target: { kind: 'document', id: 'D-001' },
  },
  {
    kind: 'mention', icon: 'mail', color: '#2563eb',
    title: '@you on 8D-2026-0015',
    body: 'Anna Schmidt: "Can you sanity-check the 5 Whys before we move to D5?"',
    actor: 'u2', actorAction: 'mentioned you',
    cta: 'Reply', target: { kind: '8d', id: '8D-2026-0015' },
  },
  {
    kind: 'audit', icon: 'audit', color: '#16a34a',
    title: 'Audit finding resolved',
    body: 'AUD-2026-0021 §8.5.1 — closed-loop SPC verified effective',
    actor: 'u1', actorAction: 'closed finding',
    cta: 'Open audit', target: { kind: 'audit', id: 'AUD-2026-0021' },
  },
];

function LiveToastProvider({ enabled, onOpenTarget }) {
  const [toasts, setToasts] = React.useState([]);
  const idCounter = React.useRef(0);

  React.useEffect(() => {
    if (!enabled) return;
    // Fire first toast quickly so user sees it
    const first = setTimeout(() => {
      fireToast();
    }, 2200);
    const interval = setInterval(fireToast, 13000); // every 13s
    return () => { clearTimeout(first); clearInterval(interval); };
  }, [enabled]);

  const fireToast = () => {
    const event = LIVE_EVENTS[Math.floor(Math.random() * LIVE_EVENTS.length)];
    const id = ++idCounter.current;
    const toast = { ...event, id, t: 'just now' };
    setToasts(prev => [toast, ...prev].slice(0, 3));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 7500);
  };

  const dismiss = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  if (!enabled || toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 300,
      display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none',
    }}>
      {toasts.map(t => {
        const actor = t.actor ? (window.userById?.(t.actor) || null) : null;
        return (
          <div key={t.id} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderLeft: `4px solid ${t.color}`,
            borderRadius: 'var(--r-md)', padding: 14, width: 380,
            boxShadow: '0 10px 30px rgba(15,23,42,0.18), 0 4px 12px rgba(15,23,42,0.08)',
            pointerEvents: 'auto',
            animation: 'k-toast-in 280ms cubic-bezier(0.16, 1, 0.3, 1)',
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: t.color + '20', color: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
              <Icon name={t.icon} size={15}/>
              <span style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: '50%', background: '#22c55e', border: '2px solid var(--surface)' }}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>{t.title}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>· just now</span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t.body}</div>
              <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => { onOpenTarget?.(t.target); dismiss(t.id); }} style={{
                  fontSize: 11.5, fontWeight: 600, color: 'var(--accent)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                }}>
                  {t.cta} →
                </button>
                <div style={{ flex: 1 }}/>
                {actor && <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)' }}>
                  <span style={{ width: 14, height: 14, borderRadius: '50%', background: actor.color, color: 'white', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{actor.initials}</span>
                  <span>{actor.name.split(' ')[0]}</span>
                </div>}
              </div>
            </div>
            <button onClick={() => dismiss(t.id)} className="k-btn-plain" style={{ padding: 4, marginLeft: -4, color: 'var(--text-muted)' }}>
              <Icon name="x" size={12}/>
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes k-toast-in {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function LiveModeButton({ live, onToggle }) {
  return (
    <button onClick={onToggle} title={live ? 'Live mode on — receiving real-time updates' : 'Enable live mode'} style={{
      height: 34, padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: 6,
      background: live ? 'rgba(34,197,94,0.10)' : 'transparent',
      color: live ? '#16a34a' : 'var(--text-muted)',
      border: `1px solid ${live ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
      borderRadius: 'var(--r-md)', fontSize: 12, fontWeight: 500, cursor: 'pointer',
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: live ? '#22c55e' : '#94a3b8',
        animation: live ? 'k-live-pulse 1.6s ease-in-out infinite' : 'none',
        boxShadow: live ? '0 0 0 0 rgba(34,197,94,0.4)' : 'none',
      }}/>
      <span>{live ? 'Live' : 'Live mode'}</span>
      <style>{`
        @keyframes k-live-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
          50% { box-shadow: 0 0 0 6px rgba(34,197,94,0); }
        }
      `}</style>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// EMPTY STATES
// ─────────────────────────────────────────────────────────────
function EmptyState({ icon = 'doc', illustration, title, description, primaryAction, secondaryAction, examples, tone = 'default' }) {
  const toneColor = tone === 'success' ? '#22c55e' : tone === 'warn' ? '#f59e0b' : 'var(--accent)';
  return (
    <div style={{ padding: '60px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', maxWidth: 540, margin: '0 auto' }}>
      <div style={{ marginBottom: 22 }}>
        {illustration ? illustration : (
          <div style={{
            width: 88, height: 88, borderRadius: '50%',
            background: `linear-gradient(135deg, ${toneColor}18, ${toneColor}08)`,
            border: `1px solid ${toneColor}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: toneColor,
          }}>
            <Icon name={icon} size={36} stroke={1.5}/>
          </div>
        )}
      </div>
      <h2 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.01em' }}>{title}</h2>
      <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0, marginBottom: 22 }}>{description}</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
        {primaryAction && <button onClick={primaryAction.onClick} className="k-btn k-btn-primary">
          {primaryAction.icon && <Icon name={primaryAction.icon} size={14}/>}
          {primaryAction.label}
        </button>}
        {secondaryAction && <button onClick={secondaryAction.onClick} className="k-btn k-btn-secondary">
          {secondaryAction.icon && <Icon name={secondaryAction.icon} size={14}/>}
          {secondaryAction.label}
        </button>}
      </div>

      {examples && examples.length > 0 && (
        <div style={{ width: '100%', padding: 18, background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)', textAlign: 'left' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Try these to get started</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {examples.map((ex, i) => (
              <button key={i} onClick={ex.onClick} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
                fontSize: 12.5, textAlign: 'left', cursor: 'pointer',
              }}>
                <Icon name={ex.icon || 'sparkles'} size={13} style={{ color: toneColor }}/>
                <span style={{ flex: 1 }}>{ex.label}</span>
                <Icon name="arrowRight" size={12} style={{ color: 'var(--text-muted)' }}/>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Empty states gallery — a route to showcase all empty-state patterns
function EmptyStatesGallery({ setRoute, openCreate }) {
  const variants = [
    {
      title: 'No NCRs yet',
      description: "When your team flags a non-conformity, it'll appear here. You can also import from your existing system.",
      icon: 'alert',
      primaryAction: { label: 'New NCR', icon: 'plus', onClick: () => openCreate?.('ncr') },
      secondaryAction: { label: 'Import from CSV', icon: 'upload', onClick: () => {} },
      examples: [
        { label: 'Walk through the NCR lifecycle (60s)', icon: 'sparkles' },
        { label: 'Import sample data', icon: 'upload' },
        { label: 'See an example NCR', icon: 'eye' },
      ],
    },
    {
      title: "You're all caught up",
      description: 'No open inspections in your queue. Schedule a recurring inspection or browse the templates library to get started.',
      icon: 'check', tone: 'success',
      primaryAction: { label: 'New inspection', icon: 'plus', onClick: () => openCreate?.('inspection') },
      secondaryAction: { label: 'Browse templates', icon: 'clipboard', onClick: () => setRoute('inspections-templates') },
    },
    {
      title: 'No 8D in progress',
      description: 'Start an 8D when an NCR needs deep root cause work, or convert an existing NCR. Templates are tuned per industry.',
      icon: 'brain',
      primaryAction: { label: 'Start an 8D', icon: 'plus', onClick: () => openCreate?.('8d') },
      secondaryAction: { label: '8D templates', icon: 'copy', onClick: () => setRoute('8d-templates') },
    },
    {
      title: 'No documents in this folder',
      description: 'Drag-drop files here, paste from clipboard, or sync from SharePoint. We OCR and AI-summarize on upload.',
      icon: 'doc',
      primaryAction: { label: 'Upload files', icon: 'upload', onClick: () => {} },
      secondaryAction: { label: 'Sync SharePoint', icon: 'plug', onClick: () => setRoute('settings') },
    },
    {
      title: 'No data yet for this dashboard',
      description: 'Once you have at least 7 days of inspection data, charts and trends will appear here.',
      icon: 'reports', tone: 'warn',
      secondaryAction: { label: 'Add sample data', icon: 'sparkles', onClick: () => {} },
    },
    {
      title: 'No search results',
      description: 'We couldn\'t find anything matching "weld cell 99". Try a different keyword or broaden your filters.',
      icon: 'search',
      secondaryAction: { label: 'Clear filters', icon: 'x', onClick: () => {} },
    },
  ];

  return (
    <div>
      <PageHeader title="Empty state patterns" description="Reusable EmptyState patterns for new tenants, no data, and zero-result situations"/>
      <div style={{ padding: '20px 28px 28px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 14 }}>
        {variants.map((v, i) => (
          <div key={i} className="k-surface" style={{ overflow: 'hidden', minHeight: 460 }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {i + 1}. {v.title}
            </div>
            <EmptyState {...v}/>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SKELETON LOADERS
// ─────────────────────────────────────────────────────────────
function SkeletonBox({ w = '100%', h = 16, r = 4, style = {} }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: 'linear-gradient(90deg, var(--bg-subtle) 0%, var(--border) 50%, var(--bg-subtle) 100%)',
      backgroundSize: '200% 100%',
      animation: 'k-skel-shimmer 1.4s ease-in-out infinite',
      ...style,
    }}/>
  );
}

function SkeletonAvatar({ size = 32 }) {
  return <SkeletonBox w={size} h={size} r={size / 2}/>;
}

function SkeletonText({ lines = 3, lastWidth = '60%' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBox key={i} h={12} w={i === lines - 1 ? lastWidth : '100%'}/>
      ))}
    </div>
  );
}

function SkeletonKPI() {
  return (
    <div className="k-surface" style={{ padding: 16 }}>
      <SkeletonBox h={11} w="40%" style={{ marginBottom: 10 }}/>
      <SkeletonBox h={28} w="60%" style={{ marginBottom: 12 }}/>
      <SkeletonBox h={32} w="100%"/>
    </div>
  );
}

function SkeletonTableRow({ cols = 5 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16, padding: '14px 16px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <SkeletonAvatar size={24}/>
        <SkeletonBox h={12} w="80%"/>
      </div>
      {Array.from({ length: cols - 1 }).map((_, i) => <SkeletonBox key={i} h={11} w={(60 + Math.random() * 30) + '%'}/>)}
    </div>
  );
}

function SkeletonDashboard() {
  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <SkeletonBox h={28} w={260} style={{ marginBottom: 8 }}/>
        <SkeletonBox h={14} w={420}/>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {Array.from({ length: 4 }).map((_, i) => <SkeletonKPI key={i}/>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
        <div className="k-surface" style={{ padding: 18 }}>
          <SkeletonBox h={14} w="40%" style={{ marginBottom: 8 }}/>
          <SkeletonBox h={11} w="60%" style={{ marginBottom: 18 }}/>
          <SkeletonBox h={220} w="100%"/>
        </div>
        <div className="k-surface" style={{ padding: 18 }}>
          <SkeletonBox h={14} w="50%" style={{ marginBottom: 8 }}/>
          <SkeletonBox h={11} w="70%" style={{ marginBottom: 18 }}/>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180 }}>
            <SkeletonBox h={160} w={160} r={80}/>
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonList({ rows = 8 }) {
  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ marginBottom: 16 }}>
        <SkeletonBox h={28} w={220} style={{ marginBottom: 8 }}/>
        <SkeletonBox h={13} w={380}/>
      </div>
      <div className="k-surface" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, padding: '12px 16px', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
          {Array.from({ length: 5 }).map((_, i) => <SkeletonBox key={i} h={10} w="50%"/>)}
        </div>
        {Array.from({ length: rows }).map((_, i) => <SkeletonTableRow key={i} cols={5}/>)}
      </div>
    </div>
  );
}

function SkeletonDetail() {
  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="k-surface" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <SkeletonBox h={12} w={120} style={{ marginBottom: 8 }}/>
            <SkeletonBox h={26} w="70%" style={{ marginBottom: 14 }}/>
            <div style={{ display: 'flex', gap: 14 }}>
              {Array.from({ length: 4 }).map((_, i) => <SkeletonBox key={i} h={11} w={80}/>)}
            </div>
          </div>
          <SkeletonBox h={32} w={100}/>
          <SkeletonBox h={32} w={100}/>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
        <div className="k-surface" style={{ padding: 20 }}>
          <SkeletonBox h={15} w="30%" style={{ marginBottom: 16 }}/>
          <SkeletonText lines={5}/>
          <div style={{ marginTop: 18 }}><SkeletonText lines={4}/></div>
        </div>
        <div className="k-surface" style={{ padding: 18 }}>
          <SkeletonBox h={15} w="50%" style={{ marginBottom: 12 }}/>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <SkeletonAvatar size={26}/>
              <div style={{ flex: 1 }}><SkeletonBox h={11} w="80%" style={{ marginBottom: 4 }}/><SkeletonBox h={9} w="50%"/></div>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes k-skel-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

// Skeleton showcase page (routable)
function SkeletonsGallery({ setRoute }) {
  const [variant, setVariant] = React.useState('dashboard');
  return (
    <div>
      <PageHeader title="Loading skeletons" description="Shown during initial route loads to reduce perceived latency"
        actions={
          <Segmented value={variant} onChange={setVariant} options={[
            { value: 'dashboard', label: 'Dashboard' },
            { value: 'list', label: 'List' },
            { value: 'detail', label: 'Detail' },
          ]}/>
        }
      />
      {variant === 'dashboard' && <SkeletonDashboard/>}
      {variant === 'list' && <SkeletonList rows={8}/>}
      {variant === 'detail' && <SkeletonDetail/>}
    </div>
  );
}

// Inject the shimmer keyframes globally so any Skeleton in the app animates
if (typeof document !== 'undefined' && !document.getElementById('k-skel-anim')) {
  const s = document.createElement('style');
  s.id = 'k-skel-anim';
  s.textContent = `@keyframes k-skel-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`;
  document.head.appendChild(s);
}

Object.assign(window, {
  LiveToastProvider, LiveModeButton, LIVE_EVENTS,
  EmptyState, EmptyStatesGallery,
  SkeletonBox, SkeletonAvatar, SkeletonText, SkeletonKPI, SkeletonTableRow,
  SkeletonDashboard, SkeletonList, SkeletonDetail, SkeletonsGallery,
});
