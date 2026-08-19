// Kaenal Mobile — shared kit
// Ink design system (tokens.css) adapted to native. Theme is resolved per-frame
// (light/dark) and threaded to every screen as `T`. Reused across iOS, Android, tablet.

const SANS = "'Archivo', -apple-system, system-ui, sans-serif";
const ROBOTO = "Roboto, 'Archivo', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace";

// ── Theme resolver — mirrors tokens.css light + dark ──
function mkTheme(dark) {
  return {
    dark,
    bg: dark ? '#131315' : '#f4f4f5',
    bgSubtle: dark ? '#1c1c1f' : '#ececee',
    surface: dark ? '#1e1e21' : '#ffffff',
    raised: dark ? '#26262a' : '#ffffff',
    border: dark ? '#2e2e33' : '#e4e4e7',
    borderStrong: dark ? '#3f3f45' : '#d4d4d8',
    text: dark ? '#f4f4f5' : '#18181b',
    muted: dark ? '#a1a1aa' : '#6b7280',
    subtle: dark ? '#71717a' : '#a1a1aa',
    accent: dark ? '#fafafa' : '#18181b',
    accentHover: dark ? '#d4d4d8' : '#3f3f46',
    accentFg: dark ? '#18181b' : '#ffffff',
    accentSoft: dark ? 'rgba(250,250,250,0.10)' : '#f1f1f3',
    ring: dark ? 'rgba(250,250,250,0.28)' : 'rgba(24,24,27,0.16)',
    success: '#16a34a',
    successBg: dark ? 'rgba(34,197,94,0.16)' : '#f0fdf4',
    successFg: dark ? '#4ade80' : '#15803d',
    warn: '#d97706',
    warnBg: dark ? 'rgba(245,158,11,0.16)' : '#fffbeb',
    warnFg: dark ? '#fbbf24' : '#b45309',
    danger: '#dc2626',
    dangerBg: dark ? 'rgba(239,68,68,0.16)' : '#fef2f2',
    dangerFg: dark ? '#f87171' : '#b91c1c',
    info: dark ? '#93c5fd' : '#1d4ed8',
    infoBg: dark ? 'rgba(59,130,246,0.16)' : '#eff6ff',
  };
}

// ── Icon shim (primitives.jsx Icon is global) ──
const MI = ({ name, size = 18, stroke = 1.9, color, style = {} }) => (
  <Icon name={name} size={size} stroke={stroke} style={{ color: color || 'currentColor', ...style }}/>
);

const Mono = ({ children, style = {} }) => (
  <span style={{ fontFamily: MONO, fontFeatureSettings: '"tnum","zero"', ...style }}>{children}</span>
);

// ── Screen shell — handles safe-area insets per platform ──
// iOS: status bar + dynamic island overlay the top; home indicator overlays bottom.
// Android: status/nav bars are rendered by the frame in flow, so no insets needed.
function MScreen({ T, platform = 'ios', children, style = {} }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: T.bg, color: T.text,
      fontFamily: platform === 'android' ? ROBOTO : SANS,
      ...style,
    }}>{children}</div>
  );
}
const topInset = (p) => (p === 'ios' ? 52 : 8);
const botInset = (p) => (p === 'ios' ? 26 : 6);

// ── Sync pill — the signature offline affordance, in every header ──
function SyncPill({ T, state = 'synced', time = '12:04' }) {
  const map = {
    synced: { icon: 'cloud', label: `Synced · ${time}`, bg: T.successBg, fg: T.successFg, dot: T.success },
    pending: { icon: 'refresh', label: '3 pending', bg: T.warnBg, fg: T.warnFg, dot: T.warn },
    failed: { icon: 'alert', label: '2 failed', bg: T.dangerBg, fg: T.dangerFg, dot: T.danger },
    offline: { icon: 'cloudOff', label: 'Offline', bg: T.bgSubtle, fg: T.muted, dot: T.subtle },
  };
  const s = map[state];
  return (
    <button style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 9px 0 8px',
      borderRadius: 999, background: s.bg, color: s.fg, border: `1px solid ${T.border}`,
      fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {state === 'pending'
        ? <MI name="refresh" size={12} stroke={2.2}/>
        : <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, flexShrink: 0 }}/>}
      {s.label}
    </button>
  );
}

// ── Status vocabulary — same as web ──
function StatusPill({ T, tone = 'neutral', children, size = 'md' }) {
  const tones = {
    open: { bg: T.infoBg, fg: T.info }, verify: { bg: T.infoBg, fg: T.info },
    progress: { bg: T.warnBg, fg: T.warnFg }, closed: { bg: T.successBg, fg: T.successFg },
    done: { bg: T.successBg, fg: T.successFg }, danger: { bg: T.dangerBg, fg: T.dangerFg },
    warn: { bg: T.warnBg, fg: T.warnFg }, neutral: { bg: T.bgSubtle, fg: T.muted },
    accent: { bg: T.accentSoft, fg: T.accent },
  };
  const c = tones[tone] || tones.neutral;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, height: size === 'sm' ? 18 : 21,
      padding: size === 'sm' ? '0 7px' : '0 8px', borderRadius: 999, background: c.bg, color: c.fg,
      fontSize: size === 'sm' ? 10 : 11, fontWeight: 700, letterSpacing: '0.03em',
      textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

// severity chip
function Sev({ T, level }) {
  const m = {
    critical: T.danger, high: '#ea580c', major: '#ea580c', medium: T.warn, minor: T.warn, low: T.success,
  };
  const col = m[level] || T.muted;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, height: 21, padding: '0 8px',
      borderRadius: 999, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.03em', color: col, background: col + (T.dark ? '28' : '18'),
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 2, background: col }}/>{level}
    </span>
  );
}

function Avatar({ initials, size = 34, tone = 'neutral', T }) {
  const bg = tone === 'accent' ? T.accent : T.bgSubtle;
  const fg = tone === 'accent' ? T.accentFg : T.text;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg, color: fg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700, flexShrink: 0, border: `1px solid ${T.border}`,
    }}>{initials}</div>
  );
}

function SectionLabel({ T, children, style = {} }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: '0.08em',
      textTransform: 'uppercase', ...style,
    }}>{children}</div>
  );
}

function Card({ T, children, style = {}, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12,
      boxShadow: T.dark ? 'none' : '0 1px 2px rgba(24,24,27,0.04)', ...style,
    }}>{children}</div>
  );
}

// ── Header — big-title (iOS HIG large title / Android top bar), sync pill inline ──
function MHeader({ T, platform = 'ios', overline, title, right, sync = 'synced', back = false, sub }) {
  return (
    <div style={{
      paddingTop: topInset(platform), background: T.surface,
      borderBottom: `1px solid ${T.border}`, flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px 0' }}>
        {back && <button style={{ marginLeft: -6, padding: 4, color: T.text }}><MI name="chevronLeft" size={24} stroke={2}/></button>}
        <div style={{ flex: 1, minWidth: 0 }}>
          {overline && <div style={{ fontSize: 11.5, color: T.muted, fontWeight: 600 }}>{overline}</div>}
        </div>
        <SyncPill T={T} state={sync}/>
        {right}
      </div>
      <div style={{ padding: '2px 16px 12px', display: 'flex', alignItems: 'flex-end', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: platform === 'android' ? 24 : 27, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{title}</div>
          {sub && <div style={{ fontSize: 12.5, color: T.muted, marginTop: 3 }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

// ── Bottom tab bar (thumb-reachable) with FAB + badges ──
function TabBar({ T, platform = 'ios', active = 'home', tabs, fab = true }) {
  const items = tabs || [
    { id: 'home', icon: 'home', label: 'Home' },
    { id: 'tasks', icon: 'clipboard', label: 'Tasks', badge: 4 },
    ...(fab ? [{ id: 'add', fab: true }] : []),
    { id: 'ncr', icon: 'alert', label: 'NCRs' },
    { id: 'me', icon: 'user', label: 'Me' },
  ];
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', background: T.surface, borderTop: `1px solid ${T.border}`,
      padding: `8px 6px ${botInset(platform)}px`, flexShrink: 0,
    }}>
      {items.map((t, i) => {
        if (t.fab) return (
          <div key={i} style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <div style={{
              width: 48, height: 48, borderRadius: platform === 'android' ? 16 : '50%',
              background: T.accent, color: T.accentFg, display: 'flex', alignItems: 'center',
              justifyContent: 'center', marginTop: -22, boxShadow: '0 6px 16px -4px rgba(0,0,0,0.35)',
            }}><MI name="plus" size={24} stroke={2.4}/></div>
          </div>
        );
        const on = t.id === active;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: on ? T.accent : T.subtle }}>
            <div style={{ position: 'relative' }}>
              <MI name={t.icon} size={22} stroke={on ? 2.3 : 1.9}/>
              {t.badge && <span style={{
                position: 'absolute', top: -5, right: -8, minWidth: 15, height: 15, padding: '0 3px',
                borderRadius: 999, background: T.danger, color: '#fff', fontSize: 9.5, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${T.surface}`,
              }}>{t.badge}</span>}
            </div>
            <span style={{ fontSize: 10, fontWeight: on ? 700 : 500 }}>{t.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// Notifications bell (top-right of tab-root screens) — the single notifications entry point
function BellBtn({ T, count }) {
  return (
    <button style={{
      position: 'relative', width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: T.text, border: `1px solid ${T.border}`, background: T.surface,
    }}>
      <MI name="bell" size={18}/>
      {count ? <span style={{
        position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, padding: '0 4px',
        borderRadius: 999, background: T.danger, color: '#fff', fontSize: 9.5, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${T.surface}`,
      }}>{count}</span> : null}
    </button>
  );
}

// scrollable body
function Body({ children, style = {} }) {
  return <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', ...style }}>{children}</div>;
}

// ── Buttons ──
function PrimaryBtn({ T, children, style = {}, onClick, icon }) {
  return (
    <button onClick={onClick} style={{
      height: 48, borderRadius: 12, background: T.accent, color: T.accentFg, fontSize: 15, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', ...style,
    }}>{icon && <MI name={icon} size={18} stroke={2.2}/>}{children}</button>
  );
}
function GhostBtn({ T, children, style = {}, onClick, icon }) {
  return (
    <button onClick={onClick} style={{
      height: 48, borderRadius: 12, background: T.surface, color: T.text, border: `1px solid ${T.border}`,
      fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', ...style,
    }}>{icon && <MI name={icon} size={18}/>}{children}</button>
  );
}

// sticky bottom action bar
function ActionBar({ T, platform = 'ios', children }) {
  return (
    <div style={{
      display: 'flex', gap: 10, padding: `12px 16px ${botInset(platform) + 12}px`,
      background: T.surface, borderTop: `1px solid ${T.border}`, flexShrink: 0,
    }}>{children}</div>
  );
}

// ── Skeleton block ──
function Skel({ T, w = '100%', h = 14, r = 6, style = {} }) {
  return <div style={{
    width: w, height: h, borderRadius: r,
    background: `linear-gradient(90deg, ${T.bgSubtle} 0%, ${T.border} 50%, ${T.bgSubtle} 100%)`,
    backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', ...style,
  }}/>;
}

// ── Empty state ──
function EmptyState({ T, icon = 'check', title, body }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center', gap: 12 }}>
      <div style={{ width: 60, height: 60, borderRadius: 18, background: T.bgSubtle, color: T.subtle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <MI name={icon} size={28} stroke={1.6}/>
      </div>
      <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 13, color: T.muted, maxWidth: 220, lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}

// ── Row / list item ──
function Row({ T, icon, iconTone, title, sub, right, onClick, last, chevron }) {
  const tint = iconTone || T.accent;
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
      borderBottom: last ? 'none' : `1px solid ${T.border}`,
    }}>
      {icon && <div style={{
        width: 36, height: 36, borderRadius: 9, background: tint + (T.dark ? '26' : '16'), color: tint,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}><MI name={icon} size={18}/></div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
        {sub && <div style={{ fontSize: 11.5, color: T.muted, marginTop: 1 }}>{sub}</div>}
      </div>
      {right}
      {chevron && <MI name="chevronRight" size={16} color={T.subtle}/>}
    </div>
  );
}

// ── iPad / tablet frame — thin bezel, camera dot, home indicator; landscape or portrait ──
function TabletFrame({ children, width = 1024, height = 768, dark = false, landscape = true }) {
  return (
    <div style={{
      width, height, borderRadius: 34, background: dark ? '#0a0a0a' : '#1a1a1a',
      padding: 14, boxShadow: '0 40px 90px -20px rgba(0,0,0,0.45), 0 0 0 2px rgba(0,0,0,0.2)',
      position: 'relative', boxSizing: 'border-box',
    }}>
      {/* camera */}
      <div style={{
        position: 'absolute', top: landscape ? '50%' : 7, left: landscape ? 6 : '50%',
        transform: landscape ? 'translateY(-50%)' : 'translateX(-50%)',
        width: 6, height: 6, borderRadius: '50%', background: '#2a2a2a', zIndex: 5,
      }}/>
      <div style={{ width: '100%', height: '100%', borderRadius: 22, overflow: 'hidden', position: 'relative' }}>
        {children}
      </div>
    </div>
  );
}

Object.assign(window, {
  mkTheme, MI, Mono, MScreen, topInset, botInset, SyncPill, StatusPill, Sev, Avatar,
  SectionLabel, Card, MHeader, TabBar, Body, PrimaryBtn, GhostBtn, ActionBar, Skel, BellBtn,
  EmptyState, Row, TabletFrame, SANS, ROBOTO, MONO,
});
