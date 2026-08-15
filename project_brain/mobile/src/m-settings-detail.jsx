// Kaenal Mobile — Settings detail sub-pages
// Profile edit · Security · Offline & storage · Notification prefs · Appearance · Sign-out guard.

const SubHeader = ({ T, platform, title }) => (
  <div style={{ paddingTop: topInset(platform), background: T.surface, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px 12px' }}>
      <button style={{ padding: 4, color: T.text }}><MI name="chevronLeft" size={24} stroke={2}/></button>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</div>
    </div>
  </div>
);

const Toggle = ({ T, on }) => (
  <div style={{ width: 42, height: 25, borderRadius: 999, background: on ? T.accent : T.borderStrong, position: 'relative', flexShrink: 0 }}>
    <div style={{ position: 'absolute', top: 2, left: on ? 19 : 2, width: 21, height: 21, borderRadius: '50%', background: '#fff', transition: 'left 120ms' }}/>
  </div>
);

const SettingsGroup = ({ T, rows }) => (
  <Card T={T} style={{ margin: '0 16px 14px' }}>
    {rows.map((r, i, a) => (
      <div key={r.t} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i < a.length - 1 ? `1px solid ${T.border}` : 'none' }}>
        {r.i && <div style={{ width: 30, height: 30, borderRadius: 8, background: T.bgSubtle, color: r.danger ? T.dangerFg : T.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MI name={r.i} size={16}/></div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: r.danger ? T.dangerFg : T.text }}>{r.t}</div>
          {r.s && <div style={{ fontSize: 11.5, color: T.muted, marginTop: 1 }}>{r.s}</div>}
        </div>
        {r.val && <span style={{ fontSize: 12.5, color: T.muted }}>{r.val}</span>}
        {r.toggle !== undefined ? <Toggle T={T} on={r.toggle}/> : r.chevron !== false && !r.val ? <MI name="chevronRight" size={16} color={T.subtle}/> : (r.chevron && <MI name="chevronRight" size={16} color={T.subtle}/>)}
      </div>
    ))}
  </Card>
);

// ── Profile edit ──
const ProfileEdit = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <SubHeader T={T} platform={platform} title="Profile"/>
    <Body style={{ padding: '18px 0' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '0 16px 20px' }}>
        <div style={{ position: 'relative' }}>
          <Avatar T={T} initials="SC" size={76} tone="accent"/>
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: '50%', background: T.accent, color: T.accentFg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${T.surface}` }}><MI name="camera" size={13}/></div>
        </div>
        <a href="#" style={{ fontSize: 13, color: T.accent, fontWeight: 600 }}>Change photo</a>
      </div>
      {[
        { label: 'Full name', val: 'Sara Chen' },
        { label: 'Email', val: 'sara.chen@northstar.co', locked: true },
        { label: 'Job title', val: 'Quality Inspector' },
        { label: 'Phone', val: '+1 (313) 555-0148' },
      ].map(f => (
        <div key={f.label} style={{ padding: '0 16px 14px' }}>
          <SectionLabel T={T} style={{ marginBottom: 7 }}>{f.label}</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', height: 48, border: `1px solid ${T.border}`, borderRadius: 12, background: f.locked ? T.bgSubtle : T.surface, padding: '0 14px', fontSize: 14.5, color: f.locked ? T.muted : T.text }}>
            <span style={{ flex: 1 }}>{f.val}</span>{f.locked && <MI name="lock" size={14} color={T.subtle}/>}
          </div>
        </div>
      ))}
      <div style={{ padding: '0 16px' }}>
        <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 12 }}>Email is managed by your SSO provider and can't be changed here.</div>
      </div>
    </Body>
    <ActionBar T={T} platform={platform}><PrimaryBtn T={T}>Save changes</PrimaryBtn></ActionBar>
  </MScreen>
);

// ── Security ──
const SettingsSecurity = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <SubHeader T={T} platform={platform} title="Security"/>
    <Body style={{ padding: '16px 0' }}>
      <SectionLabel T={T} style={{ padding: '0 20px 8px' }}>Two-factor</SectionLabel>
      <SettingsGroup T={T} rows={[
        { i: 'shieldCheck', t: 'Authenticator app', s: 'Active · added Mar 2026', val: 'On' },
        { i: 'key', t: 'Recovery codes', s: '6 of 8 remaining', chevron: true },
        { i: 'refresh', t: 'Regenerate recovery codes', chevron: true },
      ]}/>
      <SectionLabel T={T} style={{ padding: '4px 20px 8px' }}>Sign-in</SectionLabel>
      <SettingsGroup T={T} rows={[
        { i: 'user', t: 'Biometric unlock', s: 'Face ID', toggle: true },
        { i: 'lock', t: 'Change password', chevron: true },
      ]}/>
      <SectionLabel T={T} style={{ padding: '4px 20px 8px' }}>Active sessions</SectionLabel>
      <Card T={T} style={{ margin: '0 16px 14px' }}>
        {[
          { d: 'iPhone 15 · this device', loc: 'Detroit · now', me: true },
          { d: 'Pixel 8 · field tablet', loc: 'Detroit · 2h ago' },
          { d: 'Chrome · Windows', loc: 'Detroit · yesterday' },
        ].map((s, i, a) => (
          <div key={s.d} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i < a.length - 1 ? `1px solid ${T.border}` : 'none' }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: T.bgSubtle, color: T.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MI name={s.d.includes('Chrome') ? 'globe' : 'smartphone'} size={16}/></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 600 }}>{s.d}</div><div style={{ fontSize: 11.5, color: T.muted }}>{s.loc}</div></div>
            {s.me ? <StatusPill T={T} tone="done" size="sm">Current</StatusPill> : <a href="#" style={{ fontSize: 12.5, color: T.dangerFg, fontWeight: 600 }}>Revoke</a>}
          </div>
        ))}
      </Card>
      <div style={{ padding: '0 16px' }}><GhostBtn T={T} icon="logOut" style={{ color: T.dangerFg }}>Sign out all other devices</GhostBtn></div>
    </Body>
  </MScreen>
);

// ── Offline & storage ──
const SettingsStorage = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <SubHeader T={T} platform={platform} title="Offline & storage"/>
    <Body style={{ padding: '16px 0' }}>
      <Card T={T} style={{ margin: '0 16px 14px', padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>On-device storage</span>
          <span style={{ fontSize: 12.5, color: T.muted }}><strong style={{ color: T.text }}>184 MB</strong> / 500 MB</span>
        </div>
        <div style={{ height: 10, background: T.bgSubtle, borderRadius: 999, overflow: 'hidden', display: 'flex' }}>
          <div style={{ width: '22%', background: T.accent }}/><div style={{ width: '9%', background: T.warn }}/><div style={{ width: '6%', background: T.info }}/>
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
          {[{ l: 'Photos', c: T.accent }, { l: 'Pending sync', c: T.warn }, { l: 'Cached records', c: T.info }].map(x => (
            <span key={x.l} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: T.muted }}><span style={{ width: 8, height: 8, borderRadius: 2, background: x.c }}/>{x.l}</span>
          ))}
        </div>
      </Card>
      <SectionLabel T={T} style={{ padding: '4px 20px 8px' }}>Offline behaviour</SectionLabel>
      <SettingsGroup T={T} rows={[
        { i: 'download', t: 'Download my work for offline', s: 'Assigned inspections & templates', toggle: true },
        { i: 'camera', t: 'High-quality photos', s: 'Uses more storage & data', toggle: false },
        { i: 'signal', t: 'Sync on cellular', s: 'Otherwise Wi-Fi only', toggle: true },
      ]}/>
      <div style={{ padding: '0 16px' }}>
        <GhostBtn T={T} icon="trash">Clear synced cache (24 MB)</GhostBtn>
        <div style={{ fontSize: 11.5, color: T.muted, marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}><MI name="info" size={13}/> Only clears items already synced. Pending work is kept.</div>
      </div>
    </Body>
  </MScreen>
);

// ── Notification preferences ──
const SettingsNotifPrefs = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <SubHeader T={T} platform={platform} title="Notifications"/>
    <Body style={{ padding: '16px 0' }}>
      <SectionLabel T={T} style={{ padding: '0 20px 8px' }}>Push</SectionLabel>
      <SettingsGroup T={T} rows={[
        { i: 'clipboard', t: 'Work assigned to me', toggle: true },
        { i: 'clock', t: 'Due-soon reminders', toggle: true },
        { i: 'alert', t: 'NCR needs my action', toggle: true },
        { i: 'cloudOff', t: 'Sync failed', toggle: true },
        { i: 'check', t: 'Approvals & mentions', toggle: false },
      ]}/>
      <SectionLabel T={T} style={{ padding: '4px 20px 8px' }}>Quiet hours</SectionLabel>
      <SettingsGroup T={T} rows={[
        { i: 'moon', t: 'Mute outside my shift', s: 'Shift A · 06:00–14:00', toggle: true },
        { i: 'mail', t: 'Email digest', val: 'Daily' },
      ]}/>
    </Body>
  </MScreen>
);

// ── Appearance ──
const SettingsAppearance = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <SubHeader T={T} platform={platform} title="Appearance"/>
    <Body style={{ padding: '16px 0' }}>
      <SectionLabel T={T} style={{ padding: '0 20px 8px' }}>Theme</SectionLabel>
      <div style={{ display: 'flex', gap: 10, padding: '0 16px 16px' }}>
        {[{ l: 'Light', ic: 'sun' }, { l: 'Dark', ic: 'moon' }, { l: 'System', ic: 'smartphone', on: true }].map(o => (
          <Card T={T} key={o.l} style={{ flex: 1, padding: '16px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: `1.5px solid ${o.on ? T.accent : T.border}`, background: o.on ? T.accentSoft : T.surface }}>
            <MI name={o.ic} size={22} color={o.on ? T.accent : T.muted}/>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: o.on ? T.accent : T.text }}>{o.l}</span>
          </Card>
        ))}
      </div>
      <SectionLabel T={T} style={{ padding: '4px 20px 8px' }}>Text size (Dynamic Type)</SectionLabel>
      <Card T={T} style={{ margin: '0 16px 14px', padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: T.muted }}>A</span>
          <div style={{ flex: 1, height: 4, background: T.bgSubtle, borderRadius: 999, position: 'relative' }}>
            <div style={{ width: '45%', height: '100%', background: T.accent, borderRadius: 999 }}/>
            <div style={{ position: 'absolute', left: '45%', top: '50%', transform: 'translate(-50%,-50%)', width: 22, height: 22, borderRadius: '50%', background: T.surface, border: `2px solid ${T.accent}`, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}/>
          </div>
          <span style={{ fontSize: 22, color: T.muted }}>A</span>
        </div>
      </Card>
      <SectionLabel T={T} style={{ padding: '4px 20px 8px' }}>Accessibility</SectionLabel>
      <SettingsGroup T={T} rows={[
        { i: 'eye', t: 'High contrast', toggle: false },
        { i: 'zap', t: 'Reduce motion', toggle: true },
        { i: 'target', t: 'Larger touch targets', toggle: false },
      ]}/>
    </Body>
  </MScreen>
);

// ── Sign-out unsynced guard (modal over settings) ──
const SignOutGuard = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform} style={{ background: T.bg }}>
    <div style={{ flex: 1, position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.35, pointerEvents: 'none' }}>
        <MHeader T={T} platform={platform} overline="Sara Chen · Inspector" title="Settings" sync="offline"/>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 300, background: T.surface, borderRadius: 18, padding: 22, boxShadow: '0 20px 50px -10px rgba(0,0,0,0.4)' }}>
          <div style={{ width: 48, height: 48, borderRadius: 13, background: T.warnBg, color: T.warnFg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}><MI name="alert" size={24}/></div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>Sign out with unsynced work?</div>
          <div style={{ fontSize: 13.5, color: T.muted, marginTop: 8, lineHeight: 1.5 }}>You have <strong style={{ color: T.text }}>4 items</strong> (1 NCR draft, 3 inspections) that haven't uploaded. Signing out now may lose them.</div>
          <Card T={T} style={{ margin: '14px 0', padding: '10px 12px', background: T.bgSubtle, border: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <MI name="cloudOff" size={15} color={T.warnFg}/><span style={{ fontSize: 12, color: T.muted }}>Currently offline — can't sync right now</span>
          </Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            <PrimaryBtn T={T} style={{ height: 44 }}>Keep me signed in</PrimaryBtn>
            <button style={{ height: 44, borderRadius: 12, background: 'transparent', color: T.dangerFg, fontSize: 14, fontWeight: 600 }}>Sign out anyway</button>
          </div>
        </div>
      </div>
    </div>
  </MScreen>
);

Object.assign(window, { ProfileEdit, SettingsSecurity, SettingsStorage, SettingsNotifPrefs, SettingsAppearance, SignOutGuard });
