// Kaenal Mobile — NCR
// Guided create (AI pre-fill, severity, containment, 8D suggestion) + read-mostly detail.

// ── NCR guided create (step 2 of 3) ──
const NcrCreate = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <div style={{ paddingTop: topInset(platform), background: T.surface, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px 8px' }}>
        <button style={{ padding: 4, color: T.text }}><MI name="x" size={20}/></button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Flag non-conformity</div>
          <div style={{ fontSize: 11, color: T.muted }}>Step 2 of 3 · Details</div>
        </div>
        <button style={{ fontSize: 12.5, color: T.muted, fontWeight: 600, padding: 4 }}>Save draft</button>
      </div>
      <div style={{ display: 'flex', gap: 4, padding: '0 16px 10px' }}>
        {[1, 2, 3].map(n => <div key={n} style={{ flex: 1, height: 3, borderRadius: 2, background: n <= 2 ? T.accent : T.border }}/>)}
      </div>
    </div>
    <Body style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card T={T} style={{ padding: 12, background: T.accentSoft, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: T.accent, color: T.accentFg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MI name="sparkles" size={14} stroke={2}/></span>
        <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700 }}>AI pre-filled from your photo</div><div style={{ fontSize: 10.5, color: T.muted }}>Review and adjust before submitting</div></div>
      </Card>

      <div>
        <SectionLabel T={T} style={{ marginBottom: 7 }}>Evidence (3)</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ aspectRatio: '1', borderRadius: 9, position: 'relative', background: `linear-gradient(135deg, hsl(${210 + i * 6}, 12%, 32%), hsl(${210 + i * 6}, 14%, 20%))` }}>
              {i === 1 && <span style={{ position: 'absolute', top: 6, left: 6, fontSize: 8, color: '#18181b', background: '#fafafa', padding: '1px 4px', borderRadius: 3, fontWeight: 700 }}>AI</span>}
            </div>
          ))}
          <button style={{ aspectRatio: '1', borderRadius: 9, border: `1.5px dashed ${T.borderStrong}`, background: T.surface, color: T.muted, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, fontSize: 9.5 }}>
            <MI name="camera" size={18}/>Add
          </button>
        </div>
      </div>

      <div>
        <SectionLabel T={T} style={{ marginBottom: 7 }}>Title</SectionLabel>
        <Card T={T} style={{ padding: '11px 12px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
          <span style={{ flex: 1 }}>Weld porosity — Cell 3 Station 3B</span>
          <AiChip T={T}>AI</AiChip>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <SectionLabel T={T} style={{ marginBottom: 7 }}>Severity</SectionLabel>
          <div style={{ display: 'flex', gap: 4 }}>
            {[{ l: 'Min', on: false }, { l: 'Maj', on: false }, { l: 'Crit', on: true }].map(s => (
              <div key={s.l} style={{ flex: 1, height: 38, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700,
                background: s.on ? T.danger : T.surface, color: s.on ? '#fff' : T.muted, border: `1px solid ${s.on ? T.danger : T.border}` }}>{s.l}</div>
            ))}
          </div>
        </div>
        <div>
          <SectionLabel T={T} style={{ marginBottom: 7 }}>Category</SectionLabel>
          <Card T={T} style={{ height: 38, padding: '0 12px', display: 'flex', alignItems: 'center', fontSize: 12.5 }}>
            <span style={{ flex: 1, fontWeight: 600 }}>Process</span><MI name="chevronDown" size={13} color={T.muted}/>
          </Card>
        </div>
      </div>

      <Card T={T} style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
          <MI name="mapPin" size={14} color={T.accent}/>
          <span style={{ fontSize: 12.5, fontWeight: 700, flex: 1 }}>Plant A · Weld Cell 3 · Station 3B</span>
          <Mono style={{ fontSize: 10, color: T.muted }}>QR</Mono>
        </div>
        <Mono style={{ fontSize: 10.5, color: T.muted, paddingLeft: 22, display: 'block' }}>Part #A-7742 · Lot HJ-22-04 · Op: L. Wei</Mono>
      </Card>

      <div>
        <SectionLabel T={T} style={{ marginBottom: 7 }}>Immediate containment</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[{ l: 'Cell stopped & quarantined', on: true }, { l: 'Customer Quality notified', on: true }, { l: 'WIP re-inspection started', on: false }].map(c => (
            <Card T={T} key={c.l} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', fontSize: 12.5 }}>
              <div style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${c.on ? T.accent : T.borderStrong}`, background: c.on ? T.accent : 'transparent', color: T.accentFg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.on && <MI name="check" size={12} stroke={3}/>}</div>
              <span style={{ flex: 1, fontWeight: 500 }}>{c.l}</span>
            </Card>
          ))}
        </div>
      </div>

      <Card T={T} style={{ padding: 12, background: T.infoBg, border: `1px solid ${T.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <MI name="brain" size={15} color={T.info}/>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.info }}>Open an 8D for this NCR?</span>
        </div>
        <div style={{ fontSize: 11, color: T.info, lineHeight: 1.5, marginBottom: 8, opacity: 0.9 }}>Critical severity + recurring porosity (≥3 in 30d) usually trigger an 8D. We'll pre-fill the team.</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={{ flex: 1, height: 32, background: T.accent, color: T.accentFg, borderRadius: 9, fontSize: 12, fontWeight: 600 }}>Yes, open 8D</button>
          <button style={{ height: 32, padding: '0 14px', background: T.surface, color: T.info, border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 12, fontWeight: 600 }}>Later</button>
        </div>
      </Card>
    </Body>
    <ActionBar T={T} platform={platform}>
      <GhostBtn T={T} style={{ flex: 1 }}>Back</GhostBtn>
      <PrimaryBtn T={T} icon="arrowRight" style={{ flex: 2 }}>Review & submit</PrimaryBtn>
    </ActionBar>
  </MScreen>
);

// ── NCR detail (read-mostly) with 8D banner ──
const NcrDetail = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <div style={{ paddingTop: topInset(platform), background: T.surface, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px 8px' }}>
        <button style={{ padding: 4, color: T.text }}><MI name="chevronLeft" size={24} stroke={2}/></button>
        <Mono style={{ fontSize: 11.5, fontWeight: 700, color: T.muted }}>NCR-2026-0184</Mono>
        <div style={{ flex: 1 }}/>
        <SyncPill T={T} state="synced"/>
      </div>
      <div style={{ padding: '0 16px 14px' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <Sev T={T} level="high"/><StatusPill T={T} tone="open">Open</StatusPill>
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3, marginBottom: 6 }}>Bracket weld bead inconsistent on Line 2</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, color: T.muted, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MI name="mapPin" size={12}/>Plant A · Line 2</span>
          <span>·</span><span>Today, 10:42 am</span>
        </div>
      </div>
    </div>
    <Body style={{ padding: '16px 0' }}>
      <div style={{ padding: '0 16px 16px', display: 'flex', gap: 8, overflowX: 'auto' }}>
        {['Bead — top', 'Side view', ''].map((l, i) => (
          <div key={i} style={{ width: 108, height: 108, borderRadius: 11, background: `linear-gradient(135deg,#475569,#1e293b)`, flexShrink: 0, position: 'relative' }}>
            {l && <span style={{ position: 'absolute', bottom: 5, left: 7, fontSize: 9, color: '#fff', fontWeight: 600 }}>{l}</span>}
          </div>
        ))}
      </div>
      <SectionLabel T={T} style={{ padding: '0 16px 8px' }}>Description</SectionLabel>
      <div style={{ padding: '0 16px', fontSize: 13.5, lineHeight: 1.55 }}>
        Welder noticed bead inconsistency on bracket SN-A2104. Visible porosity on roughly 3" of the seam. Production paused on this lot pending containment.
      </div>
      <SectionLabel T={T} style={{ padding: '20px 16px 8px' }}>Details</SectionLabel>
      <Card T={T} style={{ margin: '0 16px' }}>
        {[
          { l: 'Reporter', r: 'Sara Chen' }, { l: 'Owner', r: 'Lin Wei' }, { l: 'Category', r: 'Weld defect / porosity' },
          { l: 'Severity', r: 'High · 12 units' }, { l: 'Due', r: 'Fri, May 8' },
        ].map((row, i, a) => (
          <div key={row.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 14px', borderBottom: i < a.length - 1 ? `1px solid ${T.border}` : 'none', fontSize: 13 }}>
            <span style={{ color: T.muted }}>{row.l}</span><span style={{ fontWeight: 600 }}>{row.r}</span>
          </div>
        ))}
      </Card>
      {/* Escalate to 8D banner */}
      <Card T={T} style={{ margin: 16, padding: 14, display: 'flex', gap: 12, alignItems: 'center', background: T.infoBg, border: `1px solid ${T.border}` }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: T.surface, color: T.info, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MI name="brain" size={19}/></div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 700 }}>Escalate to 8D investigation</div><div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>3rd repeat in 30 days · recommended</div></div>
        <MI name="chevronRight" size={16} color={T.info}/>
      </Card>
      <SectionLabel T={T} style={{ padding: '4px 16px 8px' }}>Activity</SectionLabel>
      <Card T={T} style={{ margin: '0 16px' }}>
        {[
          { i: 'flag', t: 'Raised by Sara Chen', tm: '10:42', tone: '#ea580c' },
          { i: 'shield', t: 'Containment logged', tm: '10:48', tone: T.info },
          { i: 'chat', t: 'Lin Wei assigned as owner', tm: '11:03', tone: T.muted },
        ].map((e, i, a) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', borderBottom: i < a.length - 1 ? `1px solid ${T.border}` : 'none' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: e.tone + (T.dark ? '26' : '16'), color: e.tone, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MI name={e.i} size={14}/></div>
            <div style={{ flex: 1, fontSize: 12.5, fontWeight: 500 }}>{e.t}</div>
            <Mono style={{ fontSize: 11, color: T.subtle }}>{e.tm}</Mono>
          </div>
        ))}
      </Card>
      <div style={{ height: 12 }}/>
    </Body>
    <ActionBar T={T} platform={platform}>
      <GhostBtn T={T} icon="chat" style={{ flex: 1 }}>Comment</GhostBtn>
      <PrimaryBtn T={T} style={{ flex: 1 }}>Take action</PrimaryBtn>
    </ActionBar>
  </MScreen>
);

// ── NCR create — Step 1 (type + context intake) ──
const NcrCreateStep1 = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <div style={{ paddingTop: topInset(platform), background: T.surface, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px 8px' }}>
        <button style={{ padding: 4, color: T.text }}><MI name="x" size={20}/></button>
        <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 700 }}>Flag non-conformity</div><div style={{ fontSize: 11, color: T.muted }}>Step 1 of 3 · What & where</div></div>
      </div>
      <div style={{ display: 'flex', gap: 4, padding: '0 16px 10px' }}>{[1, 2, 3].map(n => <div key={n} style={{ flex: 1, height: 3, borderRadius: 2, background: n <= 1 ? T.accent : T.border }}/>)}</div>
    </div>
    <Body style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <SectionLabel T={T} style={{ marginBottom: 8 }}>How do you want to start?</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[{ i: 'camera', l: 'Photo + AI', on: true }, { i: 'mic', l: 'Voice' }, { i: 'edit', l: 'Manual' }, { i: 'qr', l: 'Scan asset' }].map(o => (
            <Card T={T} key={o.l} style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start', border: `1.5px solid ${o.on ? T.accent : T.border}`, background: o.on ? T.accentSoft : T.surface }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: o.on ? T.accent : T.bgSubtle, color: o.on ? T.accentFg : T.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MI name={o.i} size={17}/></div>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{o.l}</span>
            </Card>
          ))}
        </div>
      </div>
      <div>
        <SectionLabel T={T} style={{ marginBottom: 8 }}>Location</SectionLabel>
        <Card T={T} style={{ padding: '11px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <MI name="mapPin" size={15} color={T.accent}/>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>Plant A · Weld Cell 3 · Station 3B</span>
          <StatusPill T={T} tone="done">GPS</StatusPill>
        </Card>
        <div style={{ fontSize: 11.5, color: T.muted, marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}><MI name="info" size={13}/> Detected from GPS + last QR scan · tap to change</div>
      </div>
      <div>
        <SectionLabel T={T} style={{ marginBottom: 8 }}>Asset / part</SectionLabel>
        <Card T={T} style={{ padding: '11px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: 1, fontSize: 13, color: T.subtle }}>Scan QR or search…</span>
          <MI name="qr" size={17} color={T.accent}/>
        </Card>
      </div>
    </Body>
    <ActionBar T={T} platform={platform}><PrimaryBtn T={T} icon="arrowRight">Continue to details</PrimaryBtn></ActionBar>
  </MScreen>
);

// ── NCR create — Step 3 (review & submit) ──
const NcrCreateStep3 = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <div style={{ paddingTop: topInset(platform), background: T.surface, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px 8px' }}>
        <button style={{ padding: 4, color: T.text }}><MI name="chevronLeft" size={22}/></button>
        <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 700 }}>Review & submit</div><div style={{ fontSize: 11, color: T.muted }}>Step 3 of 3</div></div>
      </div>
      <div style={{ display: 'flex', gap: 4, padding: '0 16px 10px' }}>{[1, 2, 3].map(n => <div key={n} style={{ flex: 1, height: 3, borderRadius: 2, background: T.accent }}/>)}</div>
    </div>
    <Body style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card T={T} style={{ padding: 14 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}><Sev T={T} level="critical"/><StatusPill T={T} tone="neutral">Process</StatusPill></div>
        <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>Weld porosity — Cell 3 Station 3B</div>
        <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>Plant A · Part #A-7742 · Lot HJ-22-04 · 14 units affected</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>{[1, 2, 3].map(i => <div key={i} style={{ width: 52, height: 52, borderRadius: 9, background: 'linear-gradient(135deg,#475569,#1e293b)' }}/>)}</div>
      </Card>
      {[
        { l: 'Containment', v: '2 actions logged', ok: true },
        { l: '8D investigation', v: 'Will open on submit', ok: true },
        { l: 'Notify', v: 'Lin Wei (owner) · Customer Quality', ok: true },
      ].map(r => (
        <Card T={T} key={r.l} style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: T.successBg, color: T.success, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MI name="check" size={14} stroke={3}/></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>{r.l}</div><div style={{ fontSize: 13.5, fontWeight: 600 }}>{r.v}</div></div>
          <a href="#" style={{ fontSize: 12.5, color: T.accent, fontWeight: 600 }}>Edit</a>
        </Card>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 2px', fontSize: 12, color: T.muted }}>
        <MI name="cloudOff" size={14} color={T.warnFg}/> You're offline — this will save on device and sync later.
      </div>
    </Body>
    <ActionBar T={T} platform={platform}>
      <GhostBtn T={T} style={{ flex: 1 }}>Back</GhostBtn>
      <PrimaryBtn T={T} icon="flag" style={{ flex: 2 }}>Submit NCR</PrimaryBtn>
    </ActionBar>
  </MScreen>
);

// ── NCR verify (Auditor capability: ncr:verify) ──
const NcrVerify = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <div style={{ paddingTop: topInset(platform), background: T.surface, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
        <button style={{ padding: 4, color: T.text }}><MI name="chevronLeft" size={24} stroke={2}/></button>
        <Mono style={{ fontSize: 11.5, fontWeight: 700, color: T.muted }}>NCR-2026-0184</Mono>
        <div style={{ flex: 1 }}/>
        <StatusPill T={T} tone="verify">Verify</StatusPill>
      </div>
      <div style={{ padding: '0 16px 14px' }}>
        <div style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>Auditor verification</div>
        <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3, marginTop: 2 }}>Confirm corrective action closed the gap</div>
      </div>
    </div>
    <Body style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card T={T} style={{ padding: 14 }}>
        <SectionLabel T={T} style={{ marginBottom: 10 }}>Evidence to verify</SectionLabel>
        {[{ i: 'tool', t: 'Fixture bolts re-torqued to 42 Nm', by: 'M. Reyes' }, { i: 'camera', t: 'Torque log photo attached', by: 'M. Reyes' }, { i: 'clipboard', t: 'Re-inspection: 12/12 pass', by: 'S. Chen' }].map((e, i, a) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0', borderBottom: i < a.length - 1 ? `1px solid ${T.border}` : 'none' }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: T.successBg, color: T.success, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MI name={e.i} size={15}/></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{e.t}</div><div style={{ fontSize: 11, color: T.muted }}>{e.by}</div></div>
            <MI name="chevronRight" size={15} color={T.subtle}/>
          </div>
        ))}
      </Card>
      <div>
        <SectionLabel T={T} style={{ marginBottom: 8 }}>Verification decision</SectionLabel>
        <div style={{ display: 'flex', gap: 8 }}>
          {[{ l: 'Effective', on: true }, { l: 'Not effective', on: false }].map(o => (
            <div key={o.l} style={{ flex: 1, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13.5, fontWeight: 600,
              background: o.on ? T.successBg : T.surface, color: o.on ? T.successFg : T.muted, border: `1.5px solid ${o.on ? T.success : T.border}` }}>
              {o.on && <MI name="check" size={15} stroke={2.6}/>}{o.l}
            </div>
          ))}
        </div>
      </div>
      <div>
        <SectionLabel T={T} style={{ marginBottom: 8 }}>Verifier note</SectionLabel>
        <Card T={T} style={{ padding: '11px 12px', minHeight: 64, fontSize: 13 }}>Root cause addressed; permanent fix confirmed on 12-unit re-inspection. Closing.</Card>
      </div>
    </Body>
    <ActionBar T={T} platform={platform}>
      <PrimaryBtn T={T} icon="shieldCheck">Verify & close NCR</PrimaryBtn>
    </ActionBar>
  </MScreen>
);

Object.assign(window, { NcrCreate, NcrDetail, NcrCreateStep1, NcrCreateStep3, NcrVerify });
