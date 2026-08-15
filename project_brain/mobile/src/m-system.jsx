// Kaenal Mobile — Sync queue (+ conflict) · Notifications · Settings (root/security/storage) · Error state

// ── Sync queue with conflict "needs review" ──
const SyncQueue = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <div style={{ padding: '10px 16px', background: T.warnBg, color: T.warnFg, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, paddingTop: topInset(platform) + 8, flexShrink: 0 }}>
      <MI name="cloudOff" size={15}/> Offline — your work is saved on this device
    </div>
    <div style={{ padding: '14px 16px 12px', background: T.surface, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
      <SectionLabel T={T} style={{ marginBottom: 4 }}>Sync queue</SectionLabel>
      <div style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.02em' }}>4 pending · 1 needs review</div>
      <div style={{ fontSize: 12.5, color: T.muted, marginTop: 3 }}>Uploads automatically when you reconnect</div>
    </div>
    <Body style={{ background: T.bg }}>
      {/* conflict card */}
      <Card T={T} style={{ margin: '12px 16px 0', padding: 14, border: `1.5px solid ${T.warn}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <MI name="alert" size={16} color={T.warnFg}/>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Conflict — needs review</span>
          <div style={{ flex: 1 }}/>
          <Mono style={{ fontSize: 10.5, color: T.muted }}>NCR-2026-0184</Mono>
        </div>
        <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.5, marginBottom: 12 }}>This NCR was <strong style={{ color: T.text }}>closed by Anna Park</strong> while you were offline. Your device has a newer comment and 2 photos.</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ flex: 1, height: 38, borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontSize: 12.5, fontWeight: 600 }}>Keep server</button>
          <button style={{ flex: 1, height: 38, borderRadius: 9, background: T.accent, color: T.accentFg, fontSize: 12.5, fontWeight: 700 }}>Merge mine</button>
        </div>
      </Card>
      <SectionLabel T={T} style={{ padding: '16px 16px 8px' }}>Queue</SectionLabel>
      <Card T={T} style={{ margin: '0 16px' }}>
        {[
          { i: 'clipboard', tone: T.info, t: 'INS-0421 · 14 checks complete', s: '5 photos · 1 NCR draft', size: '4.2 MB', st: 'inflight' },
          { i: 'alert', tone: '#ea580c', t: 'NCR-DRAFT-39 · Bracket weld', s: '3 photos · 1 voice note', size: '2.8 MB', st: 'pending' },
          { i: 'clipboard', tone: T.muted, t: 'INS-0422 · Cleanroom check', s: 'In progress · autosaved 2m', size: '320 KB', st: 'draft' },
          { i: 'camera', tone: T.success, t: 'PPE photo set · Floor walk', s: '8 photos', size: '12.4 MB', st: 'failed' },
        ].map((it, i, a) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i < a.length - 1 ? `1px solid ${T.border}` : 'none' }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: it.tone + (T.dark ? '26' : '16'), color: it.tone, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MI name={it.i} size={18}/></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{it.t}</div>
              <div style={{ fontSize: 11, color: T.muted }}>{it.s} · <Mono>{it.size}</Mono></div>
            </div>
            {it.st === 'inflight' && <span className="k-spin" style={{ color: T.info }}><MI name="refresh" size={16}/></span>}
            {it.st === 'pending' && <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${T.borderStrong}` }}/>}
            {it.st === 'draft' && <StatusPill T={T} tone="neutral" size="sm">Draft</StatusPill>}
            {it.st === 'failed' && <StatusPill T={T} tone="danger" size="sm">Retry</StatusPill>}
          </div>
        ))}
      </Card>
      {/* storage gauge */}
      <Card T={T} style={{ margin: '16px', padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: T.muted, marginBottom: 6 }}>
          <span style={{ fontWeight: 600 }}>Local storage</span><span><strong style={{ color: T.text }}>19.7 MB</strong> / 500 MB</span>
        </div>
        <div style={{ height: 6, background: T.bgSubtle, borderRadius: 999, overflow: 'hidden' }}><div style={{ width: '4%', height: '100%', background: T.accent }}/></div>
      </Card>
    </Body>
    <ActionBar T={T} platform={platform}>
      <GhostBtn T={T} icon="cloudOff" style={{ color: T.muted }}>Waiting for connection…</GhostBtn>
    </ActionBar>
  </MScreen>
);

// ── Notifications ──
const Notifications = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <MHeader T={T} platform={platform} overline="3 new" title="Notifications" sync="synced" right={<button style={{ fontSize: 12.5, color: T.accent, fontWeight: 600 }}>Mark read</button>}/>
    <Body>
      {[
        { grp: 'New', items: [
          { i: 'clipboard', tone: T.info, t: 'New inspection assigned', d: 'INS-0431 · Cleanroom · due 3pm', tm: '4m', unread: true },
          { i: 'alert', tone: '#ea580c', t: 'NCR needs your disposition', d: 'NCR-2026-0184 · High', tm: '20m', unread: true },
          { i: 'cloudOff', tone: T.danger, t: 'Sync failed', d: 'PPE photo set · 12.4 MB · tap to retry', tm: '32m', unread: true },
        ]},
        { grp: 'Earlier', items: [
          { i: 'check', tone: T.success, t: 'Approval granted', d: 'DOC-118 Cleanroom SOP v4 released', tm: '2h' },
          { i: 'clock', tone: T.warn, t: 'Due soon', d: 'CAPA-0091 verification due Friday', tm: '5h' },
          { i: 'gitBranch', tone: '#7c3aed', t: '8D step advanced', d: '8D-0042 moved to D5 · you own it', tm: 'Yesterday' },
        ]},
      ].map(g => (
        <div key={g.grp}>
          <SectionLabel T={T} style={{ padding: '14px 16px 6px' }}>{g.grp}</SectionLabel>
          <Card T={T} style={{ margin: '0 16px' }}>
            {g.items.map((n, i, a) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderBottom: i < a.length - 1 ? `1px solid ${T.border}` : 'none', background: n.unread ? T.accentSoft : 'transparent' }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: n.tone + (T.dark ? '26' : '16'), color: n.tone, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MI name={n.i} size={17}/></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{n.t}</div>
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 1 }}>{n.d}</div>
                </div>
                <Mono style={{ fontSize: 11, color: T.subtle, flexShrink: 0 }}>{n.tm}</Mono>
              </div>
            ))}
          </Card>
        </div>
      ))}
      <div style={{ height: 16 }}/>
    </Body>
    <TabBar T={T} platform={platform} active="ncr"/>
  </MScreen>
);

// ── Settings root ──
const SettingsRoot = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <MHeader T={T} platform={platform} overline="Sara Chen · Inspector" title="Settings" sync="synced"/>
    <Body style={{ padding: '14px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '4px 16px 18px' }}>
        <Avatar T={T} initials="SC" size={54} tone="accent"/>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Sara Chen</div>
          <div style={{ fontSize: 12.5, color: T.muted }}>sara.chen@northstar.co</div>
          <div style={{ marginTop: 5 }}><StatusPill T={T} tone="accent" size="sm">Inspector</StatusPill></div>
        </div>
      </div>
      {[
        { h: 'Account', rows: [{ i: 'user', t: 'Profile' }, { i: 'bell', t: 'Notification preferences' }] },
        { h: 'Security', rows: [{ i: 'shieldCheck', t: 'Two-factor · On', r: 'authenticator' }, { i: 'key', t: 'Biometric unlock', toggle: true }, { i: 'smartphone', t: 'Active sessions', r: '3 devices' }, { i: 'lock', t: 'Change password' }] },
        { h: 'Offline & storage', rows: [{ i: 'cloud', t: 'Cached data', r: '19.7 MB' }, { i: 'trash', t: 'Clear synced cache' }] },
        { h: 'Appearance', rows: [{ i: 'sun', t: 'Theme', r: 'System' }, { i: 'type', t: 'Text size', r: 'Default' }] },
        { h: 'Workspace', rows: [{ i: 'building', t: 'Northstar Mfg', r: 'Switch' }, { i: 'info', t: 'About & version', r: 'v2.4.0' }] },
      ].map(sec => (
        <div key={sec.h}>
          <SectionLabel T={T} style={{ padding: '14px 16px 8px' }}>{sec.h}</SectionLabel>
          <Card T={T} style={{ margin: '0 16px' }}>
            {sec.rows.map((r, i, a) => (
              <div key={r.t} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i < a.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: T.bgSubtle, color: T.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MI name={r.i} size={16}/></div>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{r.t}</span>
                {r.r && <span style={{ fontSize: 12.5, color: T.muted }}>{r.r}</span>}
                {r.toggle ? (
                  <div style={{ width: 42, height: 25, borderRadius: 999, background: T.accent, position: 'relative' }}><div style={{ position: 'absolute', top: 2, right: 2, width: 21, height: 21, borderRadius: '50%', background: '#fff' }}/></div>
                ) : <MI name="chevronRight" size={16} color={T.subtle}/>}
              </div>
            ))}
          </Card>
        </div>
      ))}
      <div style={{ padding: '18px 16px 6px' }}>
        <GhostBtn T={T} icon="logOut" style={{ color: T.dangerFg }}>Sign out</GhostBtn>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 12, fontSize: 11.5, color: T.warnFg }}>
          <MI name="alert" size={13}/> 4 items still need to sync before sign-out
        </div>
      </div>
      <div style={{ height: 12 }}/>
    </Body>
    <TabBar T={T} platform={platform} active="me"/>
  </MScreen>
);

// ── Generic error state ──
const ErrorState = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <MHeader T={T} platform={platform} back overline="INS-0421" title="Inspection" sync="failed"/>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center', gap: 14 }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: T.dangerBg, color: T.dangerFg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MI name="alert" size={30}/></div>
      <div style={{ fontSize: 17, fontWeight: 700 }}>Couldn't load this inspection</div>
      <div style={{ fontSize: 13, color: T.muted, maxWidth: 250, lineHeight: 1.5 }}>The server didn't respond. Your local drafts are safe on this device.</div>
      <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
        <GhostBtn T={T} style={{ width: 'auto', padding: '0 18px' }}>Go back</GhostBtn>
        <PrimaryBtn T={T} icon="refresh" style={{ width: 'auto', padding: '0 18px' }}>Try again</PrimaryBtn>
      </div>
    </div>
    <TabBar T={T} platform={platform} active="tasks"/>
  </MScreen>
);

// ── All-synced (queue clear) ──
const SyncSynced = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <div style={{ padding: '10px 16px', background: T.successBg, color: T.successFg, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, paddingTop: topInset(platform) + 8, flexShrink: 0 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.success }}/> Online — everything is up to date
    </div>
    <div style={{ padding: '14px 16px 12px', background: T.surface, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
      <SectionLabel T={T} style={{ marginBottom: 4 }}>Sync queue</SectionLabel>
      <div style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.02em' }}>All synced</div>
      <div style={{ fontSize: 12.5, color: T.muted, marginTop: 3 }}>Last sync 12:04 · nothing pending</div>
    </div>
    <EmptyState T={T} icon="cloud" title="Nothing waiting to upload" body="Completed work syncs automatically. When you go offline, items will queue here."/>
    <Card T={T} style={{ margin: '0 16px 16px', padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: T.muted, marginBottom: 6 }}>
        <span style={{ fontWeight: 600 }}>Local storage</span><span><strong style={{ color: T.text }}>3.1 MB</strong> / 500 MB</span>
      </div>
      <div style={{ height: 6, background: T.bgSubtle, borderRadius: 999, overflow: 'hidden' }}><div style={{ width: '1%', height: '100%', background: T.accent }}/></div>
    </Card>
    <TabBar T={T} platform={platform} active="me"/>
  </MScreen>
);

// ── Notifications empty ──
const NotifEmpty = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <MHeader T={T} platform={platform} overline="Notifications" title="All clear" sync="synced"/>
    <EmptyState T={T} icon="bell" title="No new notifications" body="Assignments, due-soon reminders and sync alerts will show up here."/>
    <TabBar T={T} platform={platform} active="ncr"/>
  </MScreen>
);

Object.assign(window, { SyncQueue, Notifications, SettingsRoot, ErrorState, SyncSynced, NotifEmpty });
