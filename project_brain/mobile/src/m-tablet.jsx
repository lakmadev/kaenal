// Kaenal Mobile — Tablet (iPad / Android tablet) adaptive layouts
// Breakpoint response: bottom tabs become a SIDE RAIL; single column becomes
// two-pane MASTER–DETAIL. Landscape. Shown for the highest-value flows.

// side rail (bottom tabs promoted to the left edge)
const SideRail = ({ T, active = 'inspect' }) => {
  const items = [
    { id: 'home', i: 'home', l: 'Home' }, { id: 'inspect', i: 'clipboard', l: 'Inspect' },
    { id: 'ncr', i: 'alert', l: 'NCRs' }, { id: 'approvals', i: 'check', l: 'Approve' },
    { id: 'team', i: 'users', l: 'Team' },
  ];
  return (
    <div style={{ width: 84, flexShrink: 0, background: T.surface, borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 18, gap: 4 }}>
      <span style={{ color: T.accent, marginBottom: 14 }}><Icon name="logo" size={26}/></span>
      {items.map(t => {
        const on = t.id === active;
        return (
          <div key={t.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 0', width: 64, borderRadius: 12, background: on ? T.accentSoft : 'transparent', color: on ? T.accent : T.subtle }}>
            <MI name={t.i} size={22} stroke={on ? 2.3 : 1.9}/>
            <span style={{ fontSize: 10, fontWeight: on ? 700 : 500 }}>{t.l}</span>
          </div>
        );
      })}
      <div style={{ flex: 1 }}/>
      <div style={{ paddingBottom: 18 }}><Avatar T={T} initials="SC" size={38} tone="accent"/></div>
    </div>
  );
};

const TabletShell = ({ T, active, master, detail, masterW = 340 }) => (
  <div style={{ display: 'flex', height: '100%', background: T.bg, color: T.text, fontFamily: SANS }}>
    <SideRail T={T} active={active}/>
    <div style={{ width: masterW, flexShrink: 0, borderRight: `1px solid ${T.border}`, background: T.surface, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>{master}</div>
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>{detail}</div>
  </div>
);

// ── Inspections list + runner ──
const TabletInspections = ({ T }) => (
  <TabletShell T={T} active="inspect"
    master={
      <>
        <div style={{ padding: '20px 18px 12px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>Today's work</div>
            <SyncPill T={T} state="pending"/>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            {[{ l: 'Assigned · 6', on: true }, { l: 'Overdue · 2' }].map(p => (
              <span key={p.l} style={{ padding: '5px 11px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: p.on ? T.accent : T.bgSubtle, color: p.on ? T.accentFg : T.muted }}>{p.l}</span>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {[
            { id: 'INS-0421', t: 'Weld station daily checks', sev: 'high', due: 'Due 2h', on: true },
            { id: 'INS-0422', t: 'Cleanroom particle count', sev: 'medium', due: 'Due now' },
            { id: 'INS-0423', t: 'PPE compliance floor walk', sev: 'critical', due: 'Overdue 1d' },
            { id: 'INS-0424', t: 'Incoming steel coils QA-7', sev: 'medium', due: 'Tomorrow' },
            { id: 'INS-0425', t: 'Forklift pre-shift', sev: 'high', due: 'Due 3pm' },
          ].map(it => (
            <div key={it.id} style={{ padding: '13px 18px', borderBottom: `1px solid ${T.border}`, background: it.on ? T.accentSoft : 'transparent', borderLeft: it.on ? `3px solid ${T.accent}` : '3px solid transparent' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <Mono style={{ fontSize: 10, fontWeight: 700, color: T.muted }}>{it.id}</Mono><Sev T={T} level={it.sev}/><div style={{ flex: 1 }}/>
                <span style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>{it.due}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{it.t}</div>
            </div>
          ))}
        </div>
      </>
    }
    detail={
      <>
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${T.border}`, background: T.surface }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Mono style={{ fontSize: 11, fontWeight: 700, color: T.muted }}>INS-0421 · WELDING</Mono>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', marginTop: 2 }}>Weld station daily checks</div>
            </div>
            <div style={{ width: 180 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.muted, marginBottom: 4 }}><span>Progress</span><Mono>8/14</Mono></div>
              <div style={{ height: 6, background: T.bgSubtle, borderRadius: 999, overflow: 'hidden' }}><div style={{ width: '57%', height: '100%', background: T.accent }}/></div>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          <SectionLabel T={T} style={{ marginBottom: 12 }}>Section 3 of 5 · Weld parameters</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Card T={T} style={{ padding: 16 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 12 }}>Wire feed pressure 3.2–3.8 bar?</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {['Pass', 'Fail', 'N/A'].map(o => (
                  <div key={o} style={{ flex: 1, height: 42, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13.5, fontWeight: 600, background: o === 'Pass' ? T.successBg : T.surface, color: o === 'Pass' ? T.successFg : T.muted, border: `1.5px solid ${o === 'Pass' ? T.success : T.border}` }}>{o}</div>
                ))}
              </div>
            </Card>
            <Card T={T} style={{ padding: 16 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 12 }}>Surface finish rating (1–5)</div>
              <div style={{ display: 'flex', gap: 6 }}>{[1, 2, 3, 4, 5].map(n => <div key={n} style={{ flex: 1, height: 42, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, background: n === 4 ? T.accent : T.surface, color: n === 4 ? T.accentFg : T.muted, border: `1.5px solid ${n === 4 ? T.accent : T.border}` }}>{n}</div>)}</div>
            </Card>
            <Card T={T} style={{ padding: 16, gridColumn: '1 / 3', borderTop: `2.5px solid ${T.accent}` }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 12 }}>Photograph weld bead — points A, B, C · stylus annotation supported on tablet</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {['Point A', 'Point B'].map(p => <div key={p} style={{ width: 96, height: 96, borderRadius: 10, background: 'linear-gradient(135deg,#475569,#1e293b)', position: 'relative' }}><span style={{ position: 'absolute', bottom: 6, left: 8, fontSize: 9, color: '#fff', fontWeight: 600 }}>{p}</span></div>)}
                <button style={{ width: 96, height: 96, borderRadius: 10, border: `2px dashed ${T.borderStrong}`, background: T.bg, color: T.accent, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}><MI name="camera" size={22}/><span style={{ fontSize: 10, fontWeight: 700 }}>Capture</span></button>
              </div>
            </Card>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, padding: '14px 24px', borderTop: `1px solid ${T.border}`, background: T.surface }}>
          <div style={{ flex: 1 }}/>
          <button style={{ height: 44, padding: '0 20px', borderRadius: 10, border: `1px solid ${T.border}`, background: T.dangerBg, color: T.dangerFg, fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8 }}><MI name="flag" size={16}/>Flag NCR</button>
          <button style={{ height: 44, padding: '0 28px', borderRadius: 10, background: T.accent, color: T.accentFg, fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}>Save & next <MI name="arrowRight" size={16} stroke={2.2}/></button>
        </div>
      </>
    }
  />
);

// ── Approvals inbox + item ──
const TabletApprovals = ({ T }) => (
  <TabletShell T={T} active="approvals"
    master={
      <>
        <div style={{ padding: '20px 18px 12px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ flex: 1, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>Approvals</div><SyncPill T={T} state="synced"/></div>
          <div style={{ fontSize: 12.5, color: T.muted, marginTop: 4 }}>5 pending</div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {[
            { id: 'NCR-2026-0184', t: 'Disposition: Use-as-is', by: 'Lin Wei', tag: 'NCR', on: true },
            { id: 'DOC-118', t: 'Cleanroom SOP v4 release', by: 'Anna Park', tag: 'Doc' },
            { id: 'DOC-121', t: 'Welding WI-07 revision', by: 'Sara Chen', tag: 'Doc' },
            { id: 'NCR-2026-0180', t: 'Disposition: Scrap', by: 'M. Reyes', tag: 'NCR' },
          ].map(it => (
            <div key={it.id} style={{ padding: '13px 18px', borderBottom: `1px solid ${T.border}`, background: it.on ? T.accentSoft : 'transparent', borderLeft: it.on ? `3px solid ${T.accent}` : '3px solid transparent' }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}><Mono style={{ fontSize: 10, fontWeight: 700, color: T.muted }}>{it.id}</Mono><span style={{ fontSize: 9.5, fontWeight: 700, color: T.subtle, textTransform: 'uppercase' }}>{it.tag}</span></div>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{it.t}</div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>by {it.by}</div>
            </div>
          ))}
        </div>
      </>
    }
    detail={
      <div style={{ flex: 1, overflowY: 'auto', padding: 28, maxWidth: 640 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Mono style={{ fontSize: 12, fontWeight: 700, color: T.muted }}>NCR-2026-0184</Mono><StatusPill T={T} tone="warn">Awaiting you</StatusPill>
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Use-as-is disposition — 12 units</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 20 }}>
          <Card T={T} style={{ padding: 16 }}>
            <SectionLabel T={T} style={{ marginBottom: 10 }}>Request</SectionLabel>
            {[['Requested by', 'Lin Wei'], ['Non-conformity', 'Weld porosity ≤3mm'], ['Justification', 'Non-load-bearing'], ['Waiver', '#WV-2210']].map((r, i, a) => (
              <div key={r[0]} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < a.length - 1 ? `1px solid ${T.border}` : 'none', fontSize: 13 }}><span style={{ color: T.muted }}>{r[0]}</span><span style={{ fontWeight: 600 }}>{r[1]}</span></div>
            ))}
          </Card>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignContent: 'start' }}>
            {[0, 1, 2, 3].map(i => <div key={i} style={{ aspectRatio: '1', borderRadius: 10, background: 'linear-gradient(135deg,#475569,#1e293b)' }}/>)}
          </div>
        </div>
        <SectionLabel T={T} style={{ margin: '20px 0 8px' }}>Reason / decision note *</SectionLabel>
        <Card T={T} style={{ padding: '12px 14px', minHeight: 70, fontSize: 13.5 }}>Approved on condition of 100% re-inspection of the remaining lot and a torque-log audit by Friday.</Card>
        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <div style={{ flex: 1 }}/>
          <button style={{ height: 44, padding: '0 22px', borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface, color: T.dangerFg, fontSize: 14, fontWeight: 600 }}>Reject</button>
          <button style={{ height: 44, padding: '0 28px', borderRadius: 10, background: T.accent, color: T.accentFg, fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}><MI name="check" size={16} stroke={2.2}/>Approve</button>
        </div>
      </div>
    }
  />
);

// ── Dashboard as multi-column KPI board ──
const TabletDashboard = ({ T }) => (
  <TabletShell T={T} active="home" masterW={0}
    master={null}
    detail={
      <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ flex: 1 }}><div style={{ fontSize: 12.5, color: T.muted, fontWeight: 600 }}>Plant A · Manager</div><div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Plant snapshot</div></div>
          <SyncPill T={T} state="synced"/>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 18 }}>
          {[{ l: 'Awaiting approval', v: '5', t: T.warnFg }, { l: 'Open NCRs', v: '12' }, { l: 'On-time', v: '88%' }, { l: 'Pass rate wk', v: '94%', t: T.successFg }].map(k => (
            <Card T={T} key={k.l} style={{ padding: '16px 18px' }}><div style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>{k.l}</div><div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 6, color: k.t || T.text }}>{k.v}</div></Card>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14, marginTop: 14 }}>
          <Card T={T} style={{ padding: 18 }}>
            <SectionLabel T={T} style={{ marginBottom: 14 }}>Pass rate by line</SectionLabel>
            {[{ l: 'Welding', p: 92 }, { l: 'Cleanroom', p: 99 }, { l: 'Receiving', p: 88 }, { l: 'Press shop', p: 95 }].map((r, i, a) => (
              <div key={r.l} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderBottom: i < a.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                <div style={{ width: 90, fontSize: 13.5, fontWeight: 600 }}>{r.l}</div>
                <div style={{ flex: 1, height: 8, background: T.bgSubtle, borderRadius: 999, overflow: 'hidden' }}><div style={{ width: r.p + '%', height: '100%', background: r.p >= 95 ? T.success : r.p >= 90 ? T.warn : T.danger }}/></div>
                <Mono style={{ fontSize: 13, fontWeight: 600, width: 40, textAlign: 'right' }}>{r.p}%</Mono>
              </div>
            ))}
          </Card>
          <Card T={T} style={{ padding: 18 }}>
            <SectionLabel T={T} style={{ marginBottom: 12 }}>Needs attention</SectionLabel>
            {[{ i: 'alert', t: 'NCR-0184 disposition', tone: '#ea580c' }, { i: 'cloudOff', t: '3 failed syncs', tone: T.danger }, { i: 'clock', t: '3 overdue inspections', tone: T.warn }].map((r, i, a) => (
              <div key={r.t} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 0', borderBottom: i < a.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: r.tone + (T.dark ? '26' : '16'), color: r.tone, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MI name={r.i} size={16}/></div>
                <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{r.t}</div>
                <MI name="chevronRight" size={16} color={T.subtle}/>
              </div>
            ))}
          </Card>
        </div>
      </div>
    }
  />
);

Object.assign(window, { TabletShell, SideRail, TabletInspections, TabletApprovals, TabletDashboard });
