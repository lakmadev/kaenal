// Kaenal — Phase 1 "Zero-Friction" · Collaboration Workspace
// A Slack/Notion-style threaded workspace where Engineering, Operations and Quality
// resolve a quality log together: threaded messages, component tags, inline action items.

const { useState: useColab } = React;

// Rich text renderer: highlights @mentions and #component-tags inline
const RichText = ({ children }) => {
  const parts = String(children).split(/(@[A-Za-z]+|#[A-Za-z0-9\-]+)/g);
  return (
    <span>
      {parts.map((p, i) => {
        if (p.startsWith('@')) return <span key={i} style={{ color: 'var(--accent)', fontWeight: 600, background: 'var(--accent-soft)', borderRadius: 4, padding: '0 3px' }}>{p}</span>;
        if (p.startsWith('#')) return <span key={i} style={{ color: '#7c3aed', fontWeight: 600, background: 'rgba(124,58,237,0.1)', borderRadius: 4, padding: '0 4px', fontFamily: 'var(--font-mono)', fontSize: '0.92em' }}>{p}</span>;
        return <React.Fragment key={i}>{p}</React.Fragment>;
      })}
    </span>
  );
};

const TEAM_CHIP = {
  Quality: { bg: 'rgba(37,99,235,0.12)', fg: '#1d4ed8' },
  Operations: { bg: 'rgba(22,163,74,0.14)', fg: '#15803d' },
  Engineering: { bg: 'rgba(124,58,237,0.12)', fg: '#6d28d9' },
  Supplier: { bg: 'rgba(8,145,178,0.14)', fg: '#0e7490' },
};

const THREAD = [
  { id: 1, type: 'system', text: 'Rafael Costa logged this from the floor — 14s voice note + 3 photos', time: '10:42' },
  { id: 2, user: 'u7', team: 'Quality', time: '10:42',
    text: 'Bracket weld bead on #A-7742 looks inconsistent — porosity around the seam, third time this month. Quarantined the lot for now.',
    media: true, reactions: [{ e: '👀', n: 3 }, { e: '⚠️', n: 2 }] },
  { id: 3, user: 'u3', team: 'Operations', time: '10:48',
    text: 'Confirmed on my end — Station 3B. I stopped the cell and pulled WIP. @Anna can you look at the wire-feed trace?' },
  { id: 4, type: 'action', title: 'Stop Weld Cell 3B & quarantine last 48h of #A-7742', owner: 'u3', due: 'Today', status: 'completed' },
  { id: 5, user: 'u2', team: 'Engineering', time: '11:05',
    text: 'Pulled the telemetry. Wire-feed speed drifted +8% around 09:50 — right when the porosity starts. Likely a worn liner, not the gas. Photo of the trace below.',
    chart: true, reactions: [{ e: '🎯', n: 4 }] },
  { id: 6, type: 'action', title: 'Replace MIG liner on W-03 + recalibrate feed', owner: 'u2', due: 'Apr 25', status: 'in_progress' },
  { id: 7, user: 'u1', team: 'Quality', time: '11:12',
    text: 'Good catch @Anna. This is the 3rd repeat in 30 days so I’m promoting it to an 8D. Linking #NCR-2026-0089 and looping in @Lena on the wire supplier side.' },
  { id: 8, type: 'system', text: 'Manjunath Kumar promoted this to 8D-2026-0015 · linked NCR-2026-0089', time: '11:13' },
];

const Reaction = ({ e, n }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: 'var(--bg-subtle)', border: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
    <span style={{ fontSize: 12.5 }}>{e}</span>{n}
  </span>
);

const ActionItemMsg = ({ m }) => {
  const done = m.status === 'completed';
  return (
    <div style={{ display: 'flex', gap: 12, padding: '4px 0 4px 52px' }}>
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
        background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '3px solid var(--accent)', borderRadius: 'var(--r-lg)',
      }}>
        <div style={{
          width: 20, height: 20, borderRadius: 6, flexShrink: 0,
          border: `1.5px solid ${done ? 'var(--success-600)' : 'var(--border-strong)'}`,
          background: done ? 'var(--success-600)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
        }}>{done && <Icon name="check" size={12} stroke={3}/>}</div>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, textDecoration: done ? 'line-through' : 'none', color: done ? 'var(--text-muted)' : 'var(--text)' }}>
          <RichText>{m.title}</RichText>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--text-muted)' }}>
          <Icon name="clock" size={12}/>{m.due}
        </span>
        <Avatar user={m.owner} size={24}/>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: done ? 'var(--success-700)' : 'var(--warning-700)', background: done ? 'rgba(34,197,94,0.14)' : 'rgba(245,158,11,0.14)', padding: '3px 7px', borderRadius: 999 }}>
          {done ? 'Done' : 'In progress'}
        </span>
      </div>
    </div>
  );
};

const Message = ({ m }) => {
  if (m.type === 'system') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', color: 'var(--text-muted)' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }}/>
        <span style={{ fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Icon name="sparkles" size={12} style={{ color: 'var(--accent)' }}/>{m.text} · {m.time}
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }}/>
      </div>
    );
  }
  if (m.type === 'action') return <ActionItemMsg m={m}/>;

  const u = userById(m.user);
  const tc = TEAM_CHIP[m.team] || TEAM_CHIP.Quality;
  return (
    <div style={{ display: 'flex', gap: 12, padding: '8px 0' }}>
      <Avatar user={m.user} size={40}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700 }}>{u.name}</span>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.03em', padding: '2px 7px', borderRadius: 999, background: tc.bg, color: tc.fg }}>{m.team}</span>
          <span style={{ fontSize: 11.5, color: 'var(--text-subtle)' }}>{m.time}</span>
        </div>
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text)' }}><RichText>{m.text}</RichText></div>

        {m.media && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <div style={{ width: 96, height: 72, borderRadius: 8, background: 'linear-gradient(135deg,#475569,#1e293b)', position: 'relative' }}>
              <span style={{ position: 'absolute', top: 8, left: 12, width: 16, height: 16, border: '2px solid #fbbf24', borderRadius: '50%' }}/>
              <span style={{ position: 'absolute', bottom: 4, left: 6, fontSize: 9, color: '#fff', fontWeight: 600 }}>annotated</span>
            </div>
            <div style={{ width: 96, height: 72, borderRadius: 8, background: 'linear-gradient(135deg,#64748b,#334155)' }}/>
            <div style={{ width: 96, height: 72, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-subtle)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--text-muted)' }}>
              <Icon name="mic" size={16}/>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>0:14</span>
            </div>
          </div>
        )}

        {m.chart && (
          <div style={{ marginTop: 8, width: 320, maxWidth: '100%', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 12, background: 'var(--surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
              <span style={{ fontWeight: 600 }}>Wire-feed speed (m/min)</span><span className="mono">09:30–10:10</span>
            </div>
            <svg viewBox="0 0 300 80" style={{ width: '100%', height: 64 }}>
              <line x1="0" y1="40" x2="300" y2="40" stroke="var(--border)" strokeDasharray="3 3"/>
              <polyline points="0,44 40,42 80,45 120,43 150,30 180,22 220,24 260,23 300,25" fill="none" stroke="var(--accent)" strokeWidth="2.5"/>
              <circle cx="150" cy="30" r="4" fill="#dc2626"/>
              <rect x="150" y="6" width="150" height="60" fill="rgba(220,38,38,0.06)"/>
            </svg>
            <div style={{ fontSize: 11, color: '#b91c1c', fontWeight: 600, marginTop: 4 }}>+8% drift detected at 09:50</div>
          </div>
        )}

        {m.reactions && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
            {m.reactions.map((r, i) => <Reaction key={i} {...r}/>)}
            <button style={{ width: 26, height: 24, borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="plus" size={12}/>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const CollabWorkspace = () => {
  const [tab, setTab] = useColab('thread');
  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      {/* Left — thread list */}
      <div style={{ width: 268, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Icon name="chat" size={15} style={{ color: 'var(--accent)' }}/> Active threads
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {[
            { id: 'NCR-0089', title: 'Weld porosity · #A-7742', team: 'Operations', unread: 0, active: true, people: ['u7','u3','u2','u1'], status: 'open' },
            { id: 'NCR-0091', title: 'Torque wrench out of cal', team: 'Operations', unread: 2, active: false, people: ['u3','u2'], status: 'open' },
            { id: 'LOG-2210', title: 'Coolant leak · Cell 4', team: 'Engineering', unread: 5, active: false, people: ['u5','u3'], status: 'open' },
            { id: 'SCAR-118', title: 'Wire grade variation', team: 'Supplier', unread: 0, active: false, people: ['u6','u2'], status: 'open' },
          ].map(t => {
            const tc = TEAM_CHIP[t.team];
            return (
              <button key={t.id} style={{
                width: '100%', textAlign: 'left', padding: '10px 11px', borderRadius: 'var(--r-md)', marginBottom: 2,
                background: t.active ? 'var(--accent-soft)' : 'transparent', border: t.active ? '1px solid var(--border)' : '1px solid transparent',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: t.active ? 'var(--accent)' : 'var(--text-muted)' }}>{t.id}</span>
                  <div style={{ flex: 1 }}/>
                  {t.unread > 0 && <span style={{ minWidth: 17, height: 17, padding: '0 5px', borderRadius: 9, background: 'var(--danger-500)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t.unread}</span>}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>{t.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 999, background: tc.bg, color: tc.fg }}>{t.team}</span>
                  <div style={{ display: 'flex', marginLeft: 2 }}>
                    {t.people.slice(0,3).map((p, i) => (
                      <div key={p} style={{ marginLeft: i ? -7 : 0, border: '2px solid var(--surface)', borderRadius: '50%' }}><Avatar user={p} size={18}/></div>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Center — conversation */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg)' }}>
        {/* Thread header */}
        <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)' }}>NCR-2026-0089</span>
            <StatusBadge status="in_progress"/>
            <span className="k-chip" style={{ background: 'rgba(220,38,38,0.12)', color: '#b91c1c' }}>Critical</span>
            <div style={{ flex: 1 }}/>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {['u7','u3','u2','u1'].map((p, i) => (
                <div key={p} style={{ marginLeft: i ? -8 : 0, border: '2px solid var(--surface)', borderRadius: '50%' }}><Avatar user={p} size={26}/></div>
              ))}
            </div>
            <button className="k-btn k-btn-ghost k-btn-sm"><Icon name="users" size={13}/>Invite</button>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>Recurring weld porosity on bracket #A-7742</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {['#A-7742', '#Weld-Cell-3', '#W-03', '#porosity'].map(t => (
              <span key={t} style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)', color: '#7c3aed', background: 'rgba(124,58,237,0.1)', padding: '3px 8px', borderRadius: 6 }}>{t}</span>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px' }}>
          {THREAD.map(m => <Message key={m.id} m={m}/>)}
        </div>

        {/* Composer */}
        <div style={{ padding: '12px 24px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={{ border: '1px solid var(--border-strong)', borderRadius: 'var(--r-lg)', background: 'var(--surface)', boxShadow: 'var(--shadow-xs)' }}>
            <div style={{ padding: '10px 14px', fontSize: 13.5, color: 'var(--text-subtle)' }}>Reply, @mention a teammate, or #tag a component…</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderTop: '1px solid var(--border)' }}>
              {[
                { i: 'user', t: 'Mention' }, { i: 'hash', t: 'Tag component' }, { i: 'paperclip', t: 'Attach' }, { i: 'camera', t: 'Photo' },
              ].map(b => (
                <button key={b.t} title={b.t} className="k-btn-plain" style={{ width: 30, height: 30, borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={b.i} size={16}/>
                </button>
              ))}
              <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 4px' }}/>
              <button className="k-btn-ghost k-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', fontWeight: 600, fontSize: 12 }}>
                <Icon name="check" size={13}/> Action item
              </button>
              <div style={{ flex: 1 }}/>
              <button className="k-btn k-btn-primary k-btn-sm"><Icon name="send" size={13}/>Send</button>
            </div>
          </div>
        </div>
      </div>

      {/* Right — Notion-style properties */}
      <div style={{ width: 280, flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--surface)', overflowY: 'auto' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700 }}>Linked record</div>
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { l: 'Type', v: <span className="k-chip" style={{ background: 'rgba(220,38,38,0.12)', color: '#b91c1c' }}>NCR → 8D</span> },
            { l: 'Owner', v: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Avatar user="u2" size={20}/><span style={{ fontSize: 12.5, fontWeight: 600 }}>Anna Schmidt</span></span> },
            { l: 'Due', v: <span style={{ fontSize: 12.5, fontWeight: 600 }}>Apr 25, 2026</span> },
            { l: 'Affected', v: <span style={{ fontSize: 12.5, fontWeight: 600 }}>2,840 units · quarantined</span> },
          ].map(p => (
            <div key={p.l}>
              <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 5 }}>{p.l}</div>
              {p.v}
            </div>
          ))}

          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 7 }}>Action items · 2</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { t: 'Stop & quarantine 3B', done: true },
                { t: 'Replace liner + recalibrate', done: false },
              ].map(a => (
                <div key={a.t} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: a.done ? 'var(--text-muted)' : 'var(--text)' }}>
                  <span style={{ width: 15, height: 15, borderRadius: 4, flexShrink: 0, border: `1.5px solid ${a.done ? 'var(--success-600)' : 'var(--border-strong)'}`, background: a.done ? 'var(--success-600)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>{a.done && <Icon name="check" size={9} stroke={3.5}/>}</span>
                  <span style={{ textDecoration: a.done ? 'line-through' : 'none' }}>{a.t}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 7 }}>Components</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {['#A-7742', '#Weld-Cell-3', '#W-03'].map(t => (
                <span key={t} style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)', color: '#7c3aed', background: 'rgba(124,58,237,0.1)', padding: '3px 7px', borderRadius: 6 }}>{t}</span>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 7 }}>Linked</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[{ i: 'brain', l: '8D-2026-0015' }, { i: 'clipboard', l: 'INS-2026-0042' }, { i: 'truck', l: 'SCAR-118 (supplier)' }].map(l => (
                <a key={l.l} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--accent)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  <Icon name={l.i} size={14}/>{l.l}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { CollabWorkspace });
