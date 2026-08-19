// Kaenal Mobile — My Tasks · 8D follow-up (mobile subset) · CAPA action check-off

// ── My Tasks — unified inbox across modules ──
const MyTasks = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <MHeader T={T} platform={platform} overline="Assigned to me" title="My Tasks" sync="synced"/>
    <div style={{ display: 'flex', gap: 7, padding: '10px 16px', overflowX: 'auto', background: T.surface, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
      {[{ l: 'All · 9', on: true }, { l: 'Due soon · 3' }, { l: 'NCR · 2' }, { l: '8D · 1' }, { l: 'CAPA · 2' }].map(p => (
        <span key={p.l} style={{ padding: '6px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', background: p.on ? T.accent : T.bgSubtle, color: p.on ? T.accentFg : T.muted }}>{p.l}</span>
      ))}
    </div>
    <Body>
      {[
        { grp: 'Overdue', items: [
          { i: 'alert', tone: '#ea580c', id: 'NCR-2026-0184', t: 'Add disposition to bracket weld NCR', due: 'Overdue 1d', tag: 'NCR' },
        ]},
        { grp: 'Today', items: [
          { i: 'clipboard', tone: T.info, id: 'INS-0421', t: 'Weld station daily checks', due: 'Due 2h', tag: 'Inspection' },
          { i: 'tool', tone: T.success, id: 'CAPA-0091', t: 'Verify containment effectiveness', due: 'Due 5pm', tag: 'CAPA' },
          { i: 'gitBranch', tone: '#7c3aed', id: '8D-0042 · D5', t: 'Confirm permanent corrective action', due: 'Due today', tag: '8D' },
        ]},
        { grp: 'This week', items: [
          { i: 'doc', tone: T.muted, id: 'DOC-118', t: 'Acknowledge revised Cleanroom SOP', due: 'Thu', tag: 'Document' },
          { i: 'clipboard', tone: T.info, id: 'INS-0430', t: 'Monthly calibration audit', due: 'Fri', tag: 'Inspection' },
        ]},
      ].map(g => (
        <div key={g.grp}>
          <SectionLabel T={T} style={{ padding: '14px 16px 6px' }}>{g.grp}</SectionLabel>
          <Card T={T} style={{ margin: '0 16px' }}>
            {g.items.map((it, i, a) => (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i < a.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: it.tone + (T.dark ? '26' : '16'), color: it.tone, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MI name={it.i} size={18}/></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Mono style={{ fontSize: 10, fontWeight: 700, color: T.muted }}>{it.id}</Mono>
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: T.subtle, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{it.tag}</span>
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 1 }}>{it.t}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: it.due.startsWith('Overdue') ? T.dangerFg : T.muted, whiteSpace: 'nowrap' }}>{it.due}</span>
              </div>
            ))}
          </Card>
        </div>
      ))}
      <div style={{ height: 16 }}/>
    </Body>
    <TabBar T={T} platform={platform} active="tasks"/>
  </MScreen>
);

// ── 8D follow-up (mobile subset: view D1–D8, advance/complete owned steps) ──
const EightDFollow = ({ T, platform = 'ios' }) => {
  const steps = [
    { d: 'D1', t: 'Team', st: 'done' }, { d: 'D2', t: 'Problem', st: 'done' },
    { d: 'D3', t: 'Containment', st: 'done' }, { d: 'D4', t: 'Root cause', st: 'done' },
    { d: 'D5', t: 'Corrective action', st: 'current', mine: true }, { d: 'D6', t: 'Implement', st: 'todo' },
    { d: 'D7', t: 'Prevent', st: 'todo' }, { d: 'D8', t: 'Close', st: 'todo' },
  ];
  return (
    <MScreen T={T} platform={platform}>
      <div style={{ paddingTop: topInset(platform), background: T.surface, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
          <button style={{ padding: 4, color: T.text }}><MI name="chevronLeft" size={24} stroke={2}/></button>
          <Mono style={{ fontSize: 11.5, fontWeight: 700, color: T.muted }}>8D-0042</Mono>
          <div style={{ flex: 1 }}/>
          <StatusPill T={T} tone="progress">D5 of 8</StatusPill>
        </div>
        <div style={{ padding: '0 16px 14px' }}>
          <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.3 }}>Recurring weld porosity — Line 2/3</div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>Champion: Lin Wei · linked NCR-2026-0184</div>
        </div>
      </div>
      <Body style={{ padding: '14px 16px' }}>
        <SectionLabel T={T} style={{ marginBottom: 10 }}>Discipline progress</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {steps.map((s, i) => (
            <div key={s.d} style={{ display: 'flex', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700,
                  background: s.st === 'done' ? T.success : s.st === 'current' ? T.accent : T.bgSubtle,
                  color: s.st === 'todo' ? T.muted : (s.st === 'done' ? '#fff' : T.accentFg),
                  border: s.st === 'todo' ? `1.5px solid ${T.border}` : 'none',
                }}>{s.st === 'done' ? <MI name="check" size={13} stroke={3}/> : s.d}</div>
                {i < steps.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 20, background: s.st === 'done' ? T.success : T.border }}/>}
              </div>
              <div style={{ flex: 1, paddingBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{s.d} · {s.t}</span>
                  {s.mine && <StatusPill T={T} tone="accent" size="sm">Yours</StatusPill>}
                </div>
                {s.st === 'current' && (
                  <Card T={T} style={{ marginTop: 8, padding: 12 }}>
                    <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.5, marginBottom: 10 }}>Confirm the permanent corrective action and attach verification evidence before advancing to D6.</div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                      <div style={{ width: 54, height: 54, borderRadius: 9, background: 'linear-gradient(135deg,#475569,#1e293b)' }}/>
                      <button style={{ width: 54, height: 54, borderRadius: 9, border: `1.5px dashed ${T.borderStrong}`, background: T.surface, color: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MI name="paperclip" size={18}/></button>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={{ flex: 1, height: 40, borderRadius: 10, background: T.accent, color: T.accentFg, fontSize: 13, fontWeight: 700 }}>Complete D5</button>
                      <button style={{ height: 40, padding: '0 14px', borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontSize: 13, fontWeight: 600 }}>Comment</button>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          ))}
        </div>
      </Body>
    </MScreen>
  );
};

// ── CAPA action check-off ──
const CapaCheckoff = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <div style={{ paddingTop: topInset(platform), background: T.surface, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
        <button style={{ padding: 4, color: T.text }}><MI name="chevronLeft" size={24} stroke={2}/></button>
        <Mono style={{ fontSize: 11.5, fontWeight: 700, color: T.muted }}>CAPA-0091</Mono>
        <div style={{ flex: 1 }}/>
        <StatusPill T={T} tone="progress">In progress</StatusPill>
      </div>
      <div style={{ padding: '0 16px 14px' }}>
        <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.3 }}>Re-torque fixture bolts to spec</div>
        <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>My action · due Friday · from 8D-0042 D6</div>
      </div>
    </div>
    <Body style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card T={T} style={{ padding: 14 }}>
        <SectionLabel T={T} style={{ marginBottom: 8 }}>Action</SectionLabel>
        <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>Apply calibrated torque wrench to all 6 fixture bolts on Weld Cell 3 at 42 Nm. Record readings and photograph the torque log.</div>
      </Card>
      <div>
        <SectionLabel T={T} style={{ marginBottom: 8 }}>Checklist</SectionLabel>
        <Card T={T}>
          {[{ l: 'Torque wrench calibrated (cert current)', on: true }, { l: 'All 6 bolts re-torqued to 42 Nm', on: true }, { l: 'Torque log photographed', on: false }].map((c, i, a) => (
            <div key={c.l} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: i < a.length - 1 ? `1px solid ${T.border}` : 'none', fontSize: 13 }}>
              <div style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${c.on ? T.accent : T.borderStrong}`, background: c.on ? T.accent : 'transparent', color: T.accentFg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.on && <MI name="check" size={12} stroke={3}/>}</div>
              <span style={{ flex: 1, fontWeight: 500, textDecoration: c.on ? 'none' : 'none', color: c.on ? T.text : T.text }}>{c.l}</span>
            </div>
          ))}
        </Card>
      </div>
      <div>
        <SectionLabel T={T} style={{ marginBottom: 8 }}>Evidence</SectionLabel>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ width: 64, height: 64, borderRadius: 10, background: 'linear-gradient(135deg,#475569,#1e293b)' }}/>
          <button style={{ width: 64, height: 64, borderRadius: 10, border: `1.5px dashed ${T.borderStrong}`, background: T.surface, color: T.accent, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}><MI name="camera" size={19}/><span style={{ fontSize: 9, fontWeight: 700 }}>Add</span></button>
        </div>
      </div>
    </Body>
    <ActionBar T={T} platform={platform}>
      <PrimaryBtn T={T} icon="check">Mark action complete</PrimaryBtn>
    </ActionBar>
  </MScreen>
);

Object.assign(window, { MyTasks, EightDFollow, CapaCheckoff, MyTasksEmpty });

// ── My Tasks — all clear ──
function MyTasksEmpty({ T, platform = 'ios' }) {
  return (
    <MScreen T={T} platform={platform}>
      <MHeader T={T} platform={platform} overline="Assigned to me" title="My Tasks" sync="synced"/>
      <EmptyState T={T} icon="check" title="Nothing on your plate" body="You've cleared everything assigned to you. Newly assigned NCRs, CAPAs and 8D steps will appear here."/>
      <TabBar T={T} platform={platform} active="tasks"/>
    </MScreen>
  );
}
