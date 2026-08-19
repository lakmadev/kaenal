// Kaenal Mobile — Inspections
// List → section-by-section runner (pass/fail/score/photo/note, inline NCR flag) → submit.
// Plus loading skeleton, empty, and "saved on device" offline states.

// ── List ──
const InspList = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <MHeader T={T} platform={platform} overline="Plant A · Detroit" title="Today's work" sync="pending"/>
    <div style={{ display: 'flex', gap: 7, padding: '10px 16px', overflowX: 'auto', background: T.surface, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
      {[{ l: 'Assigned · 6', on: true }, { l: 'Overdue · 2', tone: 'danger' }, { l: 'Done · 14' }].map(p => (
        <span key={p.l} style={{
          padding: '6px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
          background: p.on ? T.accent : p.tone === 'danger' ? T.dangerBg : T.bgSubtle,
          color: p.on ? T.accentFg : p.tone === 'danger' ? T.dangerFg : T.muted,
        }}>{p.l}</span>
      ))}
    </div>
    <Body>
      {[
        { id: 'INS-0421', title: 'Line 3 — Weld station daily checks', meta: '14 questions', due: 'Due 2h', sev: 'high', site: 'Welding', prog: 8 },
        { id: 'INS-0422', title: 'Cleanroom particle count — Suite B', meta: '6 questions', due: 'Due now', sev: 'medium', site: 'Cleanroom' },
        { id: 'INS-0423', title: 'PPE compliance — Floor walk', meta: '12 questions', due: 'Overdue 1d', sev: 'critical', site: 'All lines', overdue: true },
        { id: 'INS-0424', title: 'Incoming material — Steel coils QA-7', meta: '18 questions', due: 'Tomorrow', sev: 'medium', site: 'Receiving' },
        { id: 'INS-0425', title: 'Forklift safety — Pre-shift', meta: '8 questions', due: 'Due 3pm', sev: 'high', site: 'Logistics' },
      ].map(it => (
        <Card T={T} key={it.id} style={{ margin: '10px 16px 0', padding: '13px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <Mono style={{ fontSize: 10.5, fontWeight: 700, color: T.muted }}>{it.id}</Mono>
            <Sev T={T} level={it.sev}/>
            <div style={{ flex: 1 }}/>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: it.overdue ? T.dangerFg : T.muted }}>{it.due}</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>{it.title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: T.muted, marginTop: 6 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><MI name="mapPin" size={12}/>{it.site}</span>
            <span>·</span><span>{it.meta}</span>
            {it.prog !== undefined && <><span>·</span><span style={{ color: T.info, fontWeight: 600 }}>Resume {it.prog}/14</span></>}
          </div>
        </Card>
      ))}
      <div style={{ height: 16 }}/>
    </Body>
    <TabBar T={T} platform={platform} active="tasks"/>
  </MScreen>
);

// ── Runner (section-by-section) ──
const InspRunner = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <div style={{ paddingTop: topInset(platform), background: T.surface, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px 4px' }}>
        <button style={{ padding: 4, color: T.text }}><MI name="chevronLeft" size={24} stroke={2}/></button>
        <Mono style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: '0.04em' }}>INS-0421 · WELDING</Mono>
        <div style={{ flex: 1 }}/>
        <SyncPill T={T} state="offline"/>
      </div>
      <div style={{ padding: '0 16px 12px' }}>
        <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 10 }}>Weld station daily checks</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 6, background: T.bgSubtle, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: '57%', height: '100%', background: T.accent }}/>
          </div>
          <Mono style={{ fontSize: 12, fontWeight: 600, color: T.muted }}>8/14</Mono>
        </div>
      </div>
    </div>
    <Body style={{ background: T.bg }}>
      <div style={{ padding: '14px 16px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionLabel T={T}>Section 3 of 5 · Weld parameters</SectionLabel>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: T.successFg, fontWeight: 600 }}>
          <MI name="check" size={12} stroke={3}/> Autosaved
        </span>
      </div>

      {/* answered — pass */}
      <Card T={T} style={{ margin: '0 16px 10px', padding: 14 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: T.success, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MI name="check" size={13} stroke={3}/></div>
          <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.35 }}>Wire feed pressure within 3.2–3.8 bar?</div>
        </div>
        <div style={{ display: 'flex', gap: 8, paddingLeft: 32 }}>
          {['Pass', 'Fail', 'N/A'].map(o => (
            <div key={o} style={{
              flex: 1, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13.5, fontWeight: 600,
              background: o === 'Pass' ? T.successBg : T.surface, color: o === 'Pass' ? T.successFg : T.muted,
              border: `1.5px solid ${o === 'Pass' ? T.success : T.border}`,
            }}>{o}</div>
          ))}
        </div>
        <Mono style={{ display: 'block', paddingLeft: 32, marginTop: 8, fontSize: 11, color: T.muted }}>Reading 3.5 bar · Sara Chen · 2 min ago</Mono>
      </Card>

      {/* scored question */}
      <Card T={T} style={{ margin: '0 16px 10px', padding: 14 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: T.success, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MI name="check" size={13} stroke={3}/></div>
          <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.35 }}>Rate weld surface finish (1–5)</div>
        </div>
        <div style={{ display: 'flex', gap: 6, paddingLeft: 32 }}>
          {[1, 2, 3, 4, 5].map(n => (
            <div key={n} style={{ flex: 1, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700,
              background: n === 4 ? T.accent : T.surface, color: n === 4 ? T.accentFg : T.muted, border: `1.5px solid ${n === 4 ? T.accent : T.border}` }}>{n}</div>
          ))}
        </div>
      </Card>

      {/* current — photo + note */}
      <Card T={T} style={{ margin: '0 16px 10px', padding: 14, borderTop: `2.5px solid ${T.accent}` }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${T.accent}`, color: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 700 }}>9</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.35 }}>Photograph weld bead at points A, B, C</div>
            <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>Required · 3 photos minimum</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, paddingLeft: 32, marginBottom: 10 }}>
          {['Point A', 'Point B'].map((p, i) => (
            <div key={p} style={{ width: 62, height: 62, borderRadius: 10, background: `linear-gradient(135deg,#475569,#1e293b)`, position: 'relative', overflow: 'hidden' }}>
              <span style={{ position: 'absolute', bottom: 4, left: 5, fontSize: 8.5, color: '#fff', fontWeight: 600 }}>{p}</span>
            </div>
          ))}
          <button style={{ width: 62, height: 62, borderRadius: 10, background: T.bgSubtle, border: `2px dashed ${T.borderStrong}`, color: T.accent, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <MI name="camera" size={20}/><span style={{ fontSize: 9, fontWeight: 700 }}>Add</span>
          </button>
        </div>
        <div style={{ paddingLeft: 32 }}>
          <div style={{ height: 54, borderRadius: 10, border: `1px solid ${T.border}`, background: T.bg, padding: '9px 12px', fontSize: 13, color: T.subtle }}>Notes (optional)</div>
        </div>
      </Card>
      <div style={{ height: 8 }}/>
    </Body>
    <ActionBar T={T} platform={platform}>
      <GhostBtn T={T} icon="flag" style={{ flex: 1, color: T.dangerFg, borderColor: T.border, background: T.dangerBg }}>Flag NCR</GhostBtn>
      <PrimaryBtn T={T} icon="arrowRight" style={{ flex: 2 }}>Save & next</PrimaryBtn>
    </ActionBar>
  </MScreen>
);

// ── Submit / saved-on-device (offline) ──
const InspSaved = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <div style={{ height: topInset(platform) }}/>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 30, textAlign: 'center', gap: 18 }}>
      <div style={{ width: 88, height: 88, borderRadius: '50%', background: T.successBg, color: T.success, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <MI name="check" size={44} stroke={2.4}/>
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Inspection complete</div>
        <div style={{ fontSize: 14, color: T.muted, marginTop: 8, lineHeight: 1.5, maxWidth: 280 }}>All 14 checks recorded. 1 NCR was raised and linked automatically.</div>
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12, background: T.successBg, color: T.successFg, fontSize: 13.5, fontWeight: 600 }}>
        <MI name="cloudOff" size={16}/> Saved on device — will sync when online
      </div>
      <Card T={T} style={{ padding: '12px 14px', width: '100%', maxWidth: 300, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: T.bgSubtle, color: T.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MI name="clipboard" size={17}/></div>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <Mono style={{ fontSize: 11, fontWeight: 700, color: T.muted }}>INS-0421</Mono>
          <div style={{ fontSize: 12.5, color: T.muted }}>5 photos · 1 NCR draft · 4.2 MB queued</div>
        </div>
      </Card>
    </div>
    <div style={{ padding: `0 24px ${botInset(platform) + 24}px`, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <PrimaryBtn T={T}>Back to work queue</PrimaryBtn>
      <GhostBtn T={T} icon="eye">View sync queue</GhostBtn>
    </div>
  </MScreen>
);

// ── Loading skeleton state ──
const InspLoading = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <MHeader T={T} platform={platform} overline="Plant A · Detroit" title="Today's work" sync="synced"/>
    <Body style={{ padding: '14px 16px' }}>
      {[0, 1, 2, 3].map(i => (
        <Card T={T} key={i} style={{ padding: 14, marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <Skel T={T} w={64} h={12}/><div style={{ flex: 1 }}/><Skel T={T} w={44} h={12}/>
          </div>
          <Skel T={T} w="80%" h={16} style={{ marginBottom: 8 }}/>
          <Skel T={T} w="55%" h={12}/>
        </Card>
      ))}
    </Body>
    <TabBar T={T} platform={platform} active="tasks"/>
  </MScreen>
);

// ── Pre-start overview (before running) ──
const InspStart = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <div style={{ paddingTop: topInset(platform), background: T.surface, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
        <button style={{ padding: 4, color: T.text }}><MI name="chevronLeft" size={24} stroke={2}/></button>
        <Mono style={{ fontSize: 11.5, fontWeight: 700, color: T.muted }}>INS-0421</Mono>
        <div style={{ flex: 1 }}/><SyncPill T={T} state="synced"/>
      </div>
      <div style={{ padding: '0 16px 14px' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}><Sev T={T} level="high"/><StatusPill T={T} tone="neutral">Daily</StatusPill></div>
        <div style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.25 }}>Weld station daily checks</div>
        <div style={{ fontSize: 12.5, color: T.muted, marginTop: 5, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MI name="mapPin" size={12}/>Plant A · Welding</span>
          <span>·</span><span>~8 min</span><span>·</span><span>Due 2h</span>
        </div>
      </div>
    </div>
    <Body style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card T={T} style={{ padding: 14 }}>
        <SectionLabel T={T} style={{ marginBottom: 10 }}>Sections · 14 checks</SectionLabel>
        {[{ n: 'Safety & PPE', c: 3 }, { n: 'Machine setup', c: 3 }, { n: 'Weld parameters', c: 5 }, { n: 'Output sampling', c: 2 }, { n: 'Sign-off', c: 1 }].map((s, i, a) => (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < a.length - 1 ? `1px solid ${T.border}` : 'none' }}>
            <span style={{ width: 22, height: 22, borderRadius: '50%', background: T.bgSubtle, color: T.muted, fontSize: 10.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{s.n}</span>
            <span style={{ fontSize: 11.5, color: T.muted }}>{s.c} checks</span>
          </div>
        ))}
      </Card>
      <Card T={T} style={{ padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'center', background: T.bgSubtle, border: 'none' }}>
        <MI name="info" size={17} color={T.muted}/>
        <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.45 }}>Autosaves as you go. You can pause and resume — even offline.</div>
      </Card>
    </Body>
    <ActionBar T={T} platform={platform}><PrimaryBtn T={T} icon="play">Start inspection</PrimaryBtn></ActionBar>
  </MScreen>
);

// ── Submit review (before completing) ──
const InspReview = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <div style={{ paddingTop: topInset(platform), background: T.surface, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
        <button style={{ padding: 4, color: T.text }}><MI name="chevronLeft" size={24} stroke={2}/></button>
        <div style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>Review & submit</div>
        <SyncPill T={T} state="offline"/>
      </div>
    </div>
    <Body style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <Card T={T} style={{ flex: 1, padding: '14px', textAlign: 'center' }}><div style={{ fontSize: 26, fontWeight: 700, color: T.successFg }}>11</div><div style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>Pass</div></Card>
        <Card T={T} style={{ flex: 1, padding: '14px', textAlign: 'center' }}><div style={{ fontSize: 26, fontWeight: 700, color: T.dangerFg }}>1</div><div style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>Fail</div></Card>
        <Card T={T} style={{ flex: 1, padding: '14px', textAlign: 'center' }}><div style={{ fontSize: 26, fontWeight: 700, color: T.muted }}>2</div><div style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>N/A</div></Card>
      </div>
      <Card T={T} style={{ padding: 14, border: `1.5px solid ${T.warn}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}><MI name="flag" size={15} color={T.warnFg}/><span style={{ fontSize: 13, fontWeight: 700 }}>1 failed check raised an NCR</span></div>
        <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.45 }}>Q9 · Weld bead porosity → <Mono>NCR-DRAFT-39</Mono> linked to this inspection.</div>
      </Card>
      <div>
        <SectionLabel T={T} style={{ marginBottom: 8 }}>Sign-off</SectionLabel>
        <Card T={T} style={{ padding: 14 }}>
          <div style={{ height: 72, borderRadius: 8, background: T.bgSubtle, border: `1px dashed ${T.borderStrong}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.subtle, fontSize: 12.5, fontWeight: 600 }}>
            <MI name="pen" size={16} style={{ marginRight: 6 }}/> Sign here
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <Avatar T={T} initials="SC" size={28}/>
            <div style={{ fontSize: 12.5 }}><strong>Sara Chen</strong> · Inspector</div>
          </div>
        </Card>
      </div>
    </Body>
    <ActionBar T={T} platform={platform}><PrimaryBtn T={T} icon="check">Complete inspection</PrimaryBtn></ActionBar>
  </MScreen>
);

// ── Empty queue ──
const InspEmpty = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <MHeader T={T} platform={platform} overline="Plant A · Detroit" title="Today's work" sync="synced"/>
    <EmptyState T={T} icon="check" title="You're all caught up" body="No inspections assigned to you right now. New work will appear here and notify you."/>
    <TabBar T={T} platform={platform} active="tasks"/>
  </MScreen>
);

Object.assign(window, { InspList, InspRunner, InspSaved, InspLoading, InspStart, InspReview, InspEmpty });
