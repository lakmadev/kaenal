// Kaenal Mobile — Manager/Admin oversight
// Approvals inbox + item (reason field) · Assign/reassign · Team & plant snapshot
// · Audit-log highlights · "Manage in web app" list.

// ── Approvals inbox ──
const ApprovalsInbox = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <MHeader T={T} platform={platform} overline="Manager · Plant A" title="Approvals" sync="synced"/>
    <div style={{ display: 'flex', gap: 7, padding: '10px 16px', background: T.surface, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
      {[{ l: 'Pending · 5', on: true }, { l: 'Documents · 3' }, { l: 'NCR dispositions · 2' }].map(p => (
        <span key={p.l} style={{ padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', background: p.on ? T.accent : T.bgSubtle, color: p.on ? T.accentFg : T.muted }}>{p.l}</span>
      ))}
    </div>
    <Body>
      {[
        { i: 'doc', tone: T.info, id: 'DOC-118', t: 'Cleanroom SOP v4 — release', by: 'Anna Park', tm: '20m ago', tag: 'Document' },
        { i: 'alert', tone: '#ea580c', id: 'NCR-2026-0184', t: 'Disposition: Use-as-is (12 units)', by: 'Lin Wei', tm: '1h ago', tag: 'NCR disposition', hot: true },
        { i: 'doc', tone: T.info, id: 'DOC-121', t: 'Welding WI-07 revision', by: 'Sara Chen', tm: '2h ago', tag: 'Document' },
        { i: 'alert', tone: '#ea580c', id: 'NCR-2026-0180', t: 'Disposition: Scrap (4 units)', by: 'M. Reyes', tm: 'Yesterday', tag: 'NCR disposition' },
        { i: 'doc', tone: T.info, id: 'DOC-117', t: 'Calibration schedule Q3', by: 'L. Wei', tm: 'Yesterday', tag: 'Document' },
      ].map(it => (
        <Card T={T} key={it.id} style={{ margin: '10px 16px 0', padding: '13px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: it.tone + (T.dark ? '26' : '16'), color: it.tone, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MI name={it.i} size={18}/></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Mono style={{ fontSize: 10, fontWeight: 700, color: T.muted }}>{it.id}</Mono>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: T.subtle, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{it.tag}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 1 }}>{it.t}</div>
              <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>Requested by {it.by} · {it.tm}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button style={{ flex: 1, height: 38, borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: T.dangerFg, fontSize: 13, fontWeight: 600 }}>Reject</button>
            <button style={{ flex: 1, height: 38, borderRadius: 9, background: T.accent, color: T.accentFg, fontSize: 13, fontWeight: 700 }}>Approve</button>
          </div>
        </Card>
      ))}
      <div style={{ height: 16 }}/>
    </Body>
    <TabBar T={T} platform={platform} active="approvals" tabs={[
      { id: 'home', icon: 'home', label: 'Home' },
      { id: 'approvals', icon: 'check', label: 'Approvals', badge: 5 },
      { id: 'add', fab: true },
      { id: 'team', icon: 'users', label: 'Team' },
      { id: 'me', icon: 'user', label: 'Me' },
    ]}/>
  </MScreen>
);

// ── Approval item with reason field ──
const ApprovalItem = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <div style={{ paddingTop: topInset(platform), background: T.surface, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
        <button style={{ padding: 4, color: T.text }}><MI name="chevronLeft" size={24} stroke={2}/></button>
        <Mono style={{ fontSize: 11.5, fontWeight: 700, color: T.muted }}>NCR-2026-0184</Mono>
        <div style={{ flex: 1 }}/>
        <StatusPill T={T} tone="warn">Awaiting you</StatusPill>
      </div>
      <div style={{ padding: '0 16px 14px' }}>
        <div style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>NCR disposition approval</div>
        <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3, marginTop: 2 }}>Use-as-is — 12 units</div>
      </div>
    </div>
    <Body style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card T={T} style={{ padding: 14 }}>
        <SectionLabel T={T} style={{ marginBottom: 10 }}>Request summary</SectionLabel>
        {[
          { l: 'Requested by', r: 'Lin Wei · Quality Eng' }, { l: 'Non-conformity', r: 'Weld porosity ≤ 3mm' },
          { l: 'Justification', r: 'Non-load-bearing seam' }, { l: 'Customer waiver', r: 'On file · #WV-2210' },
        ].map((row, i, a) => (
          <div key={row.l} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: i < a.length - 1 ? `1px solid ${T.border}` : 'none', fontSize: 13 }}>
            <span style={{ color: T.muted, flexShrink: 0 }}>{row.l}</span><span style={{ fontWeight: 600, textAlign: 'right' }}>{row.r}</span>
          </div>
        ))}
      </Card>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ width: 84, height: 84, borderRadius: 10, background: 'linear-gradient(135deg,#475569,#1e293b)' }}/>
        <div style={{ width: 84, height: 84, borderRadius: 10, background: 'linear-gradient(135deg,#64748b,#334155)' }}/>
        <div style={{ flex: 1, borderRadius: 10, background: T.bgSubtle, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.muted, fontSize: 12, fontWeight: 600 }}>+2</div>
      </div>
      <div>
        <SectionLabel T={T} style={{ marginBottom: 8 }}>Reason / decision note <span style={{ color: T.dangerFg }}>*</span></SectionLabel>
        <Card T={T} style={{ padding: '11px 12px', minHeight: 76, fontSize: 13, color: T.text }}>
          Approved on condition of 100% re-inspection of the remaining lot and a torque-log audit by Friday.
          <span style={{ display: 'inline-block', width: 1.5, height: 15, background: T.accent, marginLeft: 2, verticalAlign: 'middle' }}/>
        </Card>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>A reason is recorded on the audit trail for every approve / reject.</div>
      </div>
    </Body>
    <ActionBar T={T} platform={platform}>
      <GhostBtn T={T} style={{ flex: 1, color: T.dangerFg }}>Reject</GhostBtn>
      <PrimaryBtn T={T} icon="check" style={{ flex: 2 }}>Approve disposition</PrimaryBtn>
    </ActionBar>
  </MScreen>
);

// ── Assign / reassign (bottom sheet over list) ──
const AssignSheet = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform} style={{ background: T.bg }}>
    <div style={{ flex: 1, position: 'relative' }}>
      {/* dimmed list behind */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.4, pointerEvents: 'none', filter: 'saturate(0.7)' }}>
        <MHeader T={T} platform={platform} overline="Manager" title="Assign work" sync="synced"/>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }}/>
      {/* sheet */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: T.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: `10px 16px ${botInset(platform) + 16}px`, boxShadow: '0 -12px 40px -8px rgba(0,0,0,0.3)' }}>
        <div style={{ width: 40, height: 5, borderRadius: 999, background: T.borderStrong, margin: '0 auto 14px' }}/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>Reassign inspection</span>
        </div>
        <Mono style={{ fontSize: 11.5, color: T.muted }}>INS-0423 · PPE compliance floor walk</Mono>
        <div style={{ position: 'relative', margin: '14px 0 6px' }}>
          <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.subtle }}><MI name="search" size={16}/></div>
          <div style={{ height: 42, borderRadius: 10, border: `1px solid ${T.border}`, background: T.bg, padding: '0 12px 0 36px', display: 'flex', alignItems: 'center', fontSize: 13.5, color: T.subtle }}>Search teammates…</div>
        </div>
        {[
          { i: 'SC', n: 'Sara Chen', s: 'Welding · 2 open', load: 'Light', tone: T.success },
          { i: 'MR', n: 'Marcus Reyes', s: 'All lines · 5 open', load: 'Busy', tone: T.warn, sel: true },
          { i: 'AP', n: 'Anna Park', s: 'Cleanroom · 1 open', load: 'Light', tone: T.success },
        ].map((m, i, a) => (
          <div key={m.i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 8px', borderBottom: i < a.length - 1 ? `1px solid ${T.border}` : 'none' }}>
            <Avatar T={T} initials={m.i} size={36} tone={m.sel ? 'accent' : 'neutral'}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{m.n}</div>
              <div style={{ fontSize: 11.5, color: T.muted }}>{m.s}</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: m.tone }}>{m.load}</span>
            <div style={{ width: 22, height: 22, borderRadius: '50%', border: `1.5px solid ${m.sel ? T.accent : T.borderStrong}`, background: m.sel ? T.accent : 'transparent', color: T.accentFg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{m.sel && <MI name="check" size={13} stroke={3}/>}</div>
          </div>
        ))}
        <PrimaryBtn T={T} style={{ marginTop: 16 }}>Assign to Marcus Reyes</PrimaryBtn>
      </div>
    </div>
  </MScreen>
);

// ── Team & plant snapshot ──
const TeamSnapshot = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <MHeader T={T} platform={platform} overline="Plant A · Detroit" title="Team & plant" sync="synced"/>
    <Body>
      <div style={{ display: 'flex', gap: 10, padding: '14px 16px 4px' }}>
        <Kpi T={T} label="On shift" value="8" delta="/ 11"/>
        <Kpi T={T} label="Open work" value="17"/>
        <Kpi T={T} label="Overdue" value="3" tone={T.dangerFg}/>
      </div>
      <SectionLabel T={T} style={{ padding: '18px 16px 8px' }}>By line</SectionLabel>
      <Card T={T} style={{ margin: '0 16px' }}>
        {[
          { l: 'Welding', open: 6, pass: 92 }, { l: 'Cleanroom', open: 3, pass: 99 },
          { l: 'Receiving', open: 5, pass: 88 }, { l: 'Press shop', open: 3, pass: 95 },
        ].map((r, i, a) => (
          <div key={r.l} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i < a.length - 1 ? `1px solid ${T.border}` : 'none' }}>
            <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{r.l}</div>
            <div style={{ width: 90 }}>
              <div style={{ height: 5, background: T.bgSubtle, borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: r.pass + '%', height: '100%', background: r.pass >= 95 ? T.success : r.pass >= 90 ? T.warn : T.danger }}/>
              </div>
            </div>
            <Mono style={{ fontSize: 12, fontWeight: 600, width: 34, textAlign: 'right' }}>{r.pass}%</Mono>
            <span style={{ fontSize: 11.5, color: T.muted, width: 52, textAlign: 'right' }}>{r.open} open</span>
          </div>
        ))}
      </Card>
      <SectionLabel T={T} style={{ padding: '18px 16px 8px' }}>People</SectionLabel>
      <Card T={T} style={{ margin: '0 16px' }}>
        {[
          { i: 'SC', n: 'Sara Chen', r: 'Inspector', st: 'Active', tone: T.success },
          { i: 'MR', n: 'Marcus Reyes', r: 'Inspector', st: 'Offline 12m', tone: T.warn },
          { i: 'AP', n: 'Anna Park', r: 'Auditor', st: 'Active', tone: T.success },
          { i: 'LW', n: 'Lin Wei', r: 'Quality Eng', st: 'Active', tone: T.success },
        ].map((m, i, a) => (
          <div key={m.i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderBottom: i < a.length - 1 ? `1px solid ${T.border}` : 'none' }}>
            <Avatar T={T} initials={m.i} size={34}/>
            <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 600 }}>{m.n}</div><div style={{ fontSize: 11.5, color: T.muted }}>{m.r}</div></div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: m.tone }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: m.tone }}/>{m.st}</span>
          </div>
        ))}
      </Card>
      <div style={{ height: 16 }}/>
    </Body>
    <TabBar T={T} platform={platform} active="team" tabs={[
      { id: 'home', icon: 'home', label: 'Home' },
      { id: 'approvals', icon: 'check', label: 'Approvals', badge: 5 },
      { id: 'add', fab: true },
      { id: 'team', icon: 'users', label: 'Team' },
      { id: 'me', icon: 'user', label: 'Me' },
    ]}/>
  </MScreen>
);

// ── Manage in web app (admin) ──
const ManageInWeb = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <MHeader T={T} platform={platform} back overline="Admin" title="Manage in web app" sync="synced"/>
    <Body style={{ padding: '14px 16px' }}>
      <Card T={T} style={{ padding: 14, display: 'flex', gap: 12, alignItems: 'center', background: T.bgSubtle, border: 'none', marginBottom: 16 }}>
        <MI name="info" size={18} color={T.muted}/>
        <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.45 }}>These config-heavy areas live in the desktop app. We'll open them there with your session.</div>
      </Card>
      {[
        { i: 'reports', t: 'Report builder', d: 'Custom SPC & compliance reports' },
        { i: 'plug', t: 'Integrations & connectors', d: 'ERP, MES, webhooks' },
        { i: 'upload', t: 'Bulk import', d: 'Assets, templates, users' },
        { i: 'user', t: 'Members & roles', d: 'RBAC, invitations, groups' },
        { i: 'shield', t: 'Session & security policy', d: 'MFA rules, IP allowlists' },
        { i: 'palette', t: 'White-label & branding', d: 'Logos, domains, themes' },
        { i: 'lineChart', t: 'SPC authoring', d: 'Control charts & rules' },
      ].map((r, i, a) => (
        <div key={r.t} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 4px', borderBottom: i < a.length - 1 ? `1px solid ${T.border}` : 'none' }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: T.bgSubtle, color: T.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MI name={r.i} size={17}/></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600 }}>{r.t}</div><div style={{ fontSize: 11.5, color: T.muted }}>{r.d}</div></div>
          <span style={{ fontSize: 11.5, color: T.accent, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>Web <MI name="arrowRight" size={13}/></span>
        </div>
      ))}
    </Body>
  </MScreen>
);

Object.assign(window, { ApprovalsInbox, ApprovalItem, AssignSheet, TeamSnapshot, ManageInWeb });
