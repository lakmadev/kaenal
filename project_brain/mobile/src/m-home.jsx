// Kaenal Mobile — Role-aware Home / Dashboards
// Inspector (my queue), Viewer (read-only, role-reduced), Manager (+approvals/team),
// Admin (Workspace pulse + audit highlights). Curated by role; server still enforces.

// KPI stat
const Kpi = ({ T, label, value, tone, delta }) => (
  <Card T={T} style={{ padding: '12px 14px', flex: 1, minWidth: 0 }}>
    <div style={{ fontSize: 11, color: T.muted, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
      <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: tone || T.text }}>{value}</span>
      {delta && <span style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>{delta}</span>}
    </div>
  </Card>
);

const QueueItem = ({ T, it, last }) => (
  <div style={{ padding: '13px 14px', borderBottom: last ? 'none' : `1px solid ${T.border}` }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
      <Mono style={{ fontSize: 10.5, fontWeight: 700, color: T.muted }}>{it.id}</Mono>
      {it.sev && <Sev T={T} level={it.sev}/>}
      <div style={{ flex: 1 }}/>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: it.overdue ? T.dangerFg : T.muted }}>{it.due}</span>
    </div>
    <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.3 }}>{it.title}</div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: T.muted, marginTop: 5 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><MI name="mapPin" size={12}/>{it.site}</span>
      <span>·</span><span>{it.meta}</span>
    </div>
  </div>
);

// ── Inspector home ──
const HomeInspector = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <MHeader T={T} platform={platform} overline="Plant A · Detroit" title="Good morning, Sara" sync="pending"
      right={<BellBtn T={T} count={3}/>}/>
    <Body>
      <div style={{ display: 'flex', gap: 10, padding: '14px 16px 4px' }}>
        <Kpi T={T} label="Assigned" value="6" delta="2 due"/>
        <Kpi T={T} label="Overdue" value="2" tone={T.dangerFg}/>
        <Kpi T={T} label="Pass rate" value="94%" delta="wk"/>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 8px' }}>
        <SectionLabel T={T}>Today's work queue</SectionLabel>
        <a href="#" style={{ fontSize: 12.5, color: T.accent, fontWeight: 600 }}>See all</a>
      </div>
      <Card T={T} style={{ margin: '0 16px' }}>
        {[
          { id: 'INS-0421', title: 'Line 3 — Weld station daily checks', sev: 'high', due: 'Due 2h', site: 'Welding', meta: '14 questions' },
          { id: 'INS-0423', title: 'PPE compliance — Floor walk', sev: 'critical', due: 'Overdue 1d', overdue: true, site: 'All lines', meta: '12 questions' },
          { id: 'INS-0422', title: 'Cleanroom particle count — Suite B', sev: 'medium', due: 'Due now', site: 'Cleanroom', meta: '6 questions' },
        ].map((it, i, a) => <QueueItem key={it.id} T={T} it={it} last={i === a.length - 1}/>)}
      </Card>
      <SectionLabel T={T} style={{ padding: '18px 16px 8px' }}>Assigned to me</SectionLabel>
      <Card T={T} style={{ margin: '0 16px' }}>
        <Row T={T} icon="alert" iconTone="#ea580c" title="NCR-2026-0184 needs your action" sub="Bracket weld · High" right={<StatusPill T={T} tone="open">Open</StatusPill>} chevron/>
        <Row T={T} icon="tool" iconTone={T.info} title="CAPA-0091 · Verify containment" sub="Due Friday" last chevron/>
      </Card>
      <div style={{ height: 16 }}/>
    </Body>
    <TabBar T={T} platform={platform} active="home"/>
  </MScreen>
);

// ── Viewer home (role-reduced: read-only, no perform/create/approve, no FAB) ──
const HomeViewer = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <MHeader T={T} platform={platform} overline="Plant A · Detroit" title="Overview" sync="synced"
      right={<BellBtn T={T} count={1}/>}/>
    <Body>
      <div style={{ padding: '12px 16px 0' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, background: T.bgSubtle, color: T.muted, fontSize: 11.5, fontWeight: 600 }}>
          <MI name="eye" size={13}/> Read-only access
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, padding: '12px 16px 4px' }}>
        <Kpi T={T} label="Open NCRs" value="8"/>
        <Kpi T={T} label="Inspections wk" value="42" delta="94% pass"/>
      </div>
      <SectionLabel T={T} style={{ padding: '16px 16px 8px' }}>Recent records</SectionLabel>
      <Card T={T} style={{ margin: '0 16px' }}>
        <Row T={T} icon="alert" iconTone="#ea580c" title="Bracket weld inconsistent" sub="NCR-2026-0184 · High" right={<StatusPill T={T} tone="open">Open</StatusPill>} chevron/>
        <Row T={T} icon="clipboard" iconTone={T.success} title="Line 3 weld daily checks" sub="INS-0418 · Passed" right={<StatusPill T={T} tone="done">Done</StatusPill>} chevron/>
        <Row T={T} icon="doc" iconTone={T.info} title="Cleanroom SOP v4" sub="Approved · read" last chevron/>
      </Card>
      <Card T={T} style={{ margin: '16px', padding: 14, display: 'flex', gap: 12, alignItems: 'center', background: T.bgSubtle, border: 'none' }}>
        <MI name="info" size={18} color={T.muted}/>
        <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.45 }}>Your role can view records but not perform, create or approve. Actions are hidden accordingly.</div>
      </Card>
    </Body>
    <TabBar T={T} platform={platform} active="home" fab={false} tabs={[
      { id: 'home', icon: 'home', label: 'Home' },
      { id: 'records', icon: 'folder', label: 'Records' },
      { id: 'bell', icon: 'bell', label: 'Alerts' },
      { id: 'me', icon: 'user', label: 'Me' },
    ]}/>
  </MScreen>
);

// ── Manager home (Inspector surfaces + approvals inbox + team) ──
const HomeManager = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <MHeader T={T} platform={platform} overline="Plant A · Manager" title="Plant snapshot" sync="synced"
      right={<BellBtn T={T} count={4}/>}/>
    <Body>
      <div style={{ display: 'flex', gap: 10, padding: '14px 16px 4px' }}>
        <Kpi T={T} label="Awaiting" value="5" tone={T.warnFg}/>
        <Kpi T={T} label="Open NCRs" value="12"/>
        <Kpi T={T} label="On-time" value="88%"/>
      </div>
      <Card T={T} style={{ margin: '14px 16px 0', padding: 14, display: 'flex', gap: 12, alignItems: 'center' }}
        onClick={() => {}}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: T.warnBg, color: T.warnFg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MI name="check" size={20}/></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>Approvals inbox</div>
          <div style={{ fontSize: 12, color: T.muted }}>3 documents · 2 NCR dispositions</div>
        </div>
        <span style={{ minWidth: 24, height: 24, padding: '0 7px', borderRadius: 999, background: T.danger, color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>5</span>
      </Card>
      <SectionLabel T={T} style={{ padding: '18px 16px 8px' }}>Team today</SectionLabel>
      <Card T={T} style={{ margin: '0 16px' }}>
        {[
          { i: 'SC', n: 'Sara Chen', s: '4 done · 2 in progress', tone: T.success, st: 'Active' },
          { i: 'MR', n: 'Marcus Reyes', s: '1 overdue · offline', tone: T.warn, st: 'Offline' },
          { i: 'AP', n: 'Anna Park', s: '6 done', tone: T.success, st: 'Active' },
        ].map((m, i, a) => (
          <div key={m.i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderBottom: i < a.length - 1 ? `1px solid ${T.border}` : 'none' }}>
            <Avatar T={T} initials={m.i} size={32}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{m.n}</div>
              <div style={{ fontSize: 11.5, color: T.muted }}>{m.s}</div>
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: m.tone }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.tone }}/>{m.st}
            </span>
          </div>
        ))}
      </Card>
      <div style={{ height: 16 }}/>
    </Body>
    <TabBar T={T} platform={platform} active="home" tabs={[
      { id: 'home', icon: 'home', label: 'Home' },
      { id: 'approvals', icon: 'check', label: 'Approvals', badge: 5 },
      { id: 'add', fab: true },
      { id: 'team', icon: 'users', label: 'Team' },
      { id: 'me', icon: 'user', label: 'Me' },
    ]}/>
  </MScreen>
);

// ── Admin home — Workspace pulse + read-only audit highlights ──
const HomeAdmin = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <MHeader T={T} platform={platform} overline="Northstar Mfg · Admin" title="Workspace pulse" sync="synced"
      right={<BellBtn T={T} count={5}/>}/>
    <Body>
      <div style={{ display: 'flex', gap: 10, padding: '14px 16px 4px' }}>
        <Kpi T={T} label="Active today" value="38" delta="/ 52"/>
        <Kpi T={T} label="Failed syncs" value="3" tone={T.dangerFg}/>
        <Kpi T={T} label="Awaiting" value="5" tone={T.warnFg}/>
      </div>
      <SectionLabel T={T} style={{ padding: '18px 16px 8px' }}>Needs attention</SectionLabel>
      <Card T={T} style={{ margin: '0 16px' }}>
        <Row T={T} icon="shield" iconTone={T.warn} title="2 sign-in anomalies" sub="New device · Marcus R · 06:12" right={<StatusPill T={T} tone="warn">Review</StatusPill>} chevron/>
        <Row T={T} icon="cloudOff" iconTone={T.danger} title="3 failed syncs" sub="Cleanroom tablet · 12 MB stuck" right={<StatusPill T={T} tone="danger">Failed</StatusPill>} last chevron/>
      </Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 16px 8px' }}>
        <SectionLabel T={T}>Audit highlights</SectionLabel>
        <span style={{ fontSize: 11, color: T.subtle }}>read-only · sensitive events</span>
      </div>
      <Card T={T} style={{ margin: '0 16px' }}>
        {[
          { i: 'key', t: 'Role changed', d: 'A. Park → Manager · by P. Iyer', tm: '09:41' },
          { i: 'logOut', t: 'MFA reset', d: 'M. Reyes · recovery code used', tm: '08:20' },
          { i: 'download', t: 'Bulk export', d: 'NCR register · 214 rows', tm: 'Yesterday' },
        ].map((e, i, a) => (
          <div key={e.t} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderBottom: i < a.length - 1 ? `1px solid ${T.border}` : 'none' }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: T.bgSubtle, color: T.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MI name={e.i} size={15}/></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{e.t}</div>
              <div style={{ fontSize: 11.5, color: T.muted }}>{e.d}</div>
            </div>
            <Mono style={{ fontSize: 11, color: T.subtle }}>{e.tm}</Mono>
          </div>
        ))}
      </Card>
      <Card T={T} style={{ margin: '16px', padding: '13px 14px', display: 'flex', gap: 12, alignItems: 'center', background: T.bgSubtle, border: 'none' }} onClick={() => {}}>
        <MI name="globe" size={18} color={T.muted}/>
        <div style={{ flex: 1, fontSize: 12.5, color: T.text, fontWeight: 600 }}>Config, reports & members</div>
        <span style={{ fontSize: 12, color: T.accent, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>Open web <MI name="arrowRight" size={13}/></span>
      </Card>
    </Body>
    <TabBar T={T} platform={platform} active="home" tabs={[
      { id: 'home', icon: 'home', label: 'Pulse' },
      { id: 'approvals', icon: 'check', label: 'Approvals', badge: 5 },
      { id: 'add', fab: true },
      { id: 'audit', icon: 'shield', label: 'Audit' },
      { id: 'me', icon: 'user', label: 'Me' },
    ]}/>
  </MScreen>
);

Object.assign(window, { HomeInspector, HomeViewer, HomeManager, HomeAdmin, Kpi, QueueItem });
